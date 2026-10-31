import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {timingSafeEqual} from 'node:crypto';
import {startYouCamScan,getYouCamScan,verifyYouCamAccess,YouCamError} from './src/youcam.js';
const root=join(fileURLToPath(new URL('.',import.meta.url)),'public');
const mimeMap={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
const ipHits=new Map(),createdTasks=new Map();let daily=0,day=new Date().toISOString().slice(0,10);
const MAX_BYTES=8*1024*1024;
function send(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));}
const ready=()=>process.env.LIVE_SCANS_ENABLED==='true'&&!!process.env.YOUCAM_API_KEY&&!!process.env.DEMO_ACCESS_TOKEN;
let providerConnection = 'unchecked';
function access(req){const secret=process.env.DEMO_ACCESS_TOKEN||'',given=req.headers['x-demo-access']||'';if(!secret || typeof given!=='string'||given.length!==secret.length)return false;return timingSafeEqual(Buffer.from(secret),Buffer.from(given));}
function allowOrigin(req){const expected=process.env.PUBLIC_ORIGIN||'';if(!expected)return true;return !req.headers.origin||req.headers.origin===expected;}
function rateLimit(req){
  const now=Date.now(),today=new Date().toISOString().slice(0,10);if(today!==day){day=today;daily=0;ipHits.clear();createdTasks.clear();}
  const ip=req.socket.remoteAddress||'unknown', recent=(ipHits.get(ip)||[]).filter(n=>n>now-3600000);
  if(recent.length>=2||daily>=20)return false;
  recent.push(now);ipHits.set(ip,recent);daily++;return true;
}
async function readBytes(req,limit){const len=Number(req.headers['content-length']||0);if(len>limit)throw new YouCamError('Image file exceeds 8 MB.',413);const chunks=[];let n=0;for await(const chunk of req){n+=chunk.length;if(n>limit)throw new YouCamError('Image file exceeds 8 MB.',413);chunks.push(chunk);}return Buffer.concat(chunks);}
const isAPI=req=>req.url?.startsWith('/api/');
const server=createServer(async(req,res)=>{
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  try{
    const url=new URL(req.url||'/', 'http://localhost');
    if(req.method==='GET'&&url.pathname==='/api/status')return send(res,200,{
      liveEnabled:ready(),provider:'YouCam Skin Analysis v2.0',
      providerConnection:ready()?providerConnection:'disabled',
      note:!ready()?'Live scans require an API key, demo passcode and explicit enablement.'
        : providerConnection==='authenticated'?'API key authenticated with free YouCam credit check. No real skin scan has been completed by this check.'
        : providerConnection==='failed'?'Provider authentication check failed. Inspect private Render logs and verify the key.'
        : 'Server configured. Free provider authentication preflight is pending.'
    });
    if(isAPI(req)&&!allowOrigin(req))return send(res,403,{error:'Cross-site API requests are forbidden.'});
    if(isAPI(req)&&!ready())return send(res,503,{error:'Live YouCam scans are not yet enabled. Explore the clearly labeled sample session.'});
    if(isAPI(req)&&!access(req))return send(res,401,{error:'Valid demo access passcode required for live YouCam requests.'});
    if(req.method==='POST'&&url.pathname==='/api/scan'){
      if(!rateLimit(req))return send(res,429,{error:'Demo scan budget reached (max two per hour per connection; twenty per day total).'});
      const contentType=(req.headers['content-type']||'').split(';')[0];
      if(!['image/jpeg','image/png'].includes(contentType))return send(res,415,{error:'Upload a JPG or PNG photo.'});
      if(req.headers['x-skin-consent']!=='yes')return send(res,400,{error:'Explicit YouCam photo-sharing consent is required.'});
      const bytes=await readBytes(req,MAX_BYTES);
      const task=await startYouCamScan({bytes,mime:contentType,fileName:req.headers['x-image-filename']||'selfie.jpg'});
      createdTasks.set(task.taskId,{ip:req.socket.remoteAddress||'unknown',expires:Date.now()+86400000});
      return send(res,200,{taskId:task.taskId,state:'running'});
    }
    if(req.method==='GET'&&url.pathname==='/api/scan/status'){
      const taskId=url.searchParams.get('task_id');const record=createdTasks.get(taskId);
      if(!record||record.expires<Date.now()||record.ip!==(req.socket.remoteAddress||'unknown'))return send(res,404,{error:'Unknown or expired scan task.'});
      const result=await getYouCamScan(taskId);
      if(result.state==='success'||result.state==='error')createdTasks.delete(taskId);
      return send(res,200,result);
    }
    if(isAPI(req))return send(res,404,{error:'Unknown API endpoint.'});
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Method not allowed.'});
    let path=url.pathname==='/'?'/index.html':url.pathname;if(!/^\/[a-zA-Z0-9./_-]+$/.test(path)||path.includes('..'))return send(res,404,{error:'Not found'});
    const target=join(root,normalize(path));if(!target.startsWith(root))return send(res,404,{error:'Not found'});
    try{const data=await readFile(target);res.writeHead(200,{'Content-Type':mimeMap[extname(target)]||'application/octet-stream','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')res.end();else res.end(data);}catch{send(res,404,{error:'Not found'});}
  }catch(e){const status=e instanceof YouCamError?e.status:500;send(res,status,{error:e instanceof YouCamError?e.message:'The request failed. Please try again.'});}
});
const port=Number(process.env.PORT||3000);
if(process.env.NODE_ENV!=='test')server.listen(port,'0.0.0.0',()=>{
  process.stdout.write(`RoutineGap running at http://localhost:${port}\n`);
  if(ready()){
    providerConnection='checking';
    void verifyYouCamAccess().then(()=>{
      providerConnection='authenticated';
      console.info('YouCam key preflight: authenticated by free credit-balance endpoint; no analysis task created.');
    }).catch(error=>{
      providerConnection='failed';
      console.warn('YouCam key preflight failed:',error instanceof YouCamError?error.message:'Unexpected provider error.');
    });
  }else{providerConnection='disabled';}
});
export {server};
