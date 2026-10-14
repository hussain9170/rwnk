const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function moduleFor(path, deps, globals = {}) {
 const source=fs.readFileSync(path,'utf8').replace(/await import\('([^']+)'\)/g,"await Promise.resolve(require('$1'))")
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 const mod={exports:{}}
 vm.runInNewContext(js,{exports:mod.exports,require:n=>{if(!(n in deps)) throw Error(n);return deps[n]},URL,console,process,...globals})
 return mod.exports
}
const {safeAuthPath}=moduleFor('src/lib/auth-redirect.ts',{})
for(const path of [null,'https://evil.test','//evil.test','@evil.test','/\\evil.test','\n//evil.test','javascript:alert(1)']) assert.equal(safeAuthPath(path),'/library')
for(const path of ['/reset-password','/account','/library?tab=books','/admin/invite/test']) assert.equal(safeAuthPath(path),path)
async function callback(next, exchangeError=false) {
 const route=moduleFor('src/app/auth/callback/route.ts',{
  'next/server':{NextResponse:{redirect:url=>({url})}}, '@/lib/auth-redirect':{safeAuthPath},
  'next/headers':{cookies:async()=>({getAll:()=>[],set:()=>{}})},
  '@supabase/ssr':{createServerClient:()=>({auth:{exchangeCodeForSession:async()=>({error:exchangeError})}})}
 })
 return route.GET({url:'https://rwnak.test/auth/callback?code=fake&next='+encodeURIComponent(next)})
}
function libraryHarness({dbError=false, tokenError=false, popup=true}={}) {
 let state=[],cursor=0,effects=[],listeners={},events=[],alerts=[]
 const downloadWindow={closed:false,opener:{},location:{href:''},close(){this.closed=true}}
 const react={useState:init=>{const i=cursor++;if(!(i in state)) state[i]=init;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v}]},useEffect:fn=>effects.push(fn)}
 const row={id:'order',downloads_used:1,downloads_remaining:4,downloads_limit:5,created_at:'2026-10-14'}
 const client={auth:{getUser:async()=>({data:{user:{id:'buyer'}}})},from:()=>({select:()=>({order:async()=>({data:dbError?null:[row],error:dbError?{message:'offline'}:null})})})}
 const page=moduleFor('src/app/library/page.tsx',{
  react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'},
  'next/link':{},'@/components/layout/Navbar':{},'@/lib/supabase':{supabase:client},'@/lib/auth':{signOut:async()=>{}},
  '@/lib/purchases':{generateDownloadTokenSafe:async()=>{events.push('token');if(tokenError) throw Error('failed');return 'token'}}
 },{window:{location:{href:''},open:()=>{events.push('open');return popup?downloadWindow:null},addEventListener:(n,f)=>listeners[n]=f,removeEventListener:()=>{}},alert:m=>alerts.push(m)})
 const render=()=>{cursor=0;return page.default()}
 const nodes=tree=>{const all=[];function visit(x){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(visit);return}all.push(x);visit(x.props?.children)}visit(tree);return all}
 return{render,nodes,state,effects,events,alerts,downloadWindow,listeners}
}
;(async()=>{
 assert.equal((await callback('@evil.test')).url,'https://rwnak.test/library')
 assert.equal((await callback('/reset-password')).url,'https://rwnak.test/reset-password')
 assert.equal((await callback('/reset-password',true)).url,'https://rwnak.test/login?error=auth_failed')
 for(const dbError of [false,true]){
  const h=libraryHarness({dbError});h.render();h.effects[0]();await new Promise(r=>setImmediate(r))
  const nodes=h.nodes(h.render())
  if(dbError) assert.ok(nodes.some(n=>n.props?.role==='alert'),'DB errors must show an alert')
  else assert.equal(h.state[0][0].id,'order')
 }
 for(const tokenError of [false,true]){
  const h=libraryHarness({tokenError});h.render();h.effects[0]();await new Promise(r=>setImmediate(r))
  const button=h.nodes(h.render()).find(n=>n.type==='button' && n.props?.disabled===false)
  assert.ok(button,'download control is enabled for a purchased book')
  await button.props.onClick()
  assert.deepEqual(h.events,['open','token'],'new tab opens synchronously before token request')
  assert.equal(h.state[0][0].downloads_used,1,'UI must not spend quota before server completion')
  if(tokenError){assert.equal(h.downloadWindow.closed,true);assert.equal(h.alerts.length,1)}
  else{assert.equal(h.downloadWindow.location.href,'/api/download?token=token');assert.equal(h.downloadWindow.opener,null)}
 }
 console.log('PASS: safe login/recovery redirects, callback failures, library DB errors, popup timing, failed token cleanup and server-owned quota')
})().catch(e=>{console.error(e);process.exitCode=1})
