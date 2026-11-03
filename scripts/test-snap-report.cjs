const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { NextRequest, NextResponse } = require('next/server')
function load(file, deps = {}, extra = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports: mod.exports, require: name => { assert(name in deps, name); return deps[name] }, Date, URL, URLSearchParams, Number, Object, JSON, AbortSignal, Buffer, console, ...extra })
  return mod.exports
}
const math = load('src/lib/snap-report-math.ts')
const attribution = load('src/lib/snap-attribution.ts')
const account = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'rwnak website', currency: 'USD', timezone: 'Asia/Kuwait' }
const otherAccount = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const now = Date.parse('2026-11-03T21:10:00Z')
assert.equal(math.snapReportRange(7, new Date(now)).end, '2026-11-03T21:00:00.000Z')
assert.equal(math.snapReportRange(7, new Date(now)).start, '2026-10-27T21:00:00.000Z')
assert.equal(math.snapReportRange(1, new Date('2026-11-03T20:59:00Z')).end, '2026-11-02T21:00:00.000Z')
assert.throws(() => math.snapReportRange(400))
const metric = math.parseSnapMetrics({ spend: 20_000_000, conversion_purchases_value: 15_000_000, conversion_purchases: 3, impressions: 1000, swipes: 10 })
assert.equal(math.snapMetricAmounts(metric).spend, 20)
assert.equal(math.snapMetricAmounts(metric).purchaseValue, 15)
assert.equal(math.snapMetricAmounts(metric).roas, .75)
assert.equal(math.snapMetricAmounts(math.parseSnapMetrics({ spend: 0, conversion_purchases: 0 })).costPerPurchase, null)
assert.equal(math.parseSnapMetrics({}).conversion_purchases, null, 'missing metrics are not fabricated as zero')
for (const invalid of [-1, Infinity, 'oops', true, 1.5]) assert.throws(() => math.parseSnapMetrics({ spend: invalid }))
assert.equal(math.observedSnapMargin(5, 10, 2, 20, 'USD', 7, math.EMPTY_SNAP_COSTS).estimateKwd, null)
const costs = { usd_kwd_rate: .3, payment_fee_percent: 1, payment_fee_fixed_kwd: .1, operating_cost_kwd_daily: .2 }
assert(Math.abs(math.observedSnapMargin(5, 10, 2, 20, 'USD', 7, costs).estimateKwd - -2.7) < 1e-8)
assert.equal(math.observedSnapMargin(5, 10, 2, 20, 'EUR', 7, costs).estimateKwd, null, 'never combine unsupported currencies')
assert.throws(() => math.validateSnapCosts({ ...costs, usd_kwd_rate: 0 }))
assert.throws(() => math.validateSnapCosts({ ...costs, payment_fee_percent: 101 }))
assert.equal(math.validateSnapCosts(math.EMPTY_SNAP_COSTS).usd_kwd_rate, null)

const landing = `https://www.rwnak.net/?utm_source=snapchat&utm_medium=paid_social&utm_campaign=test_01&utm_content=ad_1&utm_term=${account.id}`
const tag = attribution.snapAttributionFromUrl(landing, now)
assert.equal(tag.account, account.id)
assert.equal(tag.medium, 'paid_social')
assert.equal(attribution.snapAttributionFromUrl('https://www.rwnak.net/', now), undefined)
assert.equal(attribution.snapAttributionFromUrl('https://www.rwnak.net/?utm_source=google', now), null)
assert.equal(attribution.snapAttributionFromUrl('https://www.rwnak.net/?utm_source=snapchat', now).medium, 'organic')
assert.equal(attribution.snapAttributionFromUrl('https://www.rwnak.net/?utm_source=snapchat&utm_campaign=secret@example.com', now).campaign, null)
assert(attribution.parseSnapAttribution(encodeURIComponent(JSON.stringify(tag)), now))
assert.equal(attribution.parseSnapAttribution(encodeURIComponent(JSON.stringify(tag)), now + 31 * 86400000), null)
assert.equal(attribution.parseSnapAttribution(encodeURIComponent(JSON.stringify(tag)), now - 1), null)
assert.equal(attribution.parseSnapAttribution('%zz', now), null)

let snapshot, authorized = true, calls = [], origins = [], failSnap = false
const sales = [
  { amount: 5, currency: 'KWD', status: 'completed', purchase_marketing_attribution: { account_id: account.id, medium: 'paid_social' } },
  { amount: 5, currency: 'KWD', status: 'completed', purchase_marketing_attribution: null },
  { amount: 5, currency: 'KWD', status: 'refunded', purchase_marketing_attribution: { account_id: account.id, medium: 'paid_social' } },
  { amount: 10, currency: 'KWD', status: 'completed', purchase_marketing_attribution: { account_id: otherAccount, medium: 'paid_social' } },
  { amount: 15, currency: 'USD', status: 'completed', purchase_marketing_attribution: { account_id: account.id, medium: 'paid_social' } },
]
const db = { from(table) {
  const chain = { select(fields) { if (table === 'purchases') assert(!fields.includes('email')); return chain },
    eq() { return chain }, in() { return chain }, order() { return chain },
    gte(key) { if (table === 'purchases') assert.equal(key, 'paid_at'); return chain },
    lt(key) { if (table === 'purchases') assert.equal(key, 'paid_at'); return chain },
    limit() { return chain }, async range() { return { data: sales, error: null } },
    async maybeSingle() { return { data: table === 'snap_reporting_settings' ? costs : { product_name: 'رونق', product_price: 5, product_currency: 'KWD' }, error: null } },
    async upsert(value) { snapshot = value; return { error: null } },
    then(resolve) { resolve({ data: [], error: null }) },
  }; return chain
} }
const deps = {
  '@/lib/admin-db': { getAdminDb: () => db },
  '@/lib/snap-marketing': { getSnapAccessToken: async () => 'private-test-token', listSnapAdAccounts: async () => [account] },
  '@/lib/snap-marketing-crypto': { SNAP_MARKETING_ORG: 'org' },
  '@/lib/snap-report-math': math,
}
const server = load('src/lib/snap-report.ts', deps, { fetch: async (url, options) => {
  calls.push(url.toString()); const parsed = new URL(url); origins.push(parsed.origin)
  assert.equal(options.headers.Authorization, 'Bearer private-test-token')
  if (failSnap) return Response.json({}, { status: 403 })
  if (parsed.pathname.endsWith('/campaigns')) return Response.json({ request_status: 'SUCCESS', campaigns: [{ campaign: { id: 'campaign1', name: 'Test campaign' } }] })
  assert.equal(parsed.searchParams.get('action_report_time'), 'conversion')
  assert.equal(parsed.searchParams.get('swipe_up_attribution_window'), '7_DAY')
  assert.equal(parsed.searchParams.get('view_attribution_window'), '1_DAY')
  assert(!parsed.searchParams.has('test'), 'never request fake API statistics')
  const stats = { spend: 20000000, conversion_purchases: 3, conversion_purchases_value: 15000000, impressions: 1000, swipes: 10 }
  return Response.json({ request_status: 'SUCCESS', total_stats: [{ sub_request_status: 'SUCCESS', total_stat: { id: account.id,
    ...(parsed.searchParams.has('breakdown') ? { breakdown_stats: { campaign: [{ id: 'campaign1', stats }] } } : { stats }) } }] })
} })

async function run() {
  const report = await server.buildSnapReport(7)
  assert.equal(report.amounts.spend, 20)
  assert.equal(report.campaigns[0].name, 'Test campaign')
  assert.equal(report.website.sitePaidOrders, 4)
  assert.equal(report.website.siteRevenue.KWD, 20)
  assert.equal(report.website.siteRevenue.USD, 15)
  assert.equal(report.website.taggedOrders, 1, 'exclude untagged, other-account, refunded and other-currency orders')
  assert.equal(report.website.taggedRevenueKwd, 5)
  assert.equal(report.website.taggedRefundsKwd, 5)
  assert.equal(report.website.taggedGrossKwd, 10)
  assert.equal(report.verification.verified, false)
  assert(!JSON.stringify(snapshot).includes('private-test-token'))
  assert.equal(snapshot.period_days, 7)
  assert.equal(snapshot.account_id, account.id)
  await assert.rejects(server.buildSnapReport(7, otherAccount), /not available/)
  assert(origins.every(origin => origin === 'https://adsapi.snapchat.com'))
  failSnap = true
  await assert.rejects(server.buildSnapReport(7), /failed/)

  const api = load('src/app/api/admin/integrations/snapchat/report/route.ts', {
    'next/server': { NextRequest, NextResponse }, '@/lib/snap-report': server,
    '@/lib/admin-auth': { requireAdmin: async (req, roles) => { assert.equal(roles.join(','), 'super_admin'); return authorized ? { user: { id: 'admin' } } : { error: NextResponse.json({}, { status: 401 }) } } },
    '@/lib/rate-limit': { rateLimit: () => true },
  })
  authorized = false
  assert.equal((await api.GET(new NextRequest('https://www.rwnak.net/api/admin/integrations/snapchat/report'))).status, 401)
  authorized = true
  assert.equal((await api.GET(new NextRequest('https://www.rwnak.net/api/admin/integrations/snapchat/report?days=999'))).status, 400)
  assert.equal((await api.GET(new NextRequest('https://www.rwnak.net/api/admin/integrations/snapchat/report'))).status, 503)
  console.log('PASS: Kuwait day boundaries, microcurrency, missing metrics, conservative attribution, refund/account/currency isolation, safe snapshots, API authorization and provider failures')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
