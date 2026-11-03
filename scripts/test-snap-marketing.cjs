const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const crypto = require('node:crypto')
const { NextRequest, NextResponse } = require('next/server')

process.env.SNAP_MARKETING_TOKEN_KEY = crypto.randomBytes(32).toString('hex')
process.env.SNAP_MARKETING_CLIENT_ID = 'test-client'
process.env.SNAP_MARKETING_CLIENT_SECRET = 'test-secret'
let fetchImpl, authAllowed = true, rowExists = true, consumed = false, exchangeCalls = 0, saveCalls = 0
let currentConnection, leaseAvailable = true, lastUpdate, updatedRow, fetchCalls = []
const db = { from(table) {
  let operation, fields
  const chain = {
    select() { return chain }, eq() { return chain }, gt() { return chain }, lt() { return chain }, or() { return chain },
    delete() { operation = 'delete'; return chain },
    update(value) { operation = 'update'; fields = value; lastUpdate = value; return chain },
    insert() { return Promise.resolve({ error: null }) },
    upsert() { return Promise.resolve({ error: null }) },
    async maybeSingle() {
      if (table === 'snap_marketing_oauth_states') {
        if (!rowExists || consumed) return { data: null, error: null }
        consumed = true
        return { data: { state_hash: 'test' }, error: null }
      }
      if (operation === 'update') {
        if ('refresh_lock_until' in fields && Object.keys(fields).length === 1 && fields.refresh_lock_until) {
          return { data: leaseAvailable ? { organization_id: 'test' } : null, error: null }
        }
        updatedRow = fields
        return { data: { organization_id: 'test' }, error: null }
      }
      return { data: currentConnection, error: null }
    },
    then(resolve) { resolve({ error: null }) },
  }
  return chain
} }

function load(file, overrides = {}) {
  const mod = { exports: {} }
  const deps = {
    'node:crypto': crypto, 'next/server': { NextRequest, NextResponse },
    '@/lib/admin-db': { getAdminDb: () => db },
    '@/lib/admin-auth': { requireAdmin: async (req, roles) => {
      assert.deepEqual(Array.from(roles), ['super_admin'])
      return authAllowed ? { user: { id: 'test-admin' }, error: null } : { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    } },
    ...overrides,
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports: mod.exports, require: name => { assert(name in deps, name); return deps[name] }, process, Buffer, URL, URLSearchParams, Date, AbortSignal,
      fetch: (...args) => { fetchCalls.push(args); return fetchImpl(...args) }, console })
  return mod.exports
}
const c = load('src/lib/snap-marketing-crypto.ts')
const deps = { '@/lib/snap-marketing-crypto': c }
const marketing = load('src/lib/snap-marketing.ts', deps)

async function run() {
  const secret = { access_token: 'access-very-private', refresh_token: 'refresh-very-private' }
  const encrypted = c.encryptSnapTokens(secret)
  assert(!encrypted.includes(secret.access_token))
  assert.deepEqual(JSON.parse(JSON.stringify(c.decryptSnapTokens(encrypted))), secret)
  assert.notEqual(c.encryptSnapTokens(secret), encrypted, 'fresh encryption nonce')
  const parts = encrypted.split('.')
  parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1)
  assert.throws(() => c.decryptSnapTokens(parts.join('.')), 'reject tampering')
  const key = process.env.SNAP_MARKETING_TOKEN_KEY
  process.env.SNAP_MARKETING_TOKEN_KEY = crypto.randomBytes(32).toString('hex')
  assert.throws(() => c.decryptSnapTokens(encrypted), 'wrong key must fail closed')
  process.env.SNAP_MARKETING_TOKEN_KEY = key
  assert.equal(c.matchesSnapState('a'.repeat(64), 'a'.repeat(64)), true)
  for (const state of [null, 'short', 'b'.repeat(64), 'a'.repeat(65)]) assert.equal(c.matchesSnapState(state, 'a'.repeat(64)), false)

  fetchImpl = async (url, options) => {
    const body = options.body
    assert.equal(url, 'https://accounts.snapchat.com/login/oauth2/access_token')
    assert.equal(body.get('redirect_uri'), c.SNAP_MARKETING_CALLBACK)
    assert.equal(body.get('client_secret'), 'test-secret')
    return Response.json({ access_token: 'next-access', expires_in: 3600, token_type: 'Bearer' })
  }
  await assert.rejects(marketing.exchangeSnapTokens({ grant_type: 'authorization_code', code: 'fake' }), /Invalid Snap token/)
  const refreshed = await marketing.exchangeSnapTokens({ grant_type: 'refresh_token' }, 'previous-refresh')
  assert.equal(refreshed.refresh_token, 'previous-refresh', 'keep refresh token when provider omits rotation')
  fetchImpl = async () => Response.json({ access_token: 'a', refresh_token: 'r', expires_in: -1 })
  await assert.rejects(marketing.exchangeSnapTokens({}), /Invalid Snap token/)
  fetchImpl = async () => Response.json({ error: 'do-not-leak-provider-details' }, { status: 400 })
  await assert.rejects(marketing.exchangeSnapTokens({}), error => !error.message.includes('do-not-leak'))

  fetchImpl = async () => Response.json({ request_status: 'SUCCESS', adaccounts: [], paging: { next_link: 'https://evil.test/steal' } })
  await assert.rejects(marketing.listSnapAdAccounts('fake-access'), /Invalid Snap pagination/)
  fetchImpl = async () => Response.json({ request_status: 'SUCCESS', adaccounts: [{ sub_request_status: 'SUCCESS', adaccount: { id: '1', name: 'RWNAK', organization_id: c.SNAP_MARKETING_ORG } }] })
  assert.equal((await marketing.listSnapAdAccounts('fake-access'))[0].name, 'RWNAK')
  fetchImpl = async () => Response.json({ request_status: 'SUCCESS', adaccounts: [{ sub_request_status: 'SUCCESS', adaccount: { id: '1', organization_id: 'other-org' } }] })
  await assert.rejects(marketing.listSnapAdAccounts('fake-access'), /Unexpected Snap organisation/)

  currentConnection = { version: 'v1', token_ciphertext: c.encryptSnapTokens({ ...secret, expires_at: Date.now() + 300_000 }) }
  assert.equal(await marketing.getSnapAccessToken(), secret.access_token)
  currentConnection.token_ciphertext = c.encryptSnapTokens({ ...secret, expires_at: 0 })
  leaseAvailable = false
  await assert.rejects(marketing.getSnapAccessToken(), /refresh in progress/)
  leaseAvailable = true
  fetchImpl = async () => Response.json({ access_token: 'new-access', refresh_token: 'rotated-refresh', expires_in: 3600 })
  assert.equal(await marketing.getSnapAccessToken(), 'new-access')
  assert.equal(c.decryptSnapTokens(updatedRow.token_ciphertext).refresh_token, 'rotated-refresh')
  assert.equal(updatedRow.refresh_lock_until, null)
  fetchImpl = async () => Response.json({}, { status: 401 })
  await assert.rejects(marketing.getSnapAccessToken(), /refresh failed/)
  assert.equal(lastUpdate.refresh_lock_until, null, 'release failed refresh lease')

  const callback = load('src/app/api/integrations/snapchat/callback/route.ts', { ...deps,
    '@/lib/snap-marketing': {
      exchangeSnapTokens: async () => { exchangeCalls++; return secret },
      listSnapAdAccounts: async () => [], saveSnapConnection: async () => { saveCalls++ },
    },
  })
  const state = 'a'.repeat(64)
  function req(returnedState = state, cookieState = state) {
    return new NextRequest(`${c.SNAP_MARKETING_CALLBACK}?state=${returnedState}&code=fake-code`, { headers: { cookie: `${c.SNAP_MARKETING_COOKIE}=${cookieState}` } })
  }
  authAllowed = false
  assert.equal((await callback.GET(req())).status, 401)
  authAllowed = true
  assert.match((await callback.GET(req('b'.repeat(64)))).headers.get('location'), /invalid_state/)
  assert.equal(exchangeCalls, 0)
  rowExists = false
  assert.match((await callback.GET(req())).headers.get('location'), /expired_state/)
  rowExists = true; consumed = false
  const success = await callback.GET(req())
  assert.match(success.headers.get('location'), /result=connected/)
  assert.equal(success.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(success.headers.get('cache-control'), 'no-store')
  assert.equal(saveCalls, 1)
  assert.match((await callback.GET(req())).headers.get('location'), /expired_state/)
  assert.equal(exchangeCalls, 1, 'replay cannot exchange token a second time')

  const connect = load('src/app/api/admin/integrations/snapchat/connect/route.ts', deps)
  const startURL = `${c.SNAP_MARKETING_ORIGIN}/api/admin/integrations/snapchat/connect`
  assert.equal((await connect.POST(new NextRequest(startURL, { method: 'POST', headers: { origin: 'https://evil.test' } }))).status, 403)
  const start = await connect.POST(new NextRequest(startURL, { method: 'POST', headers: { origin: c.SNAP_MARKETING_ORIGIN } }))
  assert.equal(start.status, 303)
  const destination = new URL(start.headers.get('location'))
  assert.equal(destination.origin, 'https://accounts.snapchat.com')
  assert.equal(destination.searchParams.get('scope'), 'snapchat-marketing-api')
  assert(!destination.searchParams.has('client_secret'))
  assert.match(start.headers.get('set-cookie'), /HttpOnly/)
  assert.match(start.headers.get('set-cookie'), /Secure/)
  console.log('PASS: encrypted tokens, tamper rejection, OAuth state/session/CSRF/replay gates, refresh leases and rotation, account scoping, safe failures')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
