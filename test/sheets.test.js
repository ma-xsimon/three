import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createVerify} from 'node:crypto';
import {createServer} from '../server.js';
import {newRound} from '../public/model.js';
const originalFetch=globalThis.fetch;
let server,base,cookie,rows=[],appends=0,failGoogle=false;
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
before(async()=>{
 Object.assign(process.env,{GOOGLE_SERVICE_ACCOUNT_EMAIL:'test@example.invalid',GOOGLE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),GOOGLE_SHEET_ID:'test-sheet',SYNC_PASSWORD:'test-only-password-123456',SESSION_SECRET:'test-only-session-secret-abcdefghijklmnopqrstuvwxyz'});
 globalThis.fetch=async(input,options={})=>{
  const url=String(input);
  if(url.startsWith('https://oauth2.googleapis.com/')){const jwt=options.body.get('assertion');const [h,p,sig]=jwt.split('.');const verifier=createVerify('RSA-SHA256');verifier.update(`${h}.${p}`);assert.ok(verifier.verify(publicKey,sig,'base64url'));const claims=JSON.parse(Buffer.from(p,'base64url'));assert.equal(claims.iss,'test@example.invalid');assert.equal(claims.aud,'https://oauth2.googleapis.com/token');return Response.json({access_token:'test-access-token',expires_in:3600});}
  if(url.startsWith('https://sheets.googleapis.com/')){assert.equal(options.headers.Authorization,'Bearer test-access-token');if(failGoogle)return Response.json({error:{}},{status:403});if(options.method==='POST'){assert.ok(url.includes('valueInputOption=RAW'));appends++;rows.push(...JSON.parse(options.body).values);return Response.json({updates:{updatedRows:rows.length}});}return Response.json({values:[['id','updated_at','date','course','points','round_json'],...rows]});}
  return originalFetch(input,options);
 };
 server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
 const res=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:process.env.SYNC_PASSWORD})});assert.equal(res.status,200);cookie=res.headers.get('set-cookie');
});
after(async()=>{globalThis.fetch=originalFetch;await new Promise(r=>server.close(r));});
const sync=rounds=>fetch(base+'/api/rounds',{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify({rounds})});
test('private Sheets adapter signs JWT, uses RAW append, pulls, deduplicates, and handles denial',async()=>{
 const r=newRound('=IMPORTXML("private")');r.holes=r.holes.map(()=>({strokes:3,gir:true,close:false,updown:3,pressure:2}));r.status='completed';
 let res=await sync([r]);assert.equal(res.status,200);assert.equal((await res.json()).rounds[0].id,r.id);assert.equal(appends,1);assert.equal(rows[0][3],r.course);
 res=await sync([r]);assert.equal(res.status,200);assert.equal(appends,1,'same revision must not append again');
 res=await sync([]);assert.equal((await res.json()).rounds.length,1,'new device pulls existing round');
 const updated={...r,course:'Updated course',updatedAt:new Date(Date.parse(r.updatedAt)+1000).toISOString()};res=await sync([updated]);assert.equal((await res.json()).rounds[0].course,'Updated course');assert.equal(appends,2);
 failGoogle=true;res=await sync([]);assert.equal(res.status,502);assert.match((await res.json()).error,/denied access/);failGoogle=false;
 rows.push(['bad','','','','','not json']);res=await sync([]);assert.equal(res.status,502);assert.match((await res.json()).error,/invalid row/);
});
