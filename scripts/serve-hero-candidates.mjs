// Audit-only Vite preview middleware. Candidates stay outside deployable public/.
import {preview} from 'vite'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
const ids=new Set(['desktop-a','desktop-b','desktop-c','mobile-a','mobile-b','mobile-c'])
await preview({preview:{host:'127.0.0.1',port:4176,strictPort:true},plugins:[{
 name:'local-hero-candidate-audit',
 configurePreviewServer(server){server.middlewares.use((req,res,next)=>{
  try {
   const url=new URL(req.url,'http://localhost'),candidate=url.searchParams.get('profile')
   if(ids.has(candidate))res.setHeader('Set-Cookie',`hero-profile=${candidate}; Path=/; SameSite=Strict`)
   const cookie=req.headers.cookie?.match(/(?:^|; )hero-profile=([\w-]+)/)?.[1]
   const path=url.pathname
   const match=path.match(/^\/frames\/v2\/([\w-]+)\/(frame_\d{4}\.webp|manifest\.json)$/)
   let file
   if(match&&ids.has(match[1]))file=resolve(`artifacts/hero-optimization/candidates/${match[1]}/${match[2]}`)
   if(ids.has(cookie)&&['/frames/manifest.json','/frames/v2/mobile/manifest.json'].includes(path))file=resolve(`artifacts/hero-optimization/candidates/${cookie}/manifest.json`)
   if(!file){next();return}
   const body=readFileSync(file)
   res.writeHead(200,{'Content-Type':file.endsWith('.webp')?'image/webp':'application/json','Content-Length':body.length,'Cache-Control':'no-cache'})
   res.end(body)
  }catch{res.writeHead(404);res.end('Not found')}
 })}
}]})
console.log('Candidate production preview: http://127.0.0.1:4176')
