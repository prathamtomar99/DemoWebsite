import test from 'node:test'
import assert from 'node:assert/strict'
import { storyState } from '../src/components/hero/story-timeline.ts'

const stage = (entrance, range, alignment = 'left') => ({ entrance, range, alignment })
const stages = [stage('intro', [0,0,.04,.14]),stage('side',[.18,.24,.43,.50],'right'),stage('side',[.54,.61,.80,.87]),stage('finale',[.88,.96,1,1],'center')]

test('story endpoints, gaps, and persistent finale', () => {
  for (const [p,expected] of [[0,[1,0,0,0]],[.14,[0,0,0,0]],[.25,[0,1,0,0]],[.50,[0,0,0,0]],[.65,[0,0,1,0]],[.87,[0,0,0,0]],[.96,[0,0,0,1]],[1,[0,0,0,1]]]) {
    assert.deepEqual(stages.map(s=>storyState(s,p).opacity),expected)
  }
})
test('timeline reverses, clamps, holds, and never overlaps', () => {
  const values = Array.from({length:1001},(_,i)=>i/1000)
  const forward = values.map(p=>stages.map(s=>storyState(s,p)))
  assert.deepEqual(values.toReversed().map(p=>stages.map(s=>storyState(s,p))).toReversed(),forward)
  for (const states of forward) assert.ok(states.filter(s=>s.opacity>0).length<=1)
  assert.equal(storyState(stages[0],-1).opacity,1)
  assert.equal(storyState(stages[3],2).opacity,1)
  assert.equal(storyState(stages[0],NaN).opacity,1)
  assert.equal(storyState(stages[1],.21).x,.5)
  assert.ok(Math.abs(storyState(stages[2],.575).opacity-.5)<1e-12)
})
