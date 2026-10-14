const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const token='pkce_'+'a'.repeat(56)
let calls=0,otpError=null,writes=[]
class Response {constructor(body,options){this.body=body;this.headers=new Headers(options?.headers)}static redirect(url,status=307){return{url:String(url),status,headers:new Headers()}}static json(body,options){return{body,...options}}}
const mod={exports:{}}
const deps={'next/server':{NextResponse:Response},'next/headers':{cookies:async()=>({getAll:()=>[],set:(...args)=>writes.push(args)})},'@supabase/ssr':{createServerClient:(_u,_k,options)=>({auth:{verifyOtp:async args=>{calls++;assert.equal(args.type,'recovery');assert.equal(args.token_hash,token);if(!otpError)options.cookies.setAll([{name:'session',value:'test',options:{}}]);return{error:otpError}}}})}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/auth/recovery/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod.exports,require:n=>deps[n],URL,Headers,process})
function request(value=token,origin='https://rwnak.test'){return{url:'https://rwnak.test/auth/recovery?token_hash='+encodeURIComponent(value),headers:new Headers(origin?{origin}:{}),formData:async()=>new Map([['token_hash',value]])}}
;(async()=>{
const get=await mod.exports.GET(request());assert.equal(calls,0,'email scanners must not consume tokens');assert.ok(get.body.includes('method="post"'));assert.equal(get.headers.get('Referrer-Policy'),'no-referrer')
assert.ok((await mod.exports.GET(request('<script>'))).url.includes('auth_failed'))
const ok=await mod.exports.POST(request());assert.equal(ok.status,303);assert.equal(ok.url,'https://rwnak.test/reset-password');assert.equal(writes.length,1,'persist the recovery session in the new browser')
const before=calls;assert.equal((await mod.exports.POST(request(token,'https://evil.test'))).status,403);assert.equal(calls,before)
otpError={code:'otp_expired'};assert.ok((await mod.exports.POST(request())).url.includes('auth_failed'));assert.equal(writes.length,1)
console.log('PASS: cross-browser recovery verification, session cookies, scanner-safe GET, invalid token and cross-origin POST rejection, expired link')
})().catch(e=>{console.error(e);process.exitCode=1})
