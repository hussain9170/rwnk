// Build/start the real Next app against a local, read-only public-data fixture.
// No live database, email, credentials or payment provider is used.
// The resulting .next output is test-only: deploy by rebuilding with real env.
const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs')
const { spawn } = require('node:child_process')

async function main() {
  const state = { price:5, badge:'cache-fixture-before', languages:[{id:'fixture-ar',language_code:'ar',name_ar:'العربية',name_en:'Arabic',is_active:true,sort_order:0,file_path:'fixture.pdf'}], reads:[] }
  const db = http.createServer((req,res) => {
    const table = new URL(req.url,'http://localhost').pathname.split('/').pop()
    state.reads.push(table)
    res.setHeader('content-type','application/json')
    const rows = table === 'store_settings' ? [{product_price:state.price,product_original_price:12,hero_badge:state.badge,testimonials_visible:false}]
      : table === 'book_languages' ? state.languages : []
    res.end(JSON.stringify(rows))
  })
  await new Promise(resolve => db.listen(0,'127.0.0.1',resolve))
  const portProbe = http.createServer()
  await new Promise(resolve => portProbe.listen(0,'127.0.0.1',resolve))
  const appPort = portProbe.address().port
  await new Promise(resolve => portProbe.close(resolve))
  const env = {...process.env,NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${db.address().port}`,NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-fixture',NEXT_TELEMETRY_DISABLED:'1'}
  const log = fs.openSync('/tmp/rwnak-homepage-cache-next.log','w')
  let app
  try {
    const build = spawn(process.execPath,['node_modules/next/dist/bin/next','build','--webpack'],{env,stdio:['ignore',log,log]})
    assert.equal(await new Promise(resolve => build.on('exit',resolve)),0,'fixture production build must pass (see /tmp/rwnak-homepage-cache-next.log)')
    const manifest = JSON.parse(fs.readFileSync('.next/prerender-manifest.json','utf8'))
    assert.equal(manifest.routes['/'].initialRevalidateSeconds,300,'homepage must be ISR, not request-rendered')
    app = spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(appPort)],{env,stdio:['ignore',log,log]})
    const url = `http://127.0.0.1:${appPort}`
    for(let attempt=0;attempt<50;attempt++) {
      try { const ready=await fetch(`${url}/robots.txt`); if(ready.ok) break } catch {}
      await new Promise(resolve=>setTimeout(resolve,100))
    }
    state.reads=[]
    const first = await fetch(url)
    const html = await first.text()
    assert.equal(first.status,200)
    assert.equal(first.headers.get('x-nextjs-cache'),'HIT')
    assert(html.includes('cache-fixture-before'))
    assert(!first.headers.has('set-cookie'),'shared output must never contain a customer session')
    assert.deepEqual(state.reads,[],'a warm homepage must not wait for database reads')
    state.price=9; state.badge='cache-fixture-after'
    state.languages=[{id:'fixture-en',language_code:'en',name_ar:'الإنجليزية',name_en:'English',is_active:true,sort_order:0,file_path:'english.pdf'}]
    const cached=await (await fetch(url)).text()
    assert(cached.includes('cache-fixture-before') && !cached.includes('cache-fixture-after'))
    assert.deepEqual(state.reads,[],'repeat visits reuse cached public HTML')
    const checkout = await fetch(`${url}/checkout?lang=ar`)
    const checkoutHtml = await checkout.text()
    assert.equal(checkout.status,200)
    assert(checkoutHtml.includes('٩ د.ك'),'checkout must show the new live price while homepage is cached')
    assert(checkoutHtml.includes('English'))
    assert(!checkoutHtml.includes('aria-checked="true"'),'disabled Arabic cannot be preselected from an old homepage link')
    assert(state.reads.includes('store_settings') && state.reads.includes('book_languages'))
    assert.match(checkout.headers.get('cache-control'),/no-store/)
    console.log('PASS: real ISR build, cached homepage without database reads or session cookies; checkout reads current price/language independently')
  } finally {
    if(app) { app.kill(); await new Promise(resolve=>app.once('exit',resolve)) }
    await new Promise(resolve=>db.close(resolve))
    fs.closeSync(log)
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
