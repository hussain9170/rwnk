const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
let granted = true, gpc = false, inserted, revoked, sourceEnabled = false, attributionInserted, attributionDeleted = false
const sb = { from(table) {
  const chain = {
    select() { return chain }, eq() { return chain }, is() { return chain },
    delete() { if (table === 'purchase_marketing_attribution') attributionDeleted = true; return chain },
    async maybeSingle() { return { data: { language_code: 'ar', file_path: 'book.pdf' } } },
    async insert(value) { if (table === 'purchase_marketing_attribution') attributionInserted = value; else inserted = value; return { error: null } },
    update(value) { revoked = value; return chain },
    then(resolve) { resolve({ error: null }) },
  }
  return chain
} }
const deps = {
  '@/lib/purchase-access': { createPurchaseAccess: () => 'test-access' },
  '@/lib/public-rate-limit': { publicRateLimit: async () => null },
  'next/server': { NextResponse: class { constructor(body, init) { this.status = init.status } static json(data, init) { return { data, status: init?.status || 200 } } } },
  '@/lib/env': { getSupabaseServerEnv: () => ({ url: 'https://db.test', key: 'test-only' }) },
  '@/lib/db-resilience': {
    getSingletonRow: async () => ({ data: { product_id: 'book', product_price: 5, product_currency: 'KWD' } }),
    insertWithSchemaFallback: async () => ({ data: { id: 'test-purchase', amount: 5, currency: 'KWD' }, droppedFields: [] }),
  },
  '@/lib/snap-consent': { SNAP_CONSENT_COOKIE: 'consent', parseSnapConsent: () => granted ? { granted: true, receipt: 'test-consent', version: 'snap-v1', at: new Date().toISOString() } : null },
  '@/lib/policy-consent': { POLICY_VERSION: 'test-policy' },
  '@/lib/snap-attribution': { SNAP_SOURCE_COOKIE: 'rwnak_snap_source', parseSnapAttribution: () => sourceEnabled ? { source: 'snapchat', medium: 'paid_social', account: 'test-account', campaign: 'campaign', content: 'creative', at: Date.now() - 1000 } : null },
  '@supabase/supabase-js': { createClient: () => sb },
}
function load(file) {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: mod.exports, require: name => { assert(name in deps, name); return deps[name] }, console, Date })
  return mod.exports
}
;(async () => {
  const route = load('src/app/api/checkout/route.ts')
  const req = { json: async () => ({ email: 'test@example.test', policyAccepted: true, policyVersion: 'test-policy', bookLanguage: 'ar' }), cookies: { get: () => undefined }, headers: { get: name => name === 'sec-gpc' ? (gpc ? '1' : null) : name === 'user-agent' ? 'Mozilla/5.0\r\n' + 'X'.repeat(1100) : 'https://rwnak.test' }, nextUrl: new URL('https://rwnak.test/api/checkout') }
  assert.equal((await route.POST(req)).status, 200)
  assert.equal(inserted.client_user_agent.length, 1024)
  assert(!/[\r\n]/.test(inserted.client_user_agent))
  assert.equal(inserted.purchase_id, 'test-purchase')
  assert.equal(attributionInserted, undefined)
  sourceEnabled = true
  assert.equal((await route.POST(req)).status, 200)
  assert.equal(attributionInserted.medium, 'paid_social')
  assert.equal(attributionInserted.account_id, 'test-account')
  assert.equal(attributionInserted.consent_id, 'test-consent')
  attributionInserted = null
  inserted = null; granted = false
  assert.equal((await route.POST(req)).status, 200)
  assert.equal(inserted, null, 'no receipt without consent')
  assert.equal(attributionInserted, null, 'no source attribution without consent')
  granted = true; gpc = true
  assert.equal((await route.POST(req)).status, 200)
  assert.equal(inserted, null, 'GPC suppresses metadata')
  assert.equal(attributionInserted, null, 'GPC suppresses source attribution')
  const revoke = load('src/app/api/snap-consent/route.ts')
  assert.equal((await revoke.DELETE(req)).status, 204)
  assert.equal(revoked.client_user_agent, null)
  assert.equal(revoked.sc_click_id, null)
  assert.equal(revoked.sc_cookie1, null)
  assert.equal(attributionDeleted, true, 'withdrawal removes source attribution')
  console.log('PASS: checkout metadata is consent-only, bounded, GPC-aware, and cleared on revocation')
})().catch(error => { console.error(error); process.exitCode = 1 })
