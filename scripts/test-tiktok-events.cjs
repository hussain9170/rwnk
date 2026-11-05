const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const mod = { exports: {} }
const env = { TIKTOK_EVENTS_ACCESS_TOKEN: 'secret-for-tests-only' }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/tiktok-events.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: mod.exports, require, process: { env }, Date, AbortSignal, fetch, console })
const { buildTikTokPurchase, flushTikTokPurchases } = mod.exports
const now = Date.now()
const p = { id: 'private-purchase-id', status: 'completed', amount: 5, currency: 'KWD', email: ' Customer@Example.com ', paid_at: new Date(now - 1000).toISOString(), product_id: 'rwnak-guide' }
const receipt = { purchase_id: p.id, consent_version: 'tiktok-purchase-v1', consent_at: new Date(now - 5000).toISOString(), revoked_at: null, ttp: 'test-cookie', client_user_agent: 'test-agent', lease_id: 'lease' }
const event = buildTikTokPurchase(p, receipt, now)
assert.equal(event.event, 'Purchase'); assert.equal(event.properties.value, 5); assert.equal(event.properties.currency, 'KWD')
assert.equal(event.properties.contents[0].content_id, p.product_id)
assert.equal(event.event_time, Math.floor(Date.parse(p.paid_at) / 1000))
assert.match(event.user.email, /^[a-f0-9]{64}$/)
assert.equal(event.event_id, buildTikTokPurchase(p, receipt, now).event_id)
assert.notEqual(event.event_id, buildTikTokPurchase({ ...p, id: 'other-order' }, { ...receipt, purchase_id: 'other-order' }, now).event_id)
assert.ok(!JSON.stringify(event).includes(p.id)); assert.ok(!JSON.stringify(event).includes('@'))
for (const patch of [{status:'pending'},{status:'failed'},{status:'refunded'},{amount:NaN},{amount:0},{paid_at:null},{paid_at:new Date(now+1000).toISOString()},{paid_at:new Date(now-7*86400000).toISOString()},{product_id:null},{email:'bad'}]) assert.equal(buildTikTokPurchase({...p,...patch},receipt,now),null,JSON.stringify(patch))
for (const patch of [{revoked_at:new Date().toISOString()},{consent_version:'other'},{purchase_id:'wrong'},{consent_at:new Date(now).toISOString()}]) assert.equal(buildTikTokPurchase(p,{...receipt,...patch},now),null)

function fakeDb() {
  const state = { sent: false, leased: false, updates: [] }
  return { state, rpc: async () => ({ data: state.sent || state.leased ? [] : (state.leased=true,[receipt]), error: null }),
    from: table => {
      const q = { select: () => q, eq: () => q, single: async () => ({ data: table === 'purchases' ? p : { revoked_at: null } }),
        update: values => { state.updates.push(values); if (values.sent_at) state.sent=true; return q }, lt: () => Promise.resolve({error:null}),
        then: resolve => resolve({error:null}) }
      return q
    } }
}
;(async () => {
  let calls=0
  const db=fakeDb()
  const send=async (_url,options) => { calls++; const payload=JSON.parse(options.body); assert.equal(payload.event_source_id,'DBMFUP3C77UA5QM455NG'); assert.equal(options.headers['Access-Token'],env.TIKTOK_EVENTS_ACCESS_TOKEN); return {ok:true,status:200,json:async()=>({code:0})} }
  assert.equal((await flushTikTokPurchases(db,null,send)).sent,1)
  assert.equal((await flushTikTokPurchases(db,null,send)).sent,0)
  assert.equal(calls,1,'sent orders are not resent')
  const failedDb=fakeDb()
  assert.equal((await flushTikTokPurchases(failedDb,null,async()=>({ok:true,status:200,json:async()=>({code:40001})}))).failed,1)
  assert.equal(failedDb.state.sent,false,'HTTP 200 is insufficient without TikTok code 0')
  failedDb.state.leased=false
  assert.equal((await flushTikTokPurchases(failedDb,null,send)).sent,1,'failed delivery can retry after lease')
  const networkDb=fakeDb()
  assert.equal((await flushTikTokPurchases(networkDb,null,async()=>{throw new Error('offline')})).failed,1)
  assert.equal(networkDb.state.sent,false)
  delete env.TIKTOK_EVENTS_ACCESS_TOKEN
  assert.equal((await flushTikTokPurchases(fakeDb(),null,send)).configured,false)
  assert.equal(calls,2)
  console.log('PASS: verified paid orders only, consent/revocation, no raw email or bearer IDs, stable dedup IDs, API result handling, retry and token guard')
})().catch(e=>{console.error(e);process.exitCode=1})
