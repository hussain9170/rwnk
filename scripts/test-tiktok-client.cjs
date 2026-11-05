const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const window = { location: { href: 'https://www.rwnak.net/checkout?lang=ar', origin: 'https://www.rwnak.net' } }
const document = { referrer: 'https://www.rwnak.net/' }
const mod = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/tiktok-client.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: mod.exports, window, document, URL, Date })
const { isPublicTikTokUrl, tiktokTracker, trackTikTokCheckout, TIKTOK_PIXEL_CODE } = mod.exports
for (const url of ['/', '/checkout?lang=ar', '/checkout?lang=si', '/?ttclid=abc-123', '/?utm_source=tiktok', '/privacy']) assert.equal(isPublicTikTokUrl(url), true, url)
for (const url of ['/success?purchaseId=secret&access=secret', '/account', '/login', '/api/purchase-status', '/newsletter/confirm?token=secret', '/checkout?access=secret', '/checkout?email=a@example.com', '/?unknown=secret', '/?ttclid=a@example.com', '/checkout#token', '/%61dmin', '/%E0%A4%A']) assert.equal(isPublicTikTokUrl(url), false, url)
trackTikTokCheckout('KWD', 5)
assert.equal(window.ttq.length, 1, 'queues checkout before SDK download')
assert.equal(window.ttq[0][0], 'track')
assert.equal(window.ttq[0][1], 'InitiateCheckout')
assert.equal(window.ttq[0][2].value, 5)
assert.equal(window.ttq[0][2].currency, 'KWD')
assert.ok(window.ttq._i[TIKTOK_PIXEL_CODE])
assert.equal(tiktokTracker(), window.ttq, 'initializes only once')
window.ttq.page()
assert.equal(window.ttq[1][0], 'page')
const delivered = []
window.ttq.track = (...args) => delivered.push(args)
trackTikTokCheckout('KWD', 5)
assert.equal(delivered.length, 1)
trackTikTokCheckout('KWD', NaN); trackTikTokCheckout('KWD', -1)
assert.equal(delivered.length, 1, 'invalid amounts do not fire')
document.referrer = 'https://www.rwnak.net/success?access=secret'
trackTikTokCheckout('KWD', 5)
assert.equal(delivered.length, 1, 'private referrer blocks events')
document.referrer = ''; window.location.href = 'https://www.rwnak.net/checkout?access=secret'
trackTikTokCheckout('KWD', 5)
assert.equal(delivered.length, 1, 'private URL blocks events')
assert.ok(!JSON.stringify(window.ttq).includes('secret'))
console.log('PASS: private URLs/referrers excluded, single initialization, SDK queue, KWD checkout values, no private data')
