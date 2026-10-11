import assert from 'node:assert/strict'
import { test } from 'node:test'
import { frameBlend, availableBlend } from '../src/components/hero/frame-blend.ts'
import { paintFrame } from '../src/components/hero/canvas-renderer.ts'
const options = { enabled: true, start: .35, end: .65, curve: 'smoothstep' }

test('fractional mapping preserves endpoints, narrow window, and reversal for both profiles', () => {
  for (const count of [72,60]) {
    for (const p of [-1,0,1,2]) {
      const index=p<=0?0:count-1, sample=frameBlend(p,count,options)
      assert.equal(sample.current,index);assert.equal(sample.next,index);assert.equal(sample.alpha,0)
      assert.equal(availableBlend(sample,true,true).base,index)
    }
    for (const fraction of [0,.2,.35,.4,.5,.6,.65,.8,.99]) {
      const p=(20+fraction)/(count-1), a=frameBlend(p,count,options)
      assert.equal(a.current,20);assert.equal(a.next,21)
      assert.equal(a.nearest,Math.round(20+fraction))
      if(fraction<=.35)assert.ok(a.alpha<1e-12)
      if(fraction>=.65)assert.ok(a.alpha>1-1e-12)
      if(fraction===.5)assert.ok(Math.abs(a.alpha-.5)<1e-12)
      assert.deepEqual(frameBlend(p,count,options),a)
    }
    const forward=Array.from({length:1001},(_,i)=>frameBlend(i/1000,count,options))
    const reverse=Array.from({length:1001},(_,i)=>frameBlend((1000-i)/1000,count,options)).reverse()
    assert.deepEqual(forward,reverse)
  }
  assert.equal(frameBlend(NaN,72,options).current,0)
  assert.deepEqual(availableBlend(frameBlend(.5,1,options),true,true),{base:0,overlay:-1,alpha:0,dominant:0})
})

test('disabled and continuous modes are deterministic; unavailable neighbors never blend', () => {
  const p=20.4/71
  assert.equal(frameBlend(p,72,{...options,enabled:false}).current,20)
  assert.ok(Math.abs(frameBlend(p,72,{...options,start:0,end:1,curve:'linear'}).alpha-.4)<1e-12)
  const sample=frameBlend(20.5/71,72,options)
  assert.equal(availableBlend(sample,false,false),undefined)
  assert.deepEqual(availableBlend(sample,true,false),{base:20,overlay:-1,alpha:0,dominant:20})
  assert.deepEqual(availableBlend(sample,false,true),{base:21,overlay:-1,alpha:0,dominant:21})
  const both=availableBlend(sample,true,true)
  assert.equal(both.overlay,both.base+1);assert.ok(Math.abs(both.alpha-.5)<1e-12)
})

test('renderer draws opaque base then adjacent overlay with identical placement; always resets alpha', () => {
  const saved=globalThis.window
  globalThis.window={devicePixelRatio:1}
  try {
    const calls=[],ctx={globalAlpha:.3,setTransform(){},fillRect(){assert.equal(this.globalAlpha,1)},drawImage(...args){calls.push({args,alpha:this.globalAlpha})}}
    const canvas={width:1440,height:900,getContext:()=>ctx}
    const base={image:{id:1},width:960,height:540},next={...base,image:{id:2}}
    assert.equal(paintFrame(canvas,base,1440,900,'black',next,.5),true)
    assert.equal(calls.length,2);assert.deepEqual(calls[0].args.slice(1),calls[1].args.slice(1))
    assert.deepEqual(calls.map(x=>x.alpha),[1,.5]);assert.equal(ctx.globalAlpha,1)
    let draws=0;ctx.drawImage=()=>{if(++draws===2){assert.equal(ctx.globalAlpha,.5);throw new Error('lost overlay')}}
    assert.throws(()=>paintFrame(canvas,base,1440,900,'black',next,.5));assert.equal(ctx.globalAlpha,1)
  } finally {globalThis.window=saved}
})
