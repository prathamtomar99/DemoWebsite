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

test('full transport has four real slots and shares an in-flight body between waiters',async()=>{
 const original=globalThis.fetch,requests=[];let active=0,peak=0
 globalThis.fetch=async(url,{signal})=>new Response(new ReadableStream({start(controller){
  active++;peak=Math.max(peak,active)
  let settled=false
  requests.push({url,finish(){if(settled)return;settled=true;active--;controller.enqueue(new Uint8Array([1]));controller.close()}})
  signal.addEventListener('abort',()=>{if(!settled){settled=true;active--;controller.error(new DOMException('Aborted','AbortError'))}},{once:true})
 }}))
 const pool=new FrameTransport({...manifest,frameCount:8},()=>{},{concurrency:4,maxFrameBytes:262144})
 try{
  const a=pool.read(0,new AbortController().signal),shared=pool.read(0,new AbortController().signal)
  const pending=[a,shared,...[1,2,3,4,5].map(i=>pool.read(i,new AbortController().signal))]
  await sleep(5);assert.equal(requests.length,4);assert.equal(peak,4)
  requests[2].finish();await sleep(5);assert.equal(requests.length,5)
  for(let i=0;i<3;i++){requests.forEach(r=>r.finish());await sleep(5)}
  const blobs=await Promise.all(pending);assert.equal(blobs[0],blobs[1]);assert.equal(requests.length,6);assert.equal(peak,4)
 }finally{pool.dispose();globalThis.fetch=original}
})
for(const header of [undefined,'1','300000'])test(`streaming byte limit rejects oversized frames with Content-Length ${header}`,async()=>{
 const original=globalThis.fetch;let cancelled=false,pulls=0
 globalThis.fetch=async()=>new Response(new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(100000))},cancel(){cancelled=true}}),{headers:header?{'content-length':header}:{}})
 const pool=new FrameTransport(manifest,()=>{},{concurrency:4,maxFrameBytes:262144})
 try{await assert.rejects(pool.read(0,new AbortController().signal),/byte budget/);assert.ok(cancelled);assert.ok(pulls<=4,'Unbounded body consumed')}
 finally{pool.dispose();globalThis.fetch=original}
})
test('streaming body cancellation rejects shared work and releases transport admission',async()=>{
 const original=globalThis.fetch;let aborted=false
 globalThis.fetch=async(_url,{signal})=>new Response(new ReadableStream({start(controller){signal.addEventListener('abort',()=>{aborted=true;controller.error(new DOMException('Aborted','AbortError'))},{once:true})}}))
 const pool=new FrameTransport(manifest,()=>{},{concurrency:4,maxFrameBytes:262144}),controller=new AbortController()
 try{const pending=pool.read(0,controller.signal);await sleep(5);controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.ok(aborted)}
 finally{pool.dispose();globalThis.fetch=original}
})
test('HTTP failure cancels its response body before releasing the network slot',async()=>{
 const original=globalThis.fetch;let cancelled=false
 globalThis.fetch=async()=>new Response(new ReadableStream({cancel(){cancelled=true}}),{status:404})
 const pool=new FrameTransport(manifest,()=>{},{concurrency:4,maxFrameBytes:262144})
 try{await assert.rejects(pool.read(0,new AbortController().signal),/404/);assert.ok(cancelled)}
 finally{pool.dispose();globalThis.fetch=original}
})
