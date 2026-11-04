import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.js';
let server,base;
before(async()=>{server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;});
after(()=>new Promise(r=>server.close(r)));
test('serves app, offline assets, and excludes private source files',async()=>{
 for(const path of ['/','/app.js','/model.js','/style.css','/sw.js','/manifest.webmanifest','/icon.svg','/apple-touch-icon.png','/icon-192.png','/icon-512.png']){
  const r=await fetch(base+path);assert.equal(r.status,200,path);assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 }
 for(const path of ['/server.js','/.env','/package.json'])assert.equal((await fetch(base+path)).status,404);
});
test('health check requires no configuration and returns no credential metadata',async()=>{
 const res=await fetch(base+'/api/status');assert.equal(res.status,200);assert.deepEqual(await res.json(),{ok:true});
});
test('removed data and authentication endpoints cannot accept or return round data',async()=>{
 for(const path of ['/api/login','/api/logout','/api/rounds']){
  assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 }
});
