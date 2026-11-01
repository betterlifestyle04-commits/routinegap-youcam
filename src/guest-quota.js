import {isIP} from 'node:net';

/**
 * In-memory, intentionally small pool of publicly accessible real YouCam
 * submissions. This is a budget brake, not an anti-bot identity system.
 * Limits are process-scoped and reset on process restart/deploy: provider-side
 * credit controls remain necessary before enabling public access.
 */
export const PUBLIC_GUEST_MAX_PER_DAY=3;
export const PUBLIC_GUEST_MAX_PER_SOURCE_PER_DAY=1;

export function guestSource(req){
 const forwarded=req?.headers?.['x-forwarded-for'];
 const first=typeof forwarded==='string'?forwarded.split(',')[0].trim():'';
 const socket=req?.socket?.remoteAddress||'unknown';
 // Trust proxy source for fairness only; the independent global cap
 // still holds even if an attacker spoofs forwarded headers.
 return isIP(first)?first:String(socket).slice(0,72);
}
export function makeGuestQuota({dailyMax=PUBLIC_GUEST_MAX_PER_DAY,perSourceMax=PUBLIC_GUEST_MAX_PER_SOURCE_PER_DAY,now=()=>Date.now()}={}){
 if(!Number.isSafeInteger(dailyMax)||dailyMax<1||!Number.isSafeInteger(perSourceMax)||perSourceMax<1)throw new TypeError('Invalid scan quota');
 let day='',total=0;
 const sourceCounts=new Map();
 function rollover(){
  const today=new Date(now()).toISOString().slice(0,10);
  if(day!==today){day=today;total=0;sourceCounts.clear();}
 }
 return Object.freeze({
  inspect(){rollover();return Object.freeze({remaining:Math.max(0,dailyMax-total),dailyMax});},
  consume(source){
   rollover();
   if(typeof source!=='string'||!source||source.length>100)return {allowed:false,reason:'invalid'};
   if(total>=dailyMax)return {allowed:false,reason:'global',remaining:0};
   if((sourceCounts.get(source)||0)>=perSourceMax)return {allowed:false,reason:'source',remaining:dailyMax-total};
   total++;
   sourceCounts.set(source,(sourceCounts.get(source)||0)+1);
   return {allowed:true,remaining:dailyMax-total};
  }
 });
}
