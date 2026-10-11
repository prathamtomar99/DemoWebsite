import { test } from 'node:test'
import assert from 'node:assert/strict'
// Node's TS runner needs explicit extensions for imported project modules.
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/components/hero/frame-transport.ts', import.meta.url), 'utf8')
const { stripTypeScriptTypes } = await import('node:module')
const js = stripTypeScriptTypes(source.replace("from './manifest'", `from '${new URL('../src/components/hero/manifest.ts', import.meta.url).href}'`))
const { FrameTransport, connectionAllowsWarmup } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const manifest={frameCount:4,filenamePattern:'/frames/v2/desktop/frame_%04d.webp'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))

test('warmup respects constrained connections',()=>{
  for(const c of [{saveData:true},{effectiveType:'3g'},{downlink:1},{rtt:300}])assert.equal(connectionAllowsWarmup(c),false)
  assert.equal(connectionAllowsWarmup(),true)
  assert.equal(connectionAllowsWarmup({effectiveType:'4g',downlink:10,rtt:50}),true)
})
test('shared transport promotes warm request, bounds concurrency, releases blobs and cleans up',async()=>{
  const original=globalThis.fetch,requests=[],releases=[];let active=0,peak=0
  globalThis.fetch=(url,{signal})=>new Promise((resolve,reject)=>{
    requests.push(url);active++;peak=Math.max(peak,active)
    let done=false
    const finish=()=>{if(done)return;done=true;active--;resolve(new Response('webp'))}
    releases.push(finish)
    signal.addEventListener('abort',()=>{if(done)return;done=true;active--;reject(new DOMException('Aborted','AbortError'))},{once:true})
  })
  const counts=[],pool=new FrameTransport(manifest,n=>counts.push(n))
  try {
    pool.warm(true);await sleep(40)
    const a=pool.read(0,new AbortController().signal),b=pool.read(0,new AbortController().signal)
    assert.equal(requests.length,1,'visible request duplicated active warmup')
    releases[0]();assert.equal(await (await a).text(),'webp');await b;await sleep(5)
    pool.warm(false)
    const controller=new AbortController(),failed=pool.read(2,controller.signal)
    controller.abort();await assert.rejects(failed,{name:'AbortError'})
    await sleep(5)
    const next=pool.read(3,new AbortController().signal);pool.dispose();await assert.rejects(next,{name:'AbortError'})
    await sleep(50);assert.equal(active,0);assert.ok(peak<=2);assert.deepEqual(counts,[1])
    const size=requests.length;await sleep(50);assert.equal(requests.length,size)
  } finally {pool.dispose();globalThis.fetch=original}
})
test('failed background file does not loop, foreground retry remains available',async()=>{
  const original=globalThis.fetch;let calls=0
  globalThis.fetch=async()=>{calls++;return new Response('',{status:404})}
  const pool=new FrameTransport({...manifest,frameCount:1},()=>{})
  try {pool.warm(true);await sleep(100);assert.equal(calls,1);await assert.rejects(pool.read(0,new AbortController().signal));assert.equal(calls,2)}
  finally {pool.dispose();globalThis.fetch=original}
})
test('observed repeat transfer stops speculation while preserving demand loading',async()=>{
  const originalFetch=globalThis.fetch,originalLocation=globalThis.location,originalEntries=performance.getEntriesByName
  let calls=0
  globalThis.location={href:'http://localhost/'}
  globalThis.fetch=async()=>{calls++;return new Response('frame')}
  performance.getEntriesByName=()=>[{startTime:performance.now(),transferSize:100}]
  const pool=new FrameTransport(manifest,()=>{})
  try {
    await pool.read(0,new AbortController().signal)
    await pool.read(0,new AbortController().signal);await sleep(5)
    pool.warm(true);await sleep(80);assert.equal(calls,2,'Refetching browser kept warming')
    await pool.read(1,new AbortController().signal);assert.equal(calls,3,'Fallback lost demand loader')
  }finally{pool.dispose();globalThis.fetch=originalFetch;globalThis.location=originalLocation;performance.getEntriesByName=originalEntries}
})
