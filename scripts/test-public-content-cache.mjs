// Exercise real module code with deterministic DB/cache boundaries. No live writes.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const entries = new Map()
const rows = { faqs: [{ id: 'faq', question: 'Before' }], features: [], testimonials: [], comparison_rows: [] }
let reads = 0, failure = false
const mockCache = {
  unstable_cache(fn, keys, options) {
    assert.equal(options.revalidate, 300)
    const key = keys.join(':')
    return async () => {
      if (!entries.has(key)) {
        const value = await fn() // rejected reads must never become cached fallback
        entries.set(key, { value: structuredClone(value), tags: options.tags })
      }
      return structuredClone(entries.get(key).value)
    }
  },
  revalidateTag(tag, profile) {
    assert.equal(profile.expire, 0, 'Admin edits must block stale reads')
    for (const [key, entry] of entries) if (entry.tags.includes(tag)) entries.delete(key)
  },
}
const module = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/public-content-cache.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  module, exports: module.exports, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test' } },
  require(name) {
    if (name === 'next/cache') return mockCache
    assert.equal(name, '@supabase/supabase-js')
    return { createClient(_url, _key, options) {
      assert.equal(options.auth.persistSession, false)
      return { from(table) { return { select(columns) {
        assert.equal(columns, '*')
        return { eq(field, value) {
          assert.equal(field, 'is_active'); assert.equal(value, true)
          return { async order(field, options) {
            assert.equal(field, 'sort_order'); assert.equal(options.ascending, true)
            reads++
            return failure ? { error: { message: 'DB unavailable' } } : { data: structuredClone(rows[table]), error: null }
          } }
        } }
      } } } }
    } }
  },
})
const { getPublicList, invalidatePublicContent } = module.exports
assert.equal((await getPublicList('faqs'))[0].question, 'Before')
rows.faqs[0].question = 'After'
assert.equal((await getPublicList('faqs'))[0].question, 'Before')
assert.equal(reads, 1, 'Repeated visitors reuse the published list')
await getPublicList('features')
invalidatePublicContent('faqs')
assert.equal((await getPublicList('faqs'))[0].question, 'After', 'First visitor after admin save sees fresh data')
assert.equal((await getPublicList('features')).length, 0)
assert.equal(reads, 3, 'FAQ edit must not evict unrelated features')
rows.faqs = []; invalidatePublicContent('faqs')
assert.equal((await getPublicList('faqs')).length, 0, 'Hiding every item must not resurrect fallback content')
invalidatePublicContent('faqs'); failure = true
await assert.rejects(getPublicList('faqs'), /DB unavailable/)
failure = false; rows.faqs = [{ question: 'Recovered' }]
assert.equal((await getPublicList('faqs'))[0].question, 'Recovered', 'Transient failures must not poison cache')
const before = reads
await assert.rejects(getPublicList('purchases'), /Not a public CMS list/)
invalidatePublicContent('purchases')
assert.equal(reads, before)
console.log('Public CMS cache: reuse, immediate refresh, tag isolation, empty lists, recovery, and private-table rejection passed.')
