import {test} from 'node:test'
import assert from 'node:assert/strict'
import {decodedSequenceBytes,sequenceBudget,preparationPercent} from '../src/components/hero/full-frame-policy.ts'
test('full decoded memory is explicit, profile-bound and conservative on low-memory devices',()=>{
 assert.equal(decodedSequenceBytes(72,960,540),149299200)
 assert.equal(decodedSequenceBytes(60,720,405),69984000)
 assert.ok(decodedSequenceBytes(72,960,540)<sequenceBudget(false,8))
 assert.ok(decodedSequenceBytes(72,960,540)>sequenceBudget(false,4))
 assert.ok(decodedSequenceBytes(60,720,405)>sequenceBudget(true,2))
 assert.ok(decodedSequenceBytes(60,720,405)<sequenceBudget(true,4))
 assert.equal(sequenceBudget(true,undefined),80*1024**2)
})
test('progress includes downloading and decoding, reserving 100% for successful Canvas readiness',()=>{
 assert.equal(preparationPercent({downloaded:0,decoded:0,total:0,ready:false}),0)
 assert.equal(preparationPercent({downloaded:72,decoded:0,total:72,ready:false}),49)
 assert.equal(preparationPercent({downloaded:72,decoded:72,total:72,ready:false}),99)
 assert.equal(preparationPercent({downloaded:72,decoded:72,total:72,ready:true}),100)
 assert.notEqual(preparationPercent({downloaded:72,decoded:3,total:72,ready:true}),100)
})
