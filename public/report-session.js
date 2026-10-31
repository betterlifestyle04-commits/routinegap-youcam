/**
 * A small, explicit local opt-in for completed REAL reports only.
 * Never store photos, file names, provider payloads, API keys, passcodes, or receipts.
 * The data lives in sessionStorage for the browser tab; this module does not use storage/network APIs.
 */
export const LIVE_REPORT_SESSION_KEY='routinegap_saved_live_report_v1';
export const MAX_REPORT_AGE_MS=24*60*60*1000;
const types=new Set(['moisture','oiliness','pore','texture','redness','skin_type']);
const numeric=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?value:null;

export function makePrivateReport(signals,savedAt=Date.now()){
  if(!Array.isArray(signals)||signals.length===0||signals.length>12||
     !Number.isSafeInteger(savedAt)||savedAt<=0)throw new Error('A completed real scan report is required.');
  const cleaned=signals.flatMap(s=>{
    if(!s||typeof s!=='object'||Array.isArray(s)||!types.has(s.type))return [];
    const item={type:s.type,uiScore:numeric(s.uiScore),rawScore:numeric(s.rawScore),regions:null};
    if(s.type==='skin_type'&&s.regions&&typeof s.regions==='object'&&!Array.isArray(s.regions)){
      const whole=s.regions.whole;
      if(typeof whole==='string'&&whole.length<=60&&/^[\w -]+$/.test(whole))item.regions={whole};
    }
    if(item.uiScore===null&&item.rawScore===null&&!item.regions)return [];
    return [item];
  });
  if(!cleaned.length)throw new Error('There are no supported cosmetic observations to save.');
  return {kind:'real-youcam-scan',savedAt,signals:cleaned};
}
export function readPrivateReport(raw,now=Date.now()){
  if(typeof raw!=='string'||raw.length>7000||!Number.isSafeInteger(now))return null;
  let parsed;
  try{parsed=JSON.parse(raw);}catch{return null;}
  if(parsed?.kind!=='real-youcam-scan'||!Number.isSafeInteger(parsed.savedAt)||
    parsed.savedAt>now||now-parsed.savedAt>MAX_REPORT_AGE_MS)return null;
  try{return makePrivateReport(parsed.signals,parsed.savedAt);}catch{return null;}
}
