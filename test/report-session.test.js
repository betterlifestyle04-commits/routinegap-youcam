import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makePrivateReport,readPrivateReport,MAX_REPORT_AGE_MS,LIVE_REPORT_SESSION_KEY} from '../public/report-session.js';

const now=1761876000000;
const report=[
  {type:'moisture',uiScore:73,rawScore:48,photo:'private-selfie.png',credential:'never-store'},
  {type:'skin_type',uiScore:null,regions:{whole:'Combination',userName:'private'}}
];
test('a private saved report contains only supported numeric/categorical cosmetic observations',()=>{
  const packed=makePrivateReport(report,now);
  assert.equal(packed.kind,'real-youcam-scan');
  assert.deepEqual(packed.signals,[
    {type:'moisture',uiScore:73,rawScore:48,regions:null},
    {type:'skin_type',uiScore:null,rawScore:null,regions:{whole:'Combination'}}
  ]);
  const serialized=JSON.stringify(packed);
  for(const forbidden of ['private-selfie.png','never-store','private','credential','userName'])assert.equal(serialized.includes(forbidden),false,forbidden);
  assert.ok(LIVE_REPORT_SESSION_KEY.startsWith('routinegap_'));
});
test('saved report can be restored after refresh in the same session, then expires',()=>{
  const serialized=JSON.stringify(makePrivateReport(report,now));
  assert.deepEqual(readPrivateReport(serialized,now+120000),makePrivateReport(report,now));
  assert.ok(readPrivateReport(serialized,now+MAX_REPORT_AGE_MS));
  assert.equal(readPrivateReport(serialized,now+MAX_REPORT_AGE_MS+1),null);
});
test('rejects forged sample, invalid, stale and future reports',()=>{
  assert.equal(readPrivateReport('{bad',now),null);
  assert.equal(readPrivateReport(JSON.stringify({kind:'sample',savedAt:now,signals:report}),now),null);
  assert.equal(readPrivateReport(JSON.stringify({kind:'real-youcam-scan',savedAt:now+100,signals:report}),now),null);
  assert.equal(readPrivateReport('z'.repeat(8000),now),null);
  assert.throws(()=>makePrivateReport([{type:'unsupported',uiScore:75}],now),/no supported/);
  assert.throws(()=>makePrivateReport([],now),/completed real/);
});
test('refuses injecting arbitrary skin type strings and non-finite vendor scores',()=>{
  assert.throws(()=>makePrivateReport([{type:'skin_type',regions:{whole:'<script>alert(1)</script>'},uiScore:Infinity}],now),/no supported/);
  assert.throws(()=>makePrivateReport([{type:'redness',uiScore:NaN,rawScore:-1}],now),/no supported/);
  const clean=makePrivateReport([{type:'redness',uiScore:72,rawScore:'99'}],now);
  assert.equal(clean.signals[0].rawScore,null);
});
test('opt-in is explicit; never store photos, passcodes or receipts; user can delete report',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/id="save-live-report"/);
  assert.match(app,/id="forget-live-report"/);
  assert.match(app,/state\.scanSource!=='live'/);
  assert.match(app,/sessionStorage\.setItem\(LIVE_REPORT_SESSION_KEY,JSON\.stringify\(cleaned\)\)/);
  assert.match(app,/sessionStorage\.removeItem\(LIVE_REPORT_SESSION_KEY\)/);
  assert.match(app,/scan:savedLiveReport\?\.signals/);
});
