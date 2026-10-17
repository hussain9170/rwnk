const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const crypto = require('node:crypto')
function load(path, deps, extras={}) {
  const source=fs.readFileSync(path,'utf8').replace(/await import\('([^']+)'\)/g,"await Promise.resolve(require('$1'))")
  const mod={exports:{}}
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports:mod.exports,require:n=>{if(!(n in deps)) throw Error(n);return deps[n]},process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test-only-signing-key'}},Buffer,URL,Date,console,...extras})
  return mod.exports
}
const response={json:(data,opts)=>({data,...opts})}
;(async()=>{
  const access=load('src/lib/purchase-access.ts',{'node:crypto':crypto})
  const now=1792270000000
  const token=access.createPurchaseAccess('purchase-a',now)
  assert.equal(access.verifyPurchaseAccess('purchase-a',token,now),true)
  assert.equal(access.verifyPurchaseAccess('purchase-b',token,now),false)
  assert.equal(access.verifyPurchaseAccess('purchase-a',token,now+31*86400000),false)
  assert.equal(access.verifyPurchaseAccess('purchase-a',token.replace(/.$/,'!'),now),false)
  for(const bad of [null,'','123','9999999999.bad.extra','<script>']) assert.equal(access.verifyPurchaseAccess('purchase-a',bad,now),false)
  for(const path of ['account/set-password','link-purchase','link-existing-purchase']) {
    const route=load(`src/app/api/${path}/route.ts`,{'next/server':{NextResponse:response}})
    assert.equal((await route.POST()).status,410,'legacy unauthenticated account mutation must be gone')
  }
  const {reservePaymentAttempt,savePaymentAttempt}=load('src/lib/payment-attempt.ts',{'node:crypto':crypto})
  const row={id:'purchase-a',status:'pending',payment_ref:null,transaction_details:null}
  const db={from(){let changes=null,filters=[];const q={
    update(v){changes=v;return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},select(){return q},
    async maybeSingle(){if(filters.some(([k,v])=>row[k]!==v))return{data:null,error:null};Object.assign(row,changes);return{data:{...row},error:null}},
    async single(){return{data:{...row},error:null}}
  };return q}}
  const attempts=await Promise.all(Array.from({length:25},()=>reservePaymentAttempt(db,'purchase-a')))
  assert.equal(attempts.filter(a=>a.state==='claimed').length,1,'only one parallel caller may contact the provider')
  assert.equal(attempts.filter(a=>a.state==='busy').length,24)
  const winner=attempts.find(a=>a.state==='claimed')
  assert.equal(await savePaymentAttempt(db,'purchase-a','wrong-claim','invoice-a','https://gateway.test/a'),false)
  assert.equal(await savePaymentAttempt(db,'purchase-a',winner.claim,'invoice-a','https://gateway.test/a'),true)
  const retry=await reservePaymentAttempt(db,'purchase-a')
  assert.equal(retry.state,'ready'); assert.equal(retry.invoiceId,'invoice-a')
  row.status='completed';assert.equal((await reservePaymentAttempt(db,'purchase-a')).state,'busy')
  for(const reader of [{guest:false,userId:null},{guest:false,userId:'wrong-owner'},{guest:false,userId:'owner'},{guest:true,userId:null}]) {
    const data={id:'purchase-a',user_id:'owner',email:'test@example.test',status:'completed',book_language:null}
    const sb={from(){const q={select(){return q},eq(){return q},async single(){return{data,error:null}}};return q}}
    const route=load('src/app/api/purchase-status/route.ts',{
      '@/lib/purchase-access':{purchaseReader:async()=>reader},'@/lib/public-rate-limit':{publicRateLimit:async()=>null},
      '@/lib/purchase-mail-queue':{flushPurchaseEmails:async()=>{}},'next/server':{NextResponse:response,after:()=>{}},
      '@/lib/env':{getSupabaseServerEnv:()=>({url:'https://db.test',key:'test'})},'@/lib/snap-capi':{snapOrderId:()=> 'public-invoice'},
      '@supabase/supabase-js':{createClient:()=>sb}
    })
    const result=await route.GET({nextUrl:new URL('https://rwnak.test/api/purchase-status?purchaseId=purchase-a')})
    if(!reader.guest&&!reader.userId) assert.equal(result.status,401)
    else if(!reader.guest&&reader.userId!=='owner') assert.equal(result.status,403)
    else {assert.equal(result.data.data.id,'purchase-a');assert.equal('user_id' in result.data.data,false)}
  }
  const {decideFinalize}=load('src/lib/payment-verify.ts',{})
  const gateway={status:'completed',matchesPurchase:true,paymentMethod:'KNET',raw:{}}
  assert.equal(decideFinalize('failed',gateway).action,'apply_update')
  assert.equal(decideFinalize('failed',{...gateway,matchesPurchase:false}).action,'reject_mismatch')
  assert.equal(decideFinalize('completed',gateway).action,'skip_already_final')
  assert.equal(decideFinalize('refunded',gateway).action,'skip_already_final')
  const fallback=load('src/lib/public-rate-limit.ts',{
    'node:crypto':crypto,'next/server':{NextResponse:response},'@supabase/supabase-js':{createClient:()=>({rpc:async()=>({data:null,error:{code:'PGRST202'}})})},
    './env':{getSupabaseServerEnv:()=>({url:'https://db.test',key:'test'})},'./rate-limit':{clientIp:()=> 'test-ip',rateLimit:()=>false}
  })
  assert.equal((await fallback.publicRateLimit({},'test',1)).status,429)
  const callbackPurchase={id:'purchase-a',status:'completed',email:'test@example.test',user_id:'owner'}
  const callbackDb={from(){const q={select(){return q},eq(){return q},async single(){return{data:callbackPurchase,error:null}}};return q}}
  const callback=load('src/app/api/payment/callback/route.ts',{
    '@/lib/purchase-access':access,'@/lib/public-rate-limit':{publicRateLimit:async()=>null},
    '@/lib/purchase-mail-queue':{flushPurchaseEmails:async()=>({available:false})},
    'next/server':{NextResponse:{...response,redirect:url=>({url})},after:()=>{}},
    '@/lib/snap-capi':{flushSnapPurchases:async()=>{}},'@/lib/env':{getSupabaseServerEnv:()=>({url:'https://db.test',key:'test'})},
    '@/lib/payment-verify':load('src/lib/payment-verify.ts',{}),
    '@/lib/payment-access':{ensureUserLinked:async()=>null,mintDownloadToken:async()=>null},
    '@/lib/email':{sendPurchaseConfirmationEmail:async()=>({ok:true}),sendAdminOrderNotification:async()=>({ok:true})},
    '@/lib/db-resilience':{getSingletonRow:async()=>({data:null})},'@supabase/supabase-js':{createClient:()=>callbackDb}
  },{process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test-only-signing-key',NEXT_PUBLIC_APP_URL:'https://rwnak.test'}}})
  const noProof=await callback.GET({nextUrl:new URL('https://rwnak.test/api/payment/callback?purchaseId=purchase-a')})
  assert.equal(new URL(noProof.url).pathname,'/login','callback must not turn a known UUID into a signed access link')
  const good=await callback.GET({nextUrl:new URL('https://rwnak.test/api/payment/callback?purchaseId=purchase-a&access='+access.createPurchaseAccess('purchase-a'))})
  const delivered=new URL(good.url);assert.equal(delivered.pathname,'/success')
  assert.equal(access.verifyPurchaseAccess('purchase-a',delivered.searchParams.get('access')),true)
  console.log('PASS: signed/expired/tampered/wrong-order access; retired credential endpoints; 25 parallel invoice reservations; owner-only order details; verified late settlement; missing-migration rate fallback')
})().catch(err=>{console.error(err);process.exitCode=1})
