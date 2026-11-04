import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHmac,timingSafeEqual,createSign,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateRound,mergeRounds,totals} from './public/model.js';
const ROOT=fileURLToPath(new URL('./public/',import.meta.url));
const required=['GOOGLE_SERVICE_ACCOUNT_EMAIL','GOOGLE_PRIVATE_KEY','GOOGLE_SHEET_ID','SYNC_PASSWORD','SESSION_SECRET'];
const configured=()=>required.every(k=>process.env[k])&&process.env.SYNC_PASSWORD.length>=16&&process.env.SESSION_SECRET.length>=32;
const b64=s=>Buffer.from(s).toString('base64url');
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
function signature(value){return createHmac('sha256',process.env.SESSION_SECRET||'unconfigured').update(value).digest('base64url');}
function authenticated(req){if(!configured())return false;const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('sg_session='))?.slice(11);if(!cookie)return false;const [expiry,nonce,sig]=cookie.split('.');if(!expiry||!nonce||!sig)return false;return Number(expiry)>Date.now()&&equal(sig,signature(`${expiry}.${nonce}`));}
function secureCookie(){return process.env.NODE_ENV==='production'?'; Secure':'';}
function sessionCookie(){const token=`${Date.now()+7*86400000}.${randomBytes(16).toString('hex')}`;return `sg_session=${token}.${signature(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secureCookie()}`;}
const json=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>5e6){const e=new Error('Request exceeds 5 MB.');e.status=413;throw e;}}try{return JSON.parse(text);}catch{const e=new Error('Invalid JSON request.');e.status=400;throw e;}}
let tokenCache=null;
async function googleToken(){if(tokenCache&&tokenCache.expires>Date.now())return tokenCache.token;const now=Math.floor(Date.now()/1000);const header=b64(JSON.stringify({alg:'RS256',typ:'JWT'}));const payload=b64(JSON.stringify({iss:process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));const unsigned=`${header}.${payload}`;const signer=createSign('RSA-SHA256');signer.update(unsigned);const jwt=`${unsigned}.${signer.sign(process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,'\n'),'base64url')}`;const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(15000)});const data=await res.json();if(!res.ok||!data.access_token)throw new Error('Google authentication failed. Check the server service-account configuration.');tokenCache={token:data.access_token,expires:Date.now()+Math.max(60,(data.expires_in||3600)-120)*1000};return tokenCache.token;}
async function sheets(path,options={}){const token=await googleToken();const res=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(process.env.GOOGLE_SHEET_ID)}/values/${path}`,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});const data=await res.json();if(!res.ok)throw new Error(res.status===404?'Spreadsheet or Rounds tab not found. Check the server configuration.':res.status===403?'Google Sheets denied access. Enable the Sheets API and share the spreadsheet with the service account as Editor.':'Google Sheets request failed. Try again shortly.');return data;}
const RANGE=encodeURIComponent("'Rounds'!A:F");
async function readRounds(){const data=await sheets(RANGE);const rounds=[];for(const row of data.values||[]){if(row[0]==='id')continue;try{const r=JSON.parse(row[5]);if(!validateRound(r)||r.status!=='completed')throw new Error();rounds.push(r);}catch{throw new Error('The Rounds tab contains an invalid row. Restore it from a backup before syncing.');}}return mergeRounds([],rounds);}
// Append revisions instead of overwriting spreadsheet data. Retrying a request is safe:
// latest revision per round ID wins when rows are read.
let syncQueue=Promise.resolve();
async function syncRounds(rounds){const remote=await readRounds();const merged=mergeRounds(remote,rounds);const known=new Map(remote.map(r=>[r.id,r.updatedAt]));const changed=merged.filter(r=>!known.has(r.id)||Date.parse(r.updatedAt)>Date.parse(known.get(r.id)));if(changed.length)await sheets(`${RANGE}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,{method:'POST',body:JSON.stringify({values:changed.map(r=>[r.id,r.updatedAt,r.date,r.course,totals(r).points,JSON.stringify(r)])})});return merged;}
const attempts=new Map();
function rateLimit(req){const key=req.socket.remoteAddress;const now=Date.now();for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);const item=attempts.get(key)||{count:0,until:now+15*60000};item.count++;attempts.set(key,item);return item.count>20;}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
export function createServer(){return http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 try{const url=new URL(req.url,'http://localhost');const path=url.pathname;
 if(path.startsWith('/api/')){
  if(req.method==='POST'){
   const origin=req.headers.origin;const host=req.headers.host;
   if((origin&&new URL(origin).host!==host)||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Cross-origin request rejected.'});
   if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'Use application/json.'});
  }
  if(path==='/api/status'&&req.method==='GET')return json(res,200,{configured:configured(),authenticated:authenticated(req)});
  if(path==='/api/login'&&req.method==='POST'){
   if(!configured())return json(res,503,{error:'Google Sheets backup has not been configured on the server.'});
   if(rateLimit(req))return json(res,429,{error:'Too many attempts. Wait 15 minutes and try again.'});
   const data=await body(req);if(typeof data.password!=='string'||!equal(data.password,process.env.SYNC_PASSWORD))return json(res,401,{error:'Incorrect sync password.'});
   return json(res,200,{ok:true},{'Set-Cookie':sessionCookie()});
  }
  if(path==='/api/logout'&&req.method==='POST')return json(res,200,{ok:true},{'Set-Cookie':`sg_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookie()}`});
  if(path==='/api/rounds'&&req.method==='POST'){
   if(!authenticated(req))return json(res,401,{error:'Unlock your private Sheets connection first.'});
   const data=await body(req);if(!Array.isArray(data.rounds)||data.rounds.length>2000||!data.rounds.every(r=>validateRound(r)&&r.status==='completed'))return json(res,400,{error:'Invalid round data. Maximum 2,000 rounds per sync.'});
   const operation=syncQueue.then(()=>syncRounds(data.rounds));syncQueue=operation.catch(()=>{});const rounds=await operation;return json(res,200,{rounds});
  }
  return json(res,404,{error:'Endpoint not found.'});
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 const requested=path==='/'?'index.html':decodeURIComponent(path.slice(1));const file=resolve(ROOT,requested);
 if(!file.startsWith(ROOT)||!types[extname(file)]){res.writeHead(404);res.end('Not found');return;}
 const content=await readFile(file);res.setHeader('Content-Type',types[extname(file)]);res.setHeader('Cache-Control',path==='/sw.js'?'no-cache':'public, max-age=0, must-revalidate');res.writeHead(200);res.end(req.method==='HEAD'?undefined:content);
 }catch(e){if(e.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{json(res,e.status||502,{error:e.status?e.message:e.message?.startsWith('Google')||e.message?.startsWith('Spreadsheet')||e.message?.startsWith('The Rounds')?e.message:'Backup service unavailable. Your local rounds are safe; try again later.'});}}
 });}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))createServer().listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Short Game listening on port ${Number(process.env.PORT)||3000}. Sheets ${configured()?'configured':'not configured (local-only mode)'}.`));
