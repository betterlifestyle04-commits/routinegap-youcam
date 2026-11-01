import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalog,goals,evaluateShop} from '../public/recommendations.js';
import {SCENARIOS,getScenario,scenarioPreview,scenarioBudgetPreset,scenarioCaseSummary} from '../public/scenario-lab.js';

test('four distinct fictional cases have authored narratives and valid bounded catalog inputs',()=>{
 assert.equal(SCENARIOS.length,4);
 assert.deepEqual(SCENARIOS.map(x=>x.id),['fresh-start','missing-spf','fully-covered','tag-preference']);
 assert.equal(new Set(SCENARIOS.map(x=>x.id)).size,4);
 for(const s of SCENARIOS){
  assert.ok(Object.isFrozen(s));
  assert.ok(s.story.length>90);
  assert.ok(s.takeaway.length>75);
  assert.ok(goals.some(g=>g.id===s.focus));
  assert.ok(Number.isInteger(s.budget)&&s.budget>=0&&s.budget<=1000);
  assert.ok(s.products.every(p=>p.name.startsWith('Example')&&p.price>=0&&['cleanser','moisturizer','spf','serum'].includes(p.step)));
 }
});
test('unknown scenario IDs resolve to the explicit first fictional case, never user data',()=>{
 assert.equal(getScenario('missing-spf').id,'missing-spf');
 for(const id of [null,undefined,'../secrets','__proto__','bad',12])assert.equal(getScenario(id).id,'fresh-start');
});
test('fresh start contains no owned steps and shows matched before/after proposal',()=>{
 const x=scenarioPreview('fresh-start');
 assert.equal(x.coveredCount,0);
 assert.equal(x.ownedCount,0);
 assert.deepEqual(x.missing,['cleanser','moisturizer','spf']);
 assert.equal(x.before.total,x.after.total);
 assert.deepEqual(x.before.shortlist.map(p=>p.id),x.after.shortlist.map(p=>p.id));
 assert.equal(x.cartDifference,0);
});
test('entering a cleanser and moisturizer removes overlap from the essentials-first shortlist',()=>{
 const x=scenarioPreview('missing-spf');
 assert.equal(x.ownedCount,2);
 assert.equal(x.coveredCount,2);
 assert.deepEqual(x.missing,['spf']);
 assert.ok(x.before.count>=2);
 assert.equal(x.after.count,1);
 assert.equal(x.after.shortlist[0].step,'spf');
 assert.ok(x.after.total<=x.before.total);
 assert.ok(x.overlapFlags>0);
});
test('a complete recorded shelf produces no new essential concept selection',()=>{
 const x=scenarioPreview('fully-covered');
 assert.equal(x.coveredCount,3);
 assert.deepEqual(x.missing,[]);
 assert.equal(x.after.count,0);
 assert.equal(x.after.total,0);
 assert.ok(x.before.count>0);
 assert.match(x.takeaway,/not proof/);
});
test('fragrance-related tag preferences restrict fictional concept availability',()=>{
 const x=scenarioPreview('tag-preference');
 const all=evaluateShop({shelf:[],budget:x.budget,goal:x.selectedGoal,fragranceFree:false});
 assert.ok(x.fragranceFree);
 assert.ok(x.taggedConcepts<all.rows.length);
 assert.ok(x.after.shortlist.every(p=>catalog.find(c=>c.id===p.id).tags.includes('fragrance-free')));
 assert.match(x.takeaway,/do not verify/);
});
test('baseline and recorded plans use exactly the existing real shopping logic, not fabricated savings',()=>{
 for(const s of SCENARIOS){
  for(const budget of [0,25,50,75,100,180]){
   const x=scenarioPreview(s.id,{budget});
   const base=evaluateShop({shelf:[],budget,goal:s.focus,fragranceFree:s.fragranceFree});
   const withShelf=evaluateShop({shelf:s.products,budget,goal:s.focus,fragranceFree:s.fragranceFree});
   assert.equal(x.before.total,base.cartTotal);
   assert.equal(x.after.total,withShelf.cartTotal);
   assert.deepEqual(x.before.shortlist.map(r=>r.id),base.cartIds);
   assert.deepEqual(x.after.shortlist.map(r=>r.id),withShelf.cartIds);
   assert.equal(x.cartDifference,base.cartTotal-withShelf.cartTotal);
   assert.equal(x.overlapFlags,withShelf.skippedRedundant);
   assert.ok(x.after.total<=budget);
   assert.ok(x.before.total<=budget);
  }
 }
});
test('different valid budgets change example scenario without mutating authored fixture',()=>{
 const initial=JSON.stringify(SCENARIOS);
 const low=scenarioPreview('missing-spf',{budget:0});
 const high=scenarioPreview('missing-spf',{budget:100});
 assert.equal(low.after.total,0);
 assert.ok(high.after.total>low.after.total);
 assert.equal(JSON.stringify(SCENARIOS),initial);
});
test('budget inputs and optional focus overrides are validated and bounded',()=>{
 assert.equal(scenarioPreview('missing-spf',{budget:-20}).budget,0);
 assert.equal(scenarioPreview('missing-spf',{budget:99999}).budget,1000);
 assert.equal(scenarioPreview('missing-spf',{budget:'garbage'}).budget,65);
 assert.equal(scenarioPreview('missing-spf',{goal:'__proto__'}).selectedGoal,'routine');
 assert.equal(scenarioPreview('missing-spf',{goal:'moisture'}).selectedGoal,'moisture');
 assert.equal(scenarioBudgetPreset('75'),75);
 assert.equal(scenarioBudgetPreset('15'),null);
 assert.equal(scenarioBudgetPreset(null),null);
 assert.equal(scenarioBudgetPreset('25.5'),null);
});
test('profile exports are authored, non-sensitive and contain honest provenance',()=>{
 const report=scenarioCaseSummary('missing-spf',{budget:75});
 assert.match(report,/fictional scenario/i);
 assert.match(report,/before|without the example shelf/i);
 assert.match(report,/with the example shelf/i);
 assert.match(report,/not realized savings/i);
 assert.match(report,/not verified/i);
 assert.ok(!report.includes('passcode'));
 assert.ok(!report.includes('routinegap_state'));
 assert.ok(!report.includes('api\/scan'));
});
test('all four cases have decision differences grounded in recorded ownership',()=>{
 for(const s of SCENARIOS){
  const x=scenarioPreview(s.id);
  assert.equal(x.scenarioOwned.length,s.products.length);
  assert.deepEqual(x.covered,s.products.filter(p=>['cleanser','moisturizer','spf'].includes(p.step)).map(p=>p.step));
  assert.ok(x.before.shortlist.every(p=>catalog.some(c=>c.id===p.id)));
  assert.ok(x.after.shortlist.every(p=>catalog.some(c=>c.id===p.id)));
  assert.match(x.provenance,/not realized savings/);
  assert.match(x.constraints,/not because its ingredients/);
 }
});
test('Scenario Lab is a real interactive responsive feature of My Insights and Overview',async()=>{
 const [app,css,pkg]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
  readFile(new URL('../package.json',import.meta.url),'utf8')
 ]);
 for(const token of ['function renderScenarioLab()','function downloadScenarioCase()','id="scenario-lab"',
  'id="scenario-lab-content"','data-scenario-case','data-scenario-case-budget','id="scenario-case-reset"',
  'id="scenario-case-export"','renderScenarioLab();', 'SCENARIOS.map', 'scenarioPreview(',
  "state.scenarioCaseId", "state.scenarioCaseBudget","Open Scenario Lab →"])
  assert.ok(app.includes(token),token);
 assert.ok(css.includes('.scenario-case-grid')&&css.includes('.scenario-comparison')&&css.includes('@media(max-width:650px)'));
 assert.ok(pkg.includes('node --check public/scenario-lab.js'));
});
test('Scenario Lab model requires no new browser storage keys or API requests',async()=>{
 const src=await readFile(new URL('../public/scenario-lab.js',import.meta.url),'utf8');
 for(const needle of ['fetch(', 'sessionStorage', 'localStorage', 'XMLHttpRequest', '/api/scan'])
  assert.ok(!src.includes(needle),'Forbidden side effect: '+needle);
});
