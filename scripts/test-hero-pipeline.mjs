// Destructive-path guards are exercised only in an isolated temporary project.
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import assert from 'node:assert/strict'
const root=resolve('artifacts/hero-optimization')
const fixture=mkdtempSync(join(root,'pipeline-safety-'))
const results=[]
try {
 for(const dir of ['scripts','assets/source','public/frames/v2','public/media','outside'])mkdirSync(join(fixture,dir),{recursive:true})
 copyFileSync('scripts/prepare-hero.mjs',join(fixture,'scripts/prepare-hero.mjs'))
 copyFileSync('assets/source/DroneVideo.mp4',join(fixture,'assets/source/DroneVideo.mp4'))
 writeFileSync(join(fixture,'public/frames/manifest.json'),JSON.stringify({generatedBy:'aether-estates/prepare-hero/v2'}))
 const desktop=join(fixture,'public/frames/v2/desktop')
 const run=(name,pattern)=>{
  const result=spawnSync(process.execPath,[join(fixture,'scripts/prepare-hero.mjs')],{encoding:'utf8'})
  assert.equal(result.status,1);assert.match(result.stderr,pattern);results.push({name,pass:true,error:result.stderr.trim()})
 }
 mkdirSync(desktop);writeFileSync(join(desktop,'manifest.json'),JSON.stringify({generatedBy:'another-pipeline',frameCount:1}))
 run('unowned profile',/Refusing unowned output/)
 rmSync(desktop,{recursive:true})
 writeFileSync(join(fixture,'outside/sentinel.txt'),'keep')
 symlinkSync(join(fixture,'outside'),desktop,'dir')
 run('symlink output directory',/symlink output/)
 assert.equal(readFileSync(join(fixture,'outside/sentinel.txt'),'utf8'),'keep')
 rmSync(desktop)
 mkdirSync(desktop);writeFileSync(join(desktop,'manifest.json'),JSON.stringify({generatedBy:'aether-estates/prepare-hero/v2',frameCount:1}))
 writeFileSync(join(desktop,'unrelated.txt'),'keep')
 run('unexpected file in owned profile',/Unexpected file/)
 assert.equal(readFileSync(join(desktop,'unrelated.txt'),'utf8'),'keep')
 writeFileSync(join(root,'pipeline-safety.json'),JSON.stringify(results,null,2))
 console.log(JSON.stringify(results))
} finally {rmSync(fixture,{recursive:true,force:true})}
