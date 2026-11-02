const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync('src/lib/public-supabase.ts','utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText
function load(browser) {
  const calls = []
  const mod = {exports:{}}
  vm.runInNewContext(source, {exports:mod.exports,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test'}},...(browser?{window:{}}:{}),require(name){
    assert.equal(name,'@supabase/supabase-js')
    return {createClient(url,key,options){const client={url,key,options};calls.push(client);return client}}
  }})
  return {get:mod.exports.getPublicSupabase,calls}
}
const browser = load(true)
assert.equal(browser.get(),browser.get(),'browser copy reads reuse a single isolated client')
assert.equal(browser.calls.length,1)
const auth = browser.calls[0].options.auth
assert.equal(auth.storageKey,'rwnak-public-content')
for(const option of ['persistSession','autoRefreshToken','detectSessionInUrl']) assert.equal(auth[option],false)
const server = load(false)
assert.notEqual(server.get(),server.get(),'server requests must not share a mutable client')
console.log('PASS: isolated public auth storage, browser reuse, disabled session persistence and per-request server clients')
