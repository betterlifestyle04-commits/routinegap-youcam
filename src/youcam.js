import { normalizeScanOutput } from './recommendations.js';
import { imageDimensions,validSkinAnalysisDimensions,skinDimensionMessage } from './image-size.js';
const HOST='https://yce-api-01.makeupar.com';
const TIMEOUT_MS=25000;
export class YouCamError extends Error{constructor(message,status=502){super(message);this.name='YouCamError';this.status=status;}}
const getKey=()=>{if(!process.env.YOUCAM_API_KEY)throw new YouCamError('YouCam API key is not configured.',503);return process.env.YOUCAM_API_KEY;};
async function api(path,init={}){
  let response;
  try{response=await fetch(HOST+path,{...init,headers:{Authorization:`Bearer ${getKey()}`,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(TIMEOUT_MS)});}catch{throw new YouCamError('YouCam is temporarily unreachable.');}
  if(!response.ok){if(response.status===401||response.status===403)throw new YouCamError('YouCam authorization failed. Verify the API key and credits.',503);if(response.status===429)throw new YouCamError('YouCam rate limit reached. Try later.',429);throw new YouCamError('YouCam rejected the request. Please verify the input and provider account.',502);}
  try{return await response.json()}catch{throw new YouCamError('Unexpected YouCam response.');}
}
/**
 * Zero-credit authentication preflight via Perfect Corp's documented credit endpoint.
 * This never uploads a photo, creates a skin-analysis task, or spends scan credits.
 */
export async function verifyYouCamAccess() {
  const data = await api('/s2s/v1.0/client/credit', { method: 'GET' });
  if (!Array.isArray(data?.results)) {
    throw new YouCamError('YouCam credit API returned an unexpected response.');
  }
  return { authenticated: true };
}

function signedUploadUrl(url){
  const target=new URL(url);
  // Never upload user photos to a host controlled by an untrusted response.
  if(target.protocol!=='https:'||target.username||target.password||!/(?:^|\.)s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(target.hostname))throw new YouCamError('Unexpected provider file upload destination.');
  return url;
}
export async function startYouCamScan({bytes,mime,fileName}){
  if(!(bytes instanceof Buffer) || bytes.length<1500||bytes.length>8*1024*1024)throw new YouCamError('Upload a JPG or PNG photo under 8 MB.',400);
  if(!['image/jpeg','image/png'].includes(mime))throw new YouCamError('Only JPG or PNG is supported.',400);
  const magicValid=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(!magicValid)throw new YouCamError('Image type does not match its file signature.',400);
  let dimensions;
  try{dimensions=imageDimensions(bytes,mime);}catch{throw new YouCamError('Image format or dimensions could not be read. Choose a valid JPEG or PNG.',400);}
  if(!validSkinAnalysisDimensions(dimensions))throw new YouCamError(skinDimensionMessage(dimensions),400);
  const safeName=(fileName||'skin-photo').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,60);
  const upload=await api('/s2s/v2.0/file',{method:'POST',body:JSON.stringify({files:[{content_type:mime,file_name:safeName,file_size:bytes.length}]})});
  const first=upload?.data?.files?.[0], signed=first?.requests?.[0];
  if(!first?.file_id||!signed?.url||signed.method!=='PUT')throw new YouCamError('YouCam did not return upload instructions.');
  let put;
  try{put=await fetch(signedUploadUrl(signed.url),{method:'PUT',headers:{'Content-Type':mime,'Content-Length':String(bytes.length)},body:bytes,signal:AbortSignal.timeout(35000)});}catch(err){if(err instanceof YouCamError)throw err;throw new YouCamError('Image transfer to YouCam failed.');}
  if(!put.ok)throw new YouCamError('YouCam image upload did not succeed.');
  const task=await api('/s2s/v2.0/task/skin-analysis',{method:'POST',body:JSON.stringify({src_file_id:first.file_id,dst_actions:['moisture','oiliness','pore','texture','redness','skin_type'],format:'json'})});
  if(typeof task?.data?.task_id!=='string'||!task.data.task_id)throw new YouCamError('YouCam did not return a valid task ID.');
  return {taskId:task.data.task_id};
}
export async function getYouCamScan(taskId){
  if(typeof taskId!=='string'||!/^[-_A-Za-z0-9+/=]{10,220}$/.test(taskId))throw new YouCamError('Invalid task identifier.',400);
  const payload=await api('/s2s/v2.0/task/skin-analysis/'+encodeURIComponent(taskId));
  const status=payload?.data?.task_status;
  if(status==='success'){
    try{return {state:'success',signals:normalizeScanOutput(payload)};}
    catch{throw new YouCamError('YouCam completed the scan, but its result format did not contain supported cosmetic observations. Please contact the project owner before retrying.',502);}
  }
  if(status==='error')return {state:'error',message:'YouCam could not analyze this image. Try a clear, front-facing photo.'};
  return {state:'running'};
}
