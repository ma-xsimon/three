import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('./public/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};

// Only serves public app assets. Scores stay in the browser; no accounts or data API.
export function createServer(){
 return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
   // Kept for existing Render deployments' health check configuration.
   if(path==='/api/status'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:JSON.stringify({ok:true}));return;
   }
   const file=resolve(ROOT,path==='/'?'index.html':decodeURIComponent(path.slice(1)));
   if(!file.startsWith(ROOT)||!types[extname(file)]){res.writeHead(404);res.end('Not found');return;}
   const content=await readFile(file);
   res.setHeader('Content-Type',types[extname(file)]);
   res.setHeader('Cache-Control',path==='/sw.js'?'no-cache':'public, max-age=0, must-revalidate');
   res.writeHead(200);res.end(req.method==='HEAD'?undefined:content);
  }catch(e){res.writeHead(e.code==='ENOENT'?404:e instanceof URIError?400:500);res.end(e.code==='ENOENT'?'Not found':'Unable to serve request');}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 createServer().listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Short Game listening on port ${Number(process.env.PORT)||3000}. Scores are stored on the device.`));
}
