/**
 * RoutineGap's strictly local, deterministic photo-readiness explanation.
 * File metadata and user self-checks are not face-quality, image-content,
 * identity, clinical, or provider acceptance assessments.
 */
export const SELF_CHECKS=Object.freeze([
 {id:'front',title:'Straight-on face',detail:'One centered face, eyes visible and roughly facing the camera.'},
 {id:'lighting',title:'Even lighting',detail:'Soft light across the face without strong backlight or deep shadows.'},
 {id:'uncovered',title:'Face clearly visible',detail:'No glasses, face-covering hair, sunglasses or hats obstructing the skin.'},
 {id:'unfiltered',title:'Original, unfiltered image',detail:'No beauty modes, smoothing filters, AI alterations or screenshots.'}
]);
export const SELF_CHECK_IDS=Object.freeze(SELF_CHECKS.map(x=>x.id));
export const FINAL_MAX_BYTES=8*1024*1024;
export const SOURCE_MAX_BYTES=24*1024*1024;
export const SHORT_MIN_PIXELS=480;
export const LONG_MAX_PIXELS=2560;
function validNumber(n){return Number.isFinite(n)&&n>0;}
function fileCheck(file){
 if(!file)return null;
 if(typeof file.type!=='string'||!Number.isFinite(file.size))return {type:'unknown',size:0};
 return {type:file.type,size:file.size};
}
export function normalizeSelfChecks(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(SELF_CHECK_IDS.filter(id=>value[id]===true).map(id=>[id,true]));
}
export function toggleSelfCheck(current,id,checked){
 if(!SELF_CHECK_IDS.includes(id))return normalizeSelfChecks(current);
 const result=normalizeSelfChecks(current);
 if(checked===true)result[id]=true;else delete result[id];
 return result;
}
export function photoReadiness({sourceFile=null,preparedFile=null,dimensions=null,plan=null,checks={},consent=false,passcodeReady=false,providerReady=false,pending=false,busy=false,preparing=false}={}){
 const f=fileCheck(sourceFile),out=fileCheck(preparedFile);
 const selected=!!f;
 const formatOK=selected&&['image/jpeg','image/png'].includes(f.type);
 const bytesOK=selected&&f.size>=1500&&f.size<=SOURCE_MAX_BYTES;
 const w=dimensions?.width,h=dimensions?.height;
 const hasDimensions=Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0;
 const short=hasDimensions?Math.min(w,h):null,long=hasDimensions?Math.max(w,h):null;
 const minimumOK=hasDimensions&&short>=SHORT_MIN_PIXELS;
 const originalLongOK=hasDimensions&&long<=LONG_MAX_PIXELS;
 const originalUploadOK=selected&&formatOK&&bytesOK&&f.size<=FINAL_MAX_BYTES;
 const status=selected?(plan?.status==='ready'&&!!out?'ready':plan?.status==='prepare'?'prepare':plan?.status==='ready'?'checking':plan?.status==='too-small'||plan?.status==='unsupported'?'invalid':hasDimensions?'invalid':'checking'):'empty';
 const technicalReady=status==='ready'&&minimumOK&&originalLongOK&&originalUploadOK;
 const selectedChecks=normalizeSelfChecks(checks);
 const confirmed=SELF_CHECK_IDS.filter(id=>selectedChecks[id]).length;
 const diagnostics=[
  {id:'format',label:'JPG or PNG original',status:!selected?'pending':formatOK?'pass':'fail',detail:formatOK?f.type==='image/png'?'PNG':'JPEG':'Choose a JPG or PNG image.'},
  {id:'sourceSize',label:'Original 1.5 KB–24 MB',status:!selected?'pending':bytesOK?'pass':'fail',detail:selected?(f.size/1024/1024).toFixed(2)+' MB source':'Waiting for photo'},
  {id:'minPixels',label:'At least 480 px on the shorter side',status:!hasDimensions?'pending':minimumOK?'pass':'fail',detail:hasDimensions?String(short)+' px':'Check after selecting'},
  {id:'maxPixels',label:'At most 2,560 px on the longer side',status:!hasDimensions?'pending':originalLongOK?'pass':status==='prepare'?'fix':'fail',detail:hasDimensions?String(long)+' px':'Check after selecting'},
  {id:'uploadSize',label:'Final file at most 8 MB',status:!selected?'pending':originalUploadOK?'pass':status==='prepare'?'fix':'fail',detail:out?(out.size/1024/1024).toFixed(2)+' MB':'Original must fit or be locally prepared'}
 ];
 let next='Choose or drop a JPG or PNG original.';
 if(status==='checking')next='Checking the photo dimensions on your device.';
 else if(status==='prepare')next='Use Prepare photo on this device, then recheck the resulting file.';
 else if(status==='invalid')next=plan?.reason||'Choose a higher-quality compatible original or retake the photo.';
 else if(status==='ready'&&pending)next='Resume the saved YouCam task instead of starting another paid scan.';
 else if(status==='ready'&&busy)next='The existing YouCam request is in progress.';
 else if(status==='ready'&&preparing)next='Wait for local photo preparation to finish.';
 else if(status==='ready'&&!consent)next='Review and give explicit consent before requesting a live scan.';
 else if(status==='ready'&&!passcodeReady)next='Enter the private live demo passcode to use the protected API.';
 else if(status==='ready'&&!providerReady)next='Live YouCam authentication is not available; sample mode still works.';
 else if(status==='ready')next='Technical requirements met. YouCam may still reject a poorly framed or unsuitable image.';
 return {
  status:technicalReady?'ready':status==='ready'?'checking':status,
  technicalReady,selected,dimensions:hasDimensions?{width:w,height:h}:null,
  sourceBytes: f?.size??null,uploadBytes:out?.size??null,format: f?.type??null,
  diagnostics,manualChecks:SELF_CHECKS.map(x=>({...x,checked:!!selectedChecks[x.id]})),
  manualCount:confirmed,manualTotal:SELF_CHECKS.length,
  consent:consent===true,passcodeReady:passcodeReady===true,providerReady:providerReady===true,
  pending:pending===true,busy:busy===true,
  canRequestScan:technicalReady&&consent===true&&passcodeReady===true&&providerReady===true&&!pending&&!busy&&!preparing,
  next,needsPreparation:status==='prepare',
  truth:'Dimensions and file bytes are automatically checked in this browser. Face position, lighting, coverage and filters are self-reported, not automatically verified. Passing local checks is not a guarantee of provider acceptance.'
 };
}
