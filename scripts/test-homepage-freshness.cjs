const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(path,deps) {
  const source = fs.readFileSync(path,'utf8').replace(/await import\('([^']+)'\)/g,"await Promise.resolve(require('$1'))")
  const mod={exports:{}}
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod.exports,console,process,require:name=>{if(!(name in deps)) throw Error(name); return deps[name]}})
  return mod.exports
}
;(async()=>{
  let failed=false
  const query={select(){return query},eq(){return query},not(){return query},neq(){return query},order:async()=>failed?{error:{message:'fixture offline'}}:{data:[]}}
  const publicClient={'./public-supabase':{getPublicSupabase:()=>({from:()=>query})}}
  const {getStoreSettings}=load('src/lib/store-settings.ts',{
    ...publicClient,'./seo':{PRODUCT_NAME:'دليل رونق'},'./db-resilience':{getSingletonRow:async()=>failed?{data:null,error:{message:'fixture offline'}}:{data:{product_price:6}}}
  })
  const {getBookLanguages}=load('src/lib/content.ts',{
    ...publicClient,'./seo':{publicMetadata:()=>({})},'./policy-copy':{},'./public-content-cache':{getPublicList:async()=>[]}
  })
  assert.equal((await getStoreSettings({strict:true})).product_price,6)
  assert.equal((await getBookLanguages({strict:true})).length,0,'an intentionally empty language list is valid')
  failed=true
  await assert.rejects(getStoreSettings({strict:true}),/fixture offline/,'ISR must fail rather than cache a fallback price')
  await assert.rejects(getBookLanguages({strict:true}),/fixture offline/,'ISR must preserve its previous valid output on language lookup errors')
  const response={json:(data,options={})=>({data,status:options.status??200})}
  const refreshed=[]
  const row={id:'language-id',language_code:'ar',file_path:'guide.pdf'}
  const q={insert(){return q},update(){return q},delete(){return q},select(){return q},eq(){return q},single:async()=>({data:row,error:null}),then:resolve=>resolve({data:row,error:null,count:0})}
  const deps={
    'next/server':{NextResponse:response},'next/cache':{revalidatePath:path=>refreshed.push(path)},
    '@/lib/admin-auth':{requireAdmin:async()=>({error:null})},'@/lib/admin-db':{getAdminDb:()=>({from:()=>q})},
    '@/lib/db-resilience':{isMissingTableError:()=>false,missingTableMessage:()=>'',getSingletonRow:async()=>({data:{id:'settings-id'}}),updateWithSchemaFallback:async()=>({data:{product_price:6},droppedFields:[]})},
    '@/lib/admin-resources':{STORE_SETTINGS_FIELDS:[],pickFields:body=>body},'@/lib/store-settings':{DEFAULT_SETTINGS:{}},
    '@/lib/book-language-validation':{BOOK_LANGUAGE_CODE_RE:/^[a-z]+$/,normalizeLanguageCode:code=>code,parseBookLanguagePayload:body=>body,parseBookLanguagePatch:body=>body}
  }
  const req={json:async()=>({language_code:'ar',name_ar:'العربية',name_en:'Arabic',is_active:true,file_path:'guide.pdf'})}
  const actions=[
    ()=>load('src/app/api/admin/settings/route.ts',deps).PATCH(req),
    ()=>load('src/app/api/admin/book-languages/route.ts',deps).POST(req),
    ()=>load('src/app/api/admin/book-languages/[id]/route.ts',deps).PUT(req,{params:Promise.resolve({id:'language-id'})}),
    ()=>load('src/app/api/admin/book-languages/[id]/route.ts',deps).DELETE(req,{params:Promise.resolve({id:'language-id'})})
  ]
  for(const action of actions) {
    refreshed.length=0
    assert.equal((await action()).status,200)
    assert(refreshed.includes('/'),'successful settings/language writes must expire the cached homepage')
    assert(refreshed.includes('/checkout'),'checkout must also refresh after an admin change')
  }
  console.log('PASS: ISR readers fail on upstream errors, valid empty availability, and settings/language create/update/delete invalidate homepage and checkout')
})().catch(error=>{console.error(error);process.exitCode=1})
