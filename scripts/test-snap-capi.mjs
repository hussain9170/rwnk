import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { buildSnapPurchase, flushSnapPurchases, snapOrderId } from '../src/lib/snap-capi.ts'
import { parseSnapConsent } from '../src/lib/snap-consent.ts'

const now = Date.now()
const purchase = { id: '11111111-1111-4111-8111-111111111111', status: 'completed', email: ' Customer@Example.com ', amount: 5, currency: 'KWD', paid_at: new Date(now - 1000).toISOString(), invoice_number: 'RW-TEST-1', product_id: 'book-ar' }
const receipt = { purchase_id: purchase.id, consent_id: '22222222-2222-4222-8222-222222222222', consent_version: 'snap-v1', consent_at: new Date(now - 2000).toISOString(), sc_click_id: null, sc_cookie1: null, revoked_at: null, lease_id: 'lease' }
const event = buildSnapPurchase(purchase, receipt, now)
assert.equal(event.user_data.em[0], createHash('sha256').update('customer@example.com').digest('hex'))
assert.equal(event.custom_data.value, 5)
assert.equal(event.custom_data.currency, 'KWD')
assert.equal(event.event_id, purchase.invoice_number)
assert.equal(event.custom_data.order_id, event.event_id)
assert.equal(event.event_time, Date.parse(purchase.paid_at))
assert(!JSON.stringify(event).includes('customer@example.com'))
assert(!JSON.stringify(event).includes(purchase.id))
assert(!event.event_source_url.includes('purchaseId'))
assert.notEqual(snapOrderId({ ...purchase, invoice_number: null }), purchase.id)
assert.equal(buildSnapPurchase(purchase, receipt, now).event_id, event.event_id)
for (const status of ['pending', 'failed', 'refunded']) assert.equal(buildSnapPurchase({ ...purchase, status }, receipt, now), null)
for (const paid_at of [null, 'bad', new Date(now + 1000).toISOString(), new Date(now - 7 * 86400000).toISOString()]) assert.equal(buildSnapPurchase({ ...purchase, paid_at }, receipt, now), null)
assert.equal(buildSnapPurchase(purchase, { ...receipt, revoked_at: new Date().toISOString() }, now), null)
assert.equal(buildSnapPurchase(purchase, { ...receipt, consent_at: 'bad' }, now), null)
assert.equal(buildSnapPurchase(purchase, { ...receipt, consent_at: new Date(now).toISOString() }, now), null)
assert.equal(buildSnapPurchase(purchase, { ...receipt, purchase_id: 'different' }, now), null)
assert.equal(buildSnapPurchase({ ...purchase, amount: 0 }, receipt, now), null)
const consent = `snap-v1.yes.${receipt.consent_id}.${now - 2000}`
assert.equal(parseSnapConsent(consent, now).granted, true)
assert.equal(parseSnapConsent(consent.replace('.yes.', '.no.'), now).granted, false)
assert.equal(parseSnapConsent(), null)
assert.equal(parseSnapConsent(`snap-v1.yes.${receipt.consent_id}.${now + 1}`, now), null)
assert.equal(parseSnapConsent(`snap-v1.yes.${receipt.consent_id}.${now - 181 * 86400000}`, now), null)

process.env.SNAP_CAPI_ENABLED = 'true'
process.env.SNAP_CAPI_ACCESS_TOKEN = 'local-test-only-not-a-real-token'
let leased = false, sentAt = null, revoked = null, requests = [], fail = false
const sb = {
  async rpc() { if (leased || sentAt) return { data: [], error: null }; leased = true; return { data: [receipt], error: null } },
  from(table) {
    let update
    const chain = {
      select() { return chain }, eq() { return chain },
      update(value) { update = value; return chain },
      async single() { return { data: table === 'purchases' ? purchase : { revoked_at: revoked } } },
      then(resolve) { if (update?.sent_at) sentAt = update.sent_at; resolve({ error: null }) },
    }
    return chain
  },
}
const send = async (url, init) => { requests.push(JSON.parse(init.body)); assert.equal(url.hostname, 'tr.snapchat.com'); return new Response(JSON.stringify({ status: fail ? 'INVALID' : 'VALID' }), { status: fail ? 500 : 200 }) }
await Promise.all([flushSnapPurchases(sb, purchase.id, send), flushSnapPurchases(sb, purchase.id, send)])
assert.equal(requests.length, 1, 'concurrent leased sends produce one request')
await flushSnapPurchases(sb, purchase.id, send)
assert.equal(requests.length, 1, 'sent events are skipped')
leased = false; sentAt = null; fail = true
await flushSnapPurchases(sb, purchase.id, send)
assert.equal(sentAt, null, 'failed requests remain unsent')
leased = false; fail = false
await flushSnapPurchases(sb, purchase.id, send)
assert.equal(requests[1].data[0].event_id, requests[2].data[0].event_id, 'retry keeps event ID')
assert.equal(requests[1].data[0].event_time, requests[2].data[0].event_time, 'retry keeps original payment time')
leased = false; sentAt = null; revoked = new Date().toISOString()
await flushSnapPurchases(sb, purchase.id, send)
assert.equal(requests.length, 3, 'revocation before transmission suppresses delivery')
process.env.SNAP_CAPI_ENABLED = 'false'; leased = false; revoked = null
await flushSnapPurchases(sb, purchase.id, send)
assert.equal(requests.length, 3, 'disabled integration never transmits')
console.log('PASS: Snap consent, confirmed payment, hashing, safe IDs, retries, revocation, concurrent claims and disabled mode')
