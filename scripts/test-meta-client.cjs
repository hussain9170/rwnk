// Offline behavioural tests: no real Meta hits, credentials or purchases.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync('src/lib/meta-client.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const frameScript = fs.readFileSync('public/meta-purchase-frame.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]

function fixture(storage = new Map()) {
  const frames = [], listeners = new Set(), timers = new Map()
  let nextTimer = 0
  const window = {
    location: { href: 'https://www.rwnak.net/checkout?lang=ur', origin: 'https://www.rwnak.net' }, navigator: {},
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    sessionStorage: { getItem: key => session.get(key), setItem: (key, value) => session.set(key, value) },
    addEventListener: (name, fn) => listeners.add(fn), removeEventListener: (name, fn) => listeners.delete(fn),
  }
  const session = new Map()
  const document = { referrer: 'https://www.rwnak.net/',
    createElement: tag => {
      assert.equal(tag, 'iframe')
      return { attributes: {}, messages: [], setAttribute(key, value) { this.attributes[key] = value },
        contentWindow: { postMessage(data, origin) { frames.at(-1).messages.push({ data, origin }) } },
        remove() { this.removed = true } }
    }, body: { appendChild(frame) { frames.push(frame) } },
  }
  const exports = {}
  vm.runInNewContext(code, { exports, window, document, URL, setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer }, clearTimeout: id => timers.delete(id) })
  const message = (frame, data, origin = 'null', source = frame.contentWindow) => {
    for (const fn of [...listeners]) fn({ source, origin, data })
  }
  return { exports, window, document, frames, storage, message, timers }
}

const f = fixture()
const { isPublicMetaUrl, trackMetaViewContent, trackMetaCheckout, metaTracker } = f.exports
for (const url of ['/', '/checkout?lang=ar', '/checkout?lang=ur', '/checkout?lang=si', '/?fbclid=abc-123']) assert(isPublicMetaUrl(url), url)
for (const url of ['/success?purchaseId=secret&access=secret', '/account', '/api/download', '/%61dmin', '/checkout?email=a@example.com', '/checkout?access=secret', '/?fbclid=a@example.com', '/checkout#secret', '/%E0%A4%A']) assert.equal(isPublicMetaUrl(url), false, url)
trackMetaViewContent('KWD', 5, 'rwnak-guide')
trackMetaCheckout('KWD', 5, 'rwnak-guide')
const q = f.window.fbq.queue
assert.equal(q.filter(row => row[0] === 'init').length, 1)
assert.equal(q[2][2], 'ViewContent'); assert.equal(q[3][2], 'InitiateCheckout')
assert.equal(q[3][3].currency, 'KWD'); assert.equal(q[3][3].value, 5)
trackMetaCheckout('KWD', NaN, 'rwnak-guide'); trackMetaCheckout('kwd', 5, 'rwnak-guide'); trackMetaViewContent('KWD', 5, 'email@example.com')
assert.equal(q.length, 4, 'malformed commerce payloads cannot be queued')
f.document.referrer = 'https://www.rwnak.net/success?access=secret'
assert.equal(metaTracker(), null)
f.document.referrer = ''; f.window.navigator.globalPrivacyControl = true
assert.equal(metaTracker(), null, 'GPC gates new events even after initialization')

const p = fixture()
const paid = { status: 'completed', tracking_id: 'RWNAK-123', amount: 5, currency: 'KWD', product_id: 'rwnak-guide', created_at: new Date().toISOString(), email: 'private@example.test', access: 'private-access' }
p.exports.trackMetaPurchase(paid)
assert.equal(p.frames.length, 0, 'opening an old receipt without starting checkout must not manufacture a new sale')
p.exports.trackMetaCheckout('KWD', 5, 'rwnak-guide')
p.window.location.href = 'https://www.rwnak.net/success?purchaseId=private-id&access=private-access'
p.document.referrer = 'https://gateway.test/payment?secret=gateway-secret'
p.exports.trackMetaPurchase({ ...paid, created_at: '2026-01-01T00:00:00Z' })
assert.equal(p.frames.length, 0, 'an unrelated historical receipt is excluded even after a new checkout')
for (const status of ['pending', 'failed', 'refunded']) p.exports.trackMetaPurchase({ ...paid, status })
assert.equal(p.frames.length, 0, 'noncompleted payments never load the SDK or send Purchase')
p.exports.trackMetaPurchase(paid); p.exports.trackMetaPurchase(paid)
assert.equal(p.frames.length, 1, 'concurrent effects cannot create duplicate sends')
const frame = p.frames[0]
assert.equal(frame.src, '/meta-purchase-frame.html'); assert.equal(frame.referrerPolicy, 'no-referrer')
assert.equal(frame.attributes.sandbox, 'allow-scripts', 'third-party code must not gain same-origin access to receipt URL')
p.message(frame, { type: 'rwnak-meta-ready' }, 'https://evil.test')
p.message(frame, { type: 'rwnak-meta-ready' }, 'null', {})
assert.equal(frame.messages.length, 0, 'spoofed ready messages rejected')
p.message(frame, { type: 'rwnak-meta-ready' })
const payload = frame.messages[0].data
assert(!JSON.stringify(payload).includes('private'))
assert.equal(payload.properties.value, 5)
assert.equal(p.storage.size, 0, 'sending the bridge payload alone is not acknowledged delivery')

const childMessages = [], scripts = [], calls = []
let receive
const parent = { postMessage: (data, origin) => childMessages.push({ data, origin }) }
const child = { parent, location: { href: 'https://www.rwnak.net/meta-purchase-frame.html' }, addEventListener: (name, fn) => { receive = fn } }
const childDoc = { createElement: () => ({}), head: { appendChild: script => scripts.push(script) } }
vm.runInNewContext(frameScript, { window: child, document: childDoc, URL })
receive({ origin: 'https://evil.test', source: parent, data: payload })
receive({ origin: 'https://www.rwnak.net', source: {}, data: payload })
assert.equal(scripts.length, 0, 'foreign origins/sibling frames cannot inject purchase events')
receive({ origin: 'https://www.rwnak.net', source: parent, data: { ...payload, properties: { ...payload.properties, value: '5' } } })
assert.equal(scripts.length, 0, 'invalid values rejected before downloading SDK')
receive({ origin: 'https://www.rwnak.net', source: parent, data: { ...payload, properties: { ...payload.properties, email: 'secret@example.test', access: 'private-access' } } })
assert.equal(scripts.length, 1)
assert.equal(childMessages.length, 1, 'no success acknowledgement before SDK readiness')
scripts[0].onload()
assert.equal(childMessages.length, 1, 'blocked SDK is not marked dispatched')
child.fbq.callMethod = (...args) => calls.push(args)
scripts[0].onload()
assert.equal(calls[0][2], 'Purchase')
assert.equal(calls[0][3].value, 5); assert.equal(calls[0][3].currency, 'KWD')
assert.equal(calls[0][4].eventID, payload.eventId)
assert(!JSON.stringify(calls).includes('private')); assert(!JSON.stringify(calls).includes('secret'))
receive({ origin: 'https://www.rwnak.net', source: parent, data: payload })
assert.equal(scripts.length, 1, 'repeated parent messages are ignored')
p.message(frame, childMessages[1].data)
assert.equal(p.storage.size, 1)
p.exports.trackMetaPurchase(paid)
assert.equal(p.frames.length, 1)
const reloaded = fixture(p.storage)
reloaded.exports.trackMetaPurchase(paid)
assert.equal(reloaded.frames.length, 0, 'refresh/email reopens preserve the independent Meta guard')
const blocked = fixture()
blocked.window.navigator.globalPrivacyControl = true
blocked.exports.trackMetaPurchase(paid)
assert.equal(blocked.frames.length, 0)
const timeout = fixture()
timeout.exports.trackMetaCheckout('KWD', 5, 'rwnak-guide')
timeout.exports.trackMetaPurchase(paid)
for (const fn of [...timeout.timers.values()]) fn()
assert.equal(timeout.storage.size, 0)
timeout.exports.trackMetaPurchase(paid)
assert.equal(timeout.frames.length, 2, 'unacknowledged/blocked sends remain retryable')
console.log('PASS: conversion values, language URLs, completed-only Purchase, sandbox boundary, message authentication, SDK readiness, independent deduplication and blocked-send retry')
