const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const mod = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/checkout-session.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
  { exports: mod.exports, fetch, AbortController, setTimeout, clearTimeout })
;(async () => {
  let created = 0, attempts = [], fail = true
  const request = async (url, options) => {
    if (url === '/api/checkout') { created++; return {ok:true,json:async()=>({purchaseId:`order-${created}`,access:'test-only'})} }
    attempts.push(JSON.parse(options.body).purchaseId)
    if (fail) { fail=false; return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')))) }
    return {ok:true,json:async()=>({paymentUrl:'https://gateway.example.invalid/pay'})}
  }
  const pay = mod.exports.createCheckoutSession(request, 5)
  await assert.rejects(pay({bookLanguage:'ur'}), /طال تجهيز/)
  assert.equal(await pay({bookLanguage:'ur'}),'https://gateway.example.invalid/pay')
  assert.equal(created,1,'gateway retry must reuse the created order')
  assert.deepEqual(attempts,['order-1','order-1'])
  await pay({bookLanguage:'en'})
  assert.equal(created,2,'a changed selection must not reuse the previous language')
  let gatewayCalls=0
  const denied=mod.exports.createCheckoutSession(async url=>{ if(url!=='/api/checkout')gatewayCalls++;return {ok:false,json:async()=>({error:'price changed'})} })
  await assert.rejects(denied({}),/price changed/)
  assert.equal(gatewayCalls,0)
  console.log('PASS: gateway timeout, retry reuses order, changed selection creates matching order, checkout rejection never reaches gateway')
})().catch(error=>{console.error(error);process.exitCode=1})
