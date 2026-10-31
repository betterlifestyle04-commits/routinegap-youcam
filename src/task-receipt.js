import { createHmac,timingSafeEqual } from 'node:crypto';

// A receipt is opaque to the frontend, bound to the private demo passcode by HMAC.
// No face photo, results, provider API key or third-party upload URL is stored here.
// It supports resuming a provider task after a Render restart without an in-memory task map.
export const TASK_WINDOW_MS = 24*60*60*1000;
export class TaskReceiptError extends Error {
  constructor(){super('Scan receipt is invalid or expired. Start another scan only if necessary.');this.name='TaskReceiptError';this.status=404;}
}
function signature(body,secret){return createHmac('sha256',secret).update('routinegap:scan:v1:').update(body).digest('base64url');}
const validTaskId=id=>typeof id==='string'&&/^[-_A-Za-z0-9+/=]{10,220}$/.test(id);

export function issueTaskReceipt(taskId,secret,now=Date.now()){
  if(!validTaskId(taskId)||typeof secret!=='string'||secret.length<12||!Number.isSafeInteger(now)||now<0)throw new TaskReceiptError();
  const body=Buffer.from(JSON.stringify({v:1,id:taskId,issued:now}),'utf8').toString('base64url');
  return body+'.'+signature(body,secret);
}
export function readTaskReceipt(receipt,secret,now=Date.now()){
  if(typeof receipt!=='string'||receipt.length>600||typeof secret!=='string'||secret.length<12||!Number.isSafeInteger(now)||now<0)throw new TaskReceiptError();
  const pieces=receipt.split('.');
  if(pieces.length!==2||!pieces[0]||!/^[A-Za-z0-9_-]+$/.test(pieces[0])||!/^[A-Za-z0-9_-]{43}$/.test(pieces[1]))throw new TaskReceiptError();
  const expected=signature(pieces[0],secret);
  if(!timingSafeEqual(Buffer.from(pieces[1]),Buffer.from(expected)))throw new TaskReceiptError();
  let payload;
  try{payload=JSON.parse(Buffer.from(pieces[0],'base64url').toString('utf8'));}catch{throw new TaskReceiptError();}
  if(payload?.v!==1||!validTaskId(payload?.id)||!Number.isSafeInteger(payload?.issued)||payload.issued>now+60000||
     now-payload.issued>TASK_WINDOW_MS)throw new TaskReceiptError();
  return {taskId:payload.id,issued:payload.issued,expiresAt:payload.issued+TASK_WINDOW_MS};
}
