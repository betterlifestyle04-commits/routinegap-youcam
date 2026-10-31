import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {UNCERTAIN_SCAN_KEY,UNCERTAIN_MAX_AGE_MS,JOURNEY_STEPS,newUncertainMarker,readUncertainMarker,
 classifyStartResponse,scanJourney} from '../public/scan-journey.js';

test('four journey stages are factual milestones, never a fake percentage',()=>{
 assert.deepEqual(JOURNEY_STEPS.map(s=>s.id),['photo','consent','provider','report']);
 const a=scanJourney({});
 assert.equal(a.state,'empty');
 assert.equal(a.canStartNew,false);
 assert.equal(a.steps.every(x=>x.status==='waiting'),true);
 assert.match(a.truth,/does not estimate provider completion percentages/);
});
test('local photo and explicit authorization cannot be confused with provider completion',()=>{
 const a=scanJourney({hasPhoto:true,imageReady:true,consent:true,passcode:true,authenticated:true});
 assert.equal(a.state,'preparing');
 assert.equal(a.canStartNew,true);
 assert.deepEqual(a.steps.map(x=>x.status),['done','done','waiting','waiting']);
 const b=scanJourney({hasPhoto:true,imageReady:false,consent:true,passcode:true,authenticated:true});
 assert.equal(b.canStartNew,false);
 assert.equal(b.steps[0].status,'waiting');
});
test('a pending receipt always blocks another paid upload, even when photo is eligible',()=>{
 const j=scanJourney({pending:true,hasPhoto:true,imageReady:true,consent:true,passcode:true,authenticated:true});
 assert.equal(j.state,'pending');
 assert.equal(j.canStartNew,false);
 assert.equal(j.hasReceipt,true);
 assert.equal(j.steps[2].status,'done');
 assert.match(j.subtitle,/do not upload/i);
});
test('an uncertain submission blocks repeat chargeable requests regardless of consent or provider status',()=>{
 const j=scanJourney({uncertain:true,pending:false,hasPhoto:true,imageReady:true,
  consent:true,passcode:true,authenticated:true});
 assert.equal(j.state,'uncertain');
 assert.equal(j.canStartNew,false);
 assert.equal(j.blockedByUncertainty,true);
 assert.equal(j.hasReceipt,false);
 assert.equal(j.steps[2].status,'uncertain');
 assert.match(j.subtitle,/may already have/i);
});
test('work in progress is visible, but never presented as a completed scan',()=>{
 const upload=scanJourney({busy:true,phase:'uploading',hasPhoto:true,imageReady:true});
 assert.equal(upload.state,'working');
 assert.match(upload.label,/SUBMITTING/);
 assert.equal(upload.realReport,false);
 const polling=scanJourney({busy:true,phase:'processing',pending:true,poll:4});
 assert.equal(polling.state,'working');
 assert.match(polling.subtitle,/Poll 4 of 17/);
 assert.equal(polling.canStartNew,false);
 assert.equal(polling.steps[3].status,'waiting');
});
test('sample observations are explicitly different from provider-confirmed real results',()=>{
 const sample=scanJourney({scanSource:'sample',hasReport:true});
 assert.equal(sample.state,'sample');
 assert.equal(sample.realReport,false);
 assert.equal(sample.exampleOnly,true);
 assert.equal(sample.steps[3].status,'waiting');
 const real=scanJourney({scanSource:'live',hasReport:true});
 assert.equal(real.state,'complete');
 assert.equal(real.realReport,true);
 assert.equal(real.steps[2].status,'done');
 assert.equal(real.steps[3].status,'done');
 assert.match(real.subtitle,/not a medical diagnosis/);
});
test('transport failures and unreadable responses are uncertain, not safe to retry',()=>{
 assert.equal(classifyStartResponse({networkFailure:true}),'uncertain');
 assert.equal(classifyStartResponse({unreadable:true,status:200}),'uncertain');
 assert.equal(classifyStartResponse({status:500}),'uncertain');
 assert.equal(classifyStartResponse({status:503}),'uncertain');
 assert.equal(classifyStartResponse({status:200}),'uncertain');
 assert.equal(classifyStartResponse({status:200,receipt:''}),'uncertain');
 assert.equal(classifyStartResponse({status:200,receipt:'x'.repeat(601)}),'uncertain');
 assert.equal(classifyStartResponse({status:200,receipt:'valid-receipt'}),'started');
});
test('clear client rejections can be retried after fixing validation without a fake receipt',()=>{
 for(const status of [400,401,403,404,415,429])assert.equal(classifyStartResponse({status}),'rejected');
 assert.equal(classifyStartResponse({status:null}),'uncertain');
 assert.equal(classifyStartResponse({status:999}),'uncertain');
});
test('uncertainty marker is limited to a 24-hour timestamp; no photo, passcode or task ID',()=>{
 const now=1800000000000;
 const marker=newUncertainMarker(now);
 assert.deepEqual(marker,{kind:'submission-unknown',createdAt:now});
 assert.equal(UNCERTAIN_SCAN_KEY,'routinegap_uncertain_scan_v1');
 assert.equal(UNCERTAIN_MAX_AGE_MS,86400000);
 assert.deepEqual(readUncertainMarker(JSON.stringify(marker),now+1),marker);
 assert.deepEqual(readUncertainMarker(JSON.stringify(marker),now+UNCERTAIN_MAX_AGE_MS-1),marker);
 assert.equal(readUncertainMarker(JSON.stringify(marker),now+UNCERTAIN_MAX_AGE_MS),null);
 assert.equal(readUncertainMarker(JSON.stringify(marker),now-1),null);
 assert.ok(!JSON.stringify(marker).includes('receipt'));
 assert.ok(!JSON.stringify(marker).includes('photo'));
});
test('invalid markers, secrets and fake timestamps are rejected without evaluating code',()=>{
 const now=1800000000000;
 for(const value of ['',null,'malformed','{}','[]',
  JSON.stringify({kind:'submission-unknown',createdAt:'string'}),
  JSON.stringify({kind:'submission-unknown',createdAt:Infinity}),
  JSON.stringify({kind:'other',createdAt:now}),
  JSON.stringify({kind:'submission-unknown',createdAt:0}),
  'x'.repeat(151)])assert.equal(readUncertainMarker(value,now),null);
 assert.throws(()=>newUncertainMarker(-5),TypeError);
 assert.throws(()=>newUncertainMarker(2.5),TypeError);
});
test('client UI displays accurate scan status, explicitly blocks duplicate sends and retains warning',async()=>{
 const [app,css,privacy,pkg]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
  readFile(new URL('../public/data-center.js',import.meta.url),'utf8'),
  readFile(new URL('../package.json',import.meta.url),'utf8')
 ]);
 for(const text of ['function renderScanJourney()','function clearUncertainSubmission()',
  'state.uncertainSubmission','renderScanJourney()}','id="scan-uncertain-clear"',
  'classifyStartResponse({status:response?.status??null','newUncertainMarker()',
  "signal:AbortSignal.timeout(90000)","state.scanPhase='processing'","state.scanPhase='complete'",
  'state.scanPoll=i+1',"if(state.uncertainSubmission)return notice("]){
  assert.ok(app.includes(text),text);
 }
 assert.ok(css.includes('.scan-journey')&&css.includes('.scan-uncertainty-banner'));
 assert.ok(privacy.includes(UNCERTAIN_SCAN_KEY));
 assert.ok(pkg.includes('node --check public/scan-journey.js'));
});
