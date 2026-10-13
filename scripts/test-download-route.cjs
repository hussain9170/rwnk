// Runs the real route with mocked I/O; never contacts Storage or a database.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync('src/app/api/download/route.ts', 'utf8')
const js = ts.transpileModule(source.replace("await import('@supabase/supabase-js')", "await Promise.resolve(require('@supabase/supabase-js'))"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
async function run({ file = 'guide.pdf', signError = false, outcome = 'ok', rpcError = false, tokenUsed = false } = {}) {
  const calls = []
  const rows = {
    download_tokens: { id: 'token-id', purchase_id: 'purchase-id', user_id: null, expires_at: '2099-01-01', used_at: tokenUsed ? '2026-01-01' : null },
    purchases: { product_id: 'product-id', book_language: 'ar' },
    products: { file_path: file },
    book_languages: file ? { file_path: file } : null,
  }
  const sb = {
    from(table) {
      const q = { select() { return q }, eq() { return q },
        async single() { return { data: rows[table] } },
        async maybeSingle() { return { data: rows[table] } } }
      return q
    },
    storage: { from() { return { async createSignedUrl() {
      calls.push('sign')
      return signError ? { data: null, error: { message: 'unavailable' } } : { data: { signedUrl: 'https://storage.example/guide' } }
    } } } },
    async rpc(name) {
      assert.equal(name, 'consume_download_token')
      calls.push('consume')
      return { data: outcome, error: rpcError ? { code: 'test' } : null }
    }
  }
  const mod = { exports: {} }
  const deps = {
    'next/server': { NextResponse: { json: (body, opts) => ({ body, ...opts }), redirect: url => ({ status: 307, url }) } },
    '@/lib/env': { getSupabaseServerEnv: () => ({ url: 'mock', key: 'mock' }) },
    '@/lib/download-resolver': { resolveBookLanguageFile: (_lang, row) => ({ filePath: row?.file_path, degraded: false }) },
    '@/lib/db-resilience': { isMissingTableError: () => false },
    '@supabase/supabase-js': { createClient: () => sb }
  }
  vm.runInNewContext(js, { exports: mod.exports, require: name => deps[name], console, Date })
  const response = await mod.exports.GET({ nextUrl: new URL('https://example.test/api/download?token=example') })
  return { response, calls }
}
(async () => {
  let r = await run()
  assert.equal(r.response.status, 307)
  assert.deepEqual(r.calls, ['sign', 'consume'])
  for (const opts of [{ file: null }, { signError: true }, { tokenUsed: true }]) {
    r = await run(opts)
    assert.ok(r.response.status >= 400)
    assert.ok(!r.calls.includes('consume'), 'failed preparation must not consume quota')
  }
  for (const outcome of ['invalid_token', 'limit_reached']) {
    r = await run({ outcome })
    assert.equal(r.response.status, 403)
    assert.ok(!r.response.url)
  }
  r = await run({ rpcError: true })
  assert.equal(r.response.status, 500)
  assert.ok(!r.response.url)
  console.log('PASS: download preparation, failed Storage, missing files, used tokens, quota rejection and database failure')
})().catch(e => { console.error(e); process.exitCode = 1 })
