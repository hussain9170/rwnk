// Runs actual TS modules with in-memory database/provider I/O. No emails or orders leave this process.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const policy = { POLICY_VERSION:'2026-10-19', NEWSLETTER_VERSION:'2026-10-19', NEWSLETTER_COPY:'Explicit newsletter consent' }
let row, sent, calls, failSend, inserted, purchasePayload, rpcResult=true, rpcError=null, lastRpc
function reset(status='pending') { row={id:'test-id',email:'test@example.invalid',status,expires_at:new Date(Date.now()+86400000).toISOString()}; sent=[]; calls=[]; failSend=false; inserted=null }
const db={
 rpc:async(name,args)=>{lastRpc={name,args};return {data:rpcResult,error:rpcError}},
 from:()=>{let operation='select', values, filters=[]; const q={
  insert(v){operation='insert'; values=v; inserted=v; return q},
  update(v){operation='update'; values=v; return q},
  select(){return q}, eq(k,v){filters.push([k,v]); return q},
  maybeSingle:async()=>run(), single:async()=>run(),
  then(resolve,reject){return Promise.resolve(run()).then(resolve,reject)},
 }; function run(){
  if(operation==='insert') return {data:{id:'test-id'},error:null}
  if(operation==='update') { if(!filters.every(([k,v])=>row[k]===v)) return {data:null,error:null}; Object.assign(row,values); return {data:{id:row.id},error:null} }
  return {data:row,error:null}
 } return q },
}
function load(path, mocks={}, fetchMock=async()=>{throw Error('Unexpected network')}) {
 const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const module={exports:{}}
 vm.runInNewContext(source,{module,exports:module.exports,require:name=>name in mocks?mocks[name]:require(name),process:{env:{RESEND_API_KEY:'fake-test-key',EMAIL_FROM:'test@example.invalid'}},fetch:fetchMock,AbortSignal,URL,console,Date,Buffer},{filename:path})
 return module.exports
}
const provider=async(url,init)=>{
 calls.push({url,method:init.method})
 if(url.endsWith('/emails')) {sent.push(JSON.parse(init.body)); return {ok:!failSend,status:failSend?500:200} }
 if(init.method==='GET') return {ok:false,status:404}
 return {ok:true,status:200,json:async()=>({id:'contact'})}
}
const newsletter=load('src/lib/newsletter.ts',{'@supabase/supabase-js':{createClient:()=>db},'./env':{getSupabaseServerEnv:()=>({url:'https://example.invalid',key:'fake'})},'./policy-consent':policy},provider)
reset(); await newsletter.requestNewsletter('test@example.invalid')
assert.equal(sent.length,1); assert.equal(inserted.token_hash.length,64); assert(!sent[0].html.includes('fake-test-key')); assert.equal(inserted.consent_version,policy.NEWSLETTER_VERSION)
assert(!calls.some(c=>c.url.includes('/contacts')),'Unverified requests cannot enter contacts')
assert.match(sent[0].html,/newsletter\/confirm\?token=[a-f0-9]{64}/)
assert(!sent[0].html.includes(inserted.token_hash),'Store only token digest')
reset(); rpcResult=false; assert.equal(await newsletter.confirmNewsletter('a'.repeat(64)),false)
rpcResult=true; assert.equal(await newsletter.confirmNewsletter('a'.repeat(64)),true)
assert.equal(lastRpc.name,'confirm_newsletter_signup'); assert.equal(lastRpc.args.p_hash,newsletter.tokenHash('a'.repeat(64)))
assert.equal(calls.length,0,'Confirmation uses the atomic database function without provider contact privileges')
rpcError={message:'unavailable'}; await assert.rejects(newsletter.confirmNewsletter('a'.repeat(64))); rpcError=null
const testId='00000000-0000-4000-8000-000000000001'
const unsub=newsletter.unsubscribeToken(testId)
assert.equal(newsletter.unsubscribeId(unsub),testId)
assert.equal(newsletter.unsubscribeId(unsub.slice(0,-1)+(unsub.endsWith('a')?'b':'a')),null)
assert.equal(newsletter.unsubscribeId('bad'),null)
reset(); failSend=true; await assert.rejects(newsletter.requestNewsletter('test@example.invalid')); assert.equal(row.status,'send_failed')
assert.equal(newsletter.validNewsletterToken('bad'),false); assert.equal(newsletter.validNewsletterToken('a'.repeat(64)),true)
const response={json:(body,options={})=>({body,status:options.status??200})}
const checkout=load('src/app/api/checkout/route.ts',{
 '@/lib/policy-consent':policy,
 '@/lib/public-rate-limit':{publicRateLimit:async()=>null},
 'next/server':{NextResponse:response},
 '@/lib/purchase-access':{createPurchaseAccess:()=> 'test-access'},
 '@/lib/env':{getSupabaseServerEnv:()=>({url:'https://example.invalid',key:'fake'})},
 '@/lib/db-resilience':{getSingletonRow:async()=>({data:{product_id:'test-product',product_price:5,product_currency:'KWD'},error:null}),insertWithSchemaFallback:async(_db,_table,payload)=>{purchasePayload=payload;return {data:{id:'test-purchase',amount:5,currency:'KWD'},error:null,droppedFields:[]}}},
 '@/lib/snap-consent':{SNAP_CONSENT_COOKIE:'snap',parseSnapConsent:()=>null},
 '@supabase/supabase-js':{createClient:()=>({from:()=>({select:()=>({eq(){return this},maybeSingle:async()=>({data:{language_code:'ar',file_path:'test.pdf'},error:null})})})})},
})
const req=body=>({json:async()=>body,cookies:{get:()=>undefined},headers:new Headers()})
assert.equal((await checkout.POST(req({email:'test@example.invalid'}))).status,400)
assert.equal((await checkout.POST(req({email:'test@example.invalid',policyAccepted:true,policyVersion:'old'}))).status,400)
assert.equal((await checkout.POST(req({email:'test@example.invalid',bookLanguage:'ar',policyAccepted:true,policyVersion:policy.POLICY_VERSION}))).status,200)
assert.equal(purchasePayload.policy_version,policy.POLICY_VERSION); assert(!Number.isNaN(Date.parse(purchasePayload.policy_accepted_at)))
// Admin exports reject anonymous requests and neutralise spreadsheet formulas.
let adminAllowed=false, memberReads=0, activeFilter=false
class TestResponse extends Response { static json(body,options){return new TestResponse(JSON.stringify(body),options)} }
const adminRoute=load('src/app/api/admin/newsletter/route.ts',{
 'next/server':{NextResponse:TestResponse},
 '@/lib/admin-auth':{requireAdmin:async()=>({error:adminAllowed?null:new TestResponse('unauthorized',{status:401})})},
 '@/lib/newsletter':{unsubscribeToken:()=> 'signed-test-token'},
 '@/lib/admin-db':{getAdminDb:()=>({from:()=>{
  memberReads++
  const q={select(){return q},is(key,value){activeFilter=key==='unsubscribed_at'&&value===null;return q},order(){return q},range:async()=>({data:[{email:'=formula@example.invalid',confirmed_at:'2026-10-19',signup_id:testId}],error:null,count:1})}
  return q
 }})},
})
const adminRequest={nextUrl:new URL('https://example.invalid/api/admin/newsletter?export=csv')}
assert.equal((await adminRoute.GET(adminRequest)).status,401); assert.equal(memberReads,0)
adminAllowed=true
const exported=await adminRoute.GET(adminRequest)
assert.equal(exported.status,200); assert.equal(exported.headers.get('Cache-Control'),'no-store'); assert(activeFilter)
const csv=await exported.text()
assert(csv.includes('"\'=formula@example.invalid"')); assert(csv.includes('unsubscribe?token=signed-test-token'))
console.log('PASS: hashed signup tokens, sending-only provider access, atomic confirmation delegation, signed unsubscribe tamper rejection, send failures, checkout policy validation and persisted receipt. Expiry/replay/unsubscribe/resubscribe are tested against Postgres in a rolled-back transaction.')
