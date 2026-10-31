import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRoutinePlan,localRoutineDate,readRoutineLog,toggleRoutineStep,routineProgress,ROUTINE_LOG_KEY} from '../public/routine-planner.js';

const owned=[
  {id:'real-cleans',step:'cleanser',name:'My own cleanser'},
  {id:'real-spf',step:'spf',name:'My own SPF'},
  {id:'extra-serum',step:'serum',name:'Prescription or active ingredient not to auto-schedule'}
];
test('routine maps only actual owned items and never invents a product',()=>{
  const plan=buildRoutinePlan(owned);
  assert.equal(plan.morning.length,3);
  assert.equal(plan.evening.length,2);
  assert.equal(plan.availableCount,3);
  assert.deepEqual(plan.missingSteps,['moisturizer']);
  assert.ok(plan.morning.some(x=>x.step==='spf'&&x.productName==='My own SPF'));
  assert.ok(plan.evening.every(x=>x.step!=='spf'));
  assert.ok([...plan.morning,...plan.evening].every(x=>x.step!=='serum'));
  assert.equal(plan.evening.find(x=>x.step==='moisturizer').available,false);
});
test('empty shelf has no user-recordable activity and identifies unique gaps',()=>{
  const plan=buildRoutinePlan([]);
  const date='2026-10-31';
  assert.equal(plan.availableCount,0);
  assert.deepEqual(plan.missingSteps,['cleanser','moisturizer','spf']);
  assert.deepEqual(toggleRoutineStep(null,date,plan,'am-cleanser:fake',true),{date,done:[]});
  assert.deepEqual(routineProgress(readRoutineLog(null,date,plan),plan),{completed:0,total:0});
});
test('self-reported daily checkmarks can be toggled, and only count available owned steps',()=>{
  const plan=buildRoutinePlan(owned),date='2026-10-31';
  const valid=plan.morning.find(x=>x.step==='cleanser').key;
  const initial=readRoutineLog(null,date,plan);
  const first=toggleRoutineStep(initial,date,plan,valid,true);
  assert.deepEqual(first,{date,done:[valid]});
  assert.deepEqual(routineProgress(first,plan),{completed:1,total:3});
  assert.deepEqual(toggleRoutineStep(first,date,plan,valid,false),{date,done:[]});
});
test('forged, stale, duplicate, and unrelated local checklist keys are ignored',()=>{
  const date='2026-10-31',plan=buildRoutinePlan(owned),key=plan.morning[0].key;
  const raw=JSON.stringify({date,done:[key,key,'am-moisturizer:forged','pm-spf:wrong',null,{},'secret']});
  assert.deepEqual(readRoutineLog(raw,date,plan),{date,done:[key]});
  assert.deepEqual(readRoutineLog(JSON.stringify({date:'2026-10-30',done:[key]}),date,plan),{date,done:[]});
  assert.deepEqual(readRoutineLog('not valid json',date,plan),{date,done:[]});
  assert.deepEqual(readRoutineLog(JSON.stringify({date,done:[key]}),date,buildRoutinePlan([])),{date,done:[]});
});
test('no photo, score, name, credentials, or tracking ID is stored in checklist records',()=>{
  const date='2026-10-31',plan=buildRoutinePlan(owned),key=plan.morning[0].key;
  const json=JSON.stringify(toggleRoutineStep(null,date,plan,key,true));
  assert.ok(json.includes('real-cleans'));
  assert.ok(!json.includes('My own cleanser'));
  assert.ok(!json.includes('Prescription'));
  assert.ok(!json.includes('youcam'));
  assert.ok(!json.includes('photo'));
  assert.match(ROUTINE_LOG_KEY,/routinegap_/);
});
test('product IDs are encoded in stable checklist keys rather than HTML attribute fragments',()=>{
  const plan=buildRoutinePlan([{id:'unexpected\" onmouseover=alert(1)',step:'cleanser',name:'<script>example</script>'}]);
  assert.ok(plan.morning[0].key.includes('%22'));
  assert.ok(!plan.morning[0].key.includes('\"'));
  assert.equal(plan.morning[0].productName,'<script>example</script>'); // UI is responsible for HTML escaping.
});
test('local date labels reset by device calendar date, not provider UTC time',()=>{
  assert.equal(localRoutineDate(new Date(2026,9,31,11,0,0)),'2026-10-31');
  assert.equal(localRoutineDate(new Date(2026,10,1,11,0,0)),'2026-11-01');
  assert.throws(()=>localRoutineDate(new Date(NaN)),/Invalid date/);
});
