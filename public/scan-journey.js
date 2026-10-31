/**
 * YouCam session journey and uncertainty guard.
 * Pure, deterministic presentation. A provider-authenticated key is NOT a scan.
 * Pending means a task receipt exists; uncertain means a request may have reached
 * the provider but the client has no recoverable task receipt.
 */
export const UNCERTAIN_SCAN_KEY='routinegap_uncertain_scan_v1';
export const UNCERTAIN_MAX_AGE_MS=24*60*60*1000;
export const JOURNEY_STEPS=Object.freeze([
 {id:'photo',name:'Photo',description:'A photo was chosen in this browser'},
 {id:'consent',name:'Authorization',description:'Consent and access code for live analysis'},
 {id:'provider',name:'YouCam task',description:'A provider receipt was issued and can be resumed'},
 {id:'report',name:'Cosmetic result',description:'A usable real YouCam report was returned'}
]);
export function newUncertainMarker(now=Date.now()){
 if(!Number.isSafeInteger(now)||now<=0)throw new TypeError('Invalid date');
 return {kind:'submission-unknown',createdAt:now};
}
export function readUncertainMarker(raw,now=Date.now()){
 if(typeof raw!=='string'||raw.length>150||!Number.isSafeInteger(now))return null;
 let value;try{value=JSON.parse(raw);}catch{return null;}
 if(value?.kind!=='submission-unknown'||!Number.isSafeInteger(value.createdAt)||value.createdAt<=0||
  value.createdAt>now||now-value.createdAt>=UNCERTAIN_MAX_AGE_MS)return null;
 return newUncertainMarker(value.createdAt);
}
/** HTTP 5xx or missing a valid success receipt may follow a provider-side task creation. */
export function classifyStartResponse({status=null,receipt=null,networkFailure=false,unreadable=false}={}){
 if(networkFailure||unreadable)return 'uncertain';
 if(!Number.isInteger(status)||status<100||status>599)return 'uncertain';
 if(status>=500)return 'uncertain';
 if(status>=400)return 'rejected';
 return typeof receipt==='string'&&receipt.length>0&&receipt.length<=600?'started':'uncertain';
}
export function scanJourney({hasPhoto=false,imageReady=false,consent=false,passcode=false,authenticated=false,
 pending=false,uncertain=false,busy=false,phase='idle',poll=0,scanSource=null,hasReport=false}={}){
 const real=scanSource==='live'&&hasReport===true;
 const sample=scanSource==='sample'&&hasReport===true;
 const active=['uploading','processing'].includes(phase);
 const state=uncertain?'uncertain':active&&busy?'working':pending?'pending':real?'complete':sample?'sample':hasPhoto?'preparing':'empty';
 const copy={
  uncertain:{label:'SUBMISSION OUTCOME UNKNOWN',title:'A scan may already have been submitted',subtitle:'The upload response could not be confirmed. We cannot tell whether YouCam started a chargeable task. Do not submit another image until the project owner checks.',tone:'warning',action:'Contact the project owner before another scan'},
  pending:{label:'PROVIDER TASK SAVED',title:'Your existing scan can be resumed',subtitle:'A recovery receipt was issued and is saved in this browser tab. Resume status checks; do not upload the photo again.',tone:'pending',action:'Resume existing scan'},
  complete:{label:'REAL REPORT RETURNED',title:'YouCam cosmetic observations are ready',subtitle:'The provider returned usable results. These are cosmetic observations, not a medical diagnosis or validated product effects.',tone:'success',action:'Review cosmetic results'},
  working:{label:phase==='uploading'?'SUBMITTING CONSENTED PHOTO':'CHECKING EXISTING TASK',title:phase==='uploading'?'Sending an authorized request':'Waiting for the existing YouCam task',subtitle:phase==='uploading'?'The photo may have reached the provider. Avoid reloading or retrying until a receipt is issued.':'Checking the same task without a second paid upload. Poll '+Math.max(0,Math.min(17,Math.floor(poll)))+' of 17.',tone:'working',action:'Do not start another scan'},
  sample:{label:'ILLUSTRATIVE DEMO',title:'Explore the experience without a live scan',subtitle:'These are synthetic example observations. No image was uploaded and no YouCam result was produced by this sample.',tone:'sample',action:'View sample results'},
  preparing:{label:'PHOTO SELECTED LOCALLY',title:imageReady?'Photo file meets technical limits':'Review the selected photo',subtitle:imageReady?'Technical file checks alone do not validate lighting, face position or provider acceptance.':'Use Photo Readiness to check dimensions and prepare an oversized original if supported.',tone:'idle',action:'Check photo readiness'},
  empty:{label:'NOT STARTED',title:'You are in control of your skin session',subtitle:'Start with a photo checked locally, or explore the clearly labeled sample with no upload. YouCam authentication alone does not mean a scan succeeded.',tone:'idle',action:'Choose a photo or explore sample'}
 }[state];
 const photoOK=hasPhoto===true&&imageReady===true;
 const approval=photoOK&&consent===true&&passcode===true&&authenticated===true;
 const steps=JOURNEY_STEPS.map((s,i)=>{
  let status='waiting';
  if(i===0&&photoOK)status='done';
  if(i===1&&approval)status='done';
  if(i===2&&(pending||real))status='done';
  if(i===3&&real)status='done';
  if(state==='uncertain'&&i===2)status='uncertain';
  if(state==='working'&&i===2)status='active';
  return {...s,status};
 });
 return {...copy,state,steps,canStartNew:photoOK&&approval&&!uncertain&&!pending&&!busy,
  blockedByUncertainty:!!uncertain,hasReceipt:!!pending,realReport:real,exampleOnly:sample,
  truth:'RoutineGap does not estimate provider completion percentages. A missing response is not proof that no task was created. Clearing the local record does not cancel anything at Perfect Corp.'};
}
