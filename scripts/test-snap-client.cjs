const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
let consent = true
const window = { location: { href: 'https://www.rwnak.net/checkout?lang=ar', origin: 'https://www.rwnak.net' } }
const document = { referrer: 'https://www.rwnak.net/' }
const mod = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/snap-client.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: mod.exports, window, document, URL,
  require: name => ({ '@/lib/gtag': { ANALYTICS_QUERY_KEYS: ['utm_source'] }, '@/lib/snap-consent': { hasSnapConsent: () => consent } })[name],
})
const { isPublicPixelUrl, trackSnapCheckout, snapTracker } = mod.exports
for (const url of ['/checkout?lang=ar', '/checkout?lang=en', '/checkout?lang=si', '/checkout?lang=pt-BR', '/?utm_source=snap', '/?ScCid=11111111-1111-4111-8111-111111111111']) assert.equal(isPublicPixelUrl(url), true, url)
for (const url of ['/success', '/account/orders', '/checkout?purchaseId=private', '/checkout?access=secret', '/checkout?lang=customer@example.com', '/checkout#token', '/?ScCid=secret']) assert.equal(isPublicPixelUrl(url), false, url)
trackSnapCheckout('KWD', 5)
assert.equal(window.snaptr.queue.length, 2, 'checkout queues before SDK is ready')
assert.equal(window.snaptr.queue[0][0], 'init', 'pixel init precedes checkout')
assert.equal(window.snaptr.queue[1][1], 'START_CHECKOUT')
snapTracker()
assert.equal(window.snaptr.queue.length, 2, 'initialization is not duplicated')
const delivered = []
window.snaptr.handleRequest = (...args) => delivered.push(args)
trackSnapCheckout('KWD', 5)
assert.equal(delivered.length, 1, 'loaded SDK receives events immediately')
assert.equal(delivered[0][2].price, 5)
consent = false; trackSnapCheckout('KWD', 5)
assert.equal(delivered.length, 1, 'no event without consent')
consent = true; document.referrer = 'https://www.rwnak.net/success?access=secret'
trackSnapCheckout('KWD', 5)
assert.equal(delivered.length, 1, 'private referrer blocks tracking')
document.referrer = ''; window.location.href = 'https://www.rwnak.net/checkout?access=secret'
trackSnapCheckout('KWD', 5)
assert.equal(delivered.length, 1, 'private query blocks checkout too')
console.log('PASS: language URLs, private URL/referrer protection, consent, slow SDK checkout queue and single initialization')
