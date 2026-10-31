import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalog} from '../src/recommendations.js';
import {BASIC_STEPS,ALL_STEPS,makeInsights,evaluateBudgetScenario} from '../public/insights.js';
const shelf=[
 {id:'one',name:'Cleanser',step:'cleanser',price:14,tags:['gentle']},
 {id:'two',name:'Daily moisturizer',step:'moisturizer',price:21.5,tags:[]},
 {id:'three',name:'Second moisturizer',step:'moisturizer',price:11,tags:[]},
 {id:'four',name:'Optional serum',step:'serum',price:18,tags:[]}
];
const opts={shelf,sampleInventory:false,budget:40,goal:'moisture'};

test('insights are based only on user-entered shelf categories and recorded amounts',()=>{
 const snapshot=makeInsights(opts);
 assert.equal(snapshot.ownedCount,4);
 assert.equal(snapshot.recordedPriceTotal,64.5);
 assert.deepEqual(snapshot.counts,{cleanser:1,moisturizer:2,spf:0,serum:1});
 assert.deepEqual(snapshot.costs,{cleanser:14,moisturizer:32.5,spf:0,serum:18});
 assert.deepEqual(snapshot.covered,['cleanser','moisturizer']);
 assert.deepEqual(snapshot.gaps,['spf']);
 assert.equal(snapshot.coveredCount,2);
 assert.equal(snapshot.coveragePercent,67);
 assert.equal(snapshot.sampleInventory,false);
 assert.match(snapshot.lastDataPoint,/no tracking/);
});
test('illustrative starter shelf never masquerades as a real user inventory',()=>{
 const data=makeInsights({...opts,sampleInventory:true,shelf});
 assert.equal(data.ownedCount,0);
 assert.equal(data.recordedPriceTotal,0);
 assert.equal(data.coveragePercent,0);
 assert.deepEqual(data.counts,{cleanser:0,moisturizer:0,spf:0,serum:0});
 assert.deepEqual(data.gaps,BASIC_STEPS);
 assert.equal(data.duplicateMatches,0);
});
test('empty genuine shelf also shows zero coverage and no invented history',()=>{
 const data=makeInsights({...opts,shelf:[]});
 assert.equal(data.ownedCount,0);assert.equal(data.coveredCount,0);assert.equal(data.recordedPriceTotal,0);
 assert.deepEqual(data.gaps,BASIC_STEPS);
});
test('all recorded essential categories means no essential shopping suggestion',()=>{
 const withSpf=makeInsights({...opts,shelf:[...shelf,{id:'sun',name:'My SPF',step:'spf',price:12,tags:[]}]});
 assert.equal(withSpf.coveredCount,3);assert.equal(withSpf.coveragePercent,100);
 const scenario=evaluateBudgetScenario(withSpf,120);
 assert.equal(scenario.noNewPurchase,true);
 assert.equal(scenario.spent,0);
 assert.deepEqual(scenario.suggested,[]);
 assert.deepEqual(scenario.unmetGaps,[]);
});
test('budget simulator is independent from the selected real budget and cart',()=>{
 const input={...opts,cartIds:['mineral-spf'],savedIds:['clear-spf']};
 const snap=makeInsights(input);
 const original=JSON.stringify(snap);
 const nothing=evaluateBudgetScenario(snap,0);
 const generous=evaluateBudgetScenario(snap,120);
 assert.equal(nothing.budget,0);
 assert.equal(nothing.spent,0);
 assert.ok(generous.spent<=120);
 assert.ok(generous.suggested.every(x=>x.step==='spf'));
 assert.equal(generous.unmetGaps.length,0);
 assert.equal(snap.decision.budget,40);
 assert.equal(snap.cartTotal,23);
 assert.equal(snap.savedCount,1);
 assert.equal(JSON.stringify(snap),original,"what-if exploration must not mutate the user\'s snapshot or cart");
});
test('simulator caps invalid and excessive budgets, protects essential-only priority',()=>{
 const snap=makeInsights({...opts,shelf:[],budget:60});
 for(const budget of [NaN,-100,'invalid',0,5,10,30,60,100,1000000,Infinity]){
  const scenario=evaluateBudgetScenario(snap,budget);
  assert.ok(scenario.budget>=0&&scenario.budget<=1000);
  assert.ok(scenario.spent>=0&&scenario.spent<=scenario.budget);
  assert.equal(scenario.remaining,scenario.budget-scenario.spent);
  assert.ok(scenario.suggested.every(p=>BASIC_STEPS.includes(p.step)));
  assert.equal(new Set(scenario.suggested.map(p=>p.step)).size,scenario.suggested.length);
 }
 assert.throws(()=>evaluateBudgetScenario(null,50),/snapshot/);
});
test('all counts correspond to declared steps and fictional catalog, with no fabricated savings',()=>{
 const snap=makeInsights({...opts,savedIds:catalog.map(p=>p.id)});
 assert.deepEqual(ALL_STEPS,['cleanser','moisturizer','spf','serum']);
 assert.equal(snap.savedCount,catalog.length);
 assert.equal(snap.duplicateMatches,snap.decision.rows.filter(p=>p.decision==='skip').length);
 assert.ok(!Object.hasOwn(snap,'savedMoney')&&!Object.hasOwn(snap,'savings'));
});
test('real UI connects Insights nav, explanatory labels and slider without external provider requests',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
 for(const needle of ['function renderInsights()','function renderScenario(snapshot)','id="insights-budget-slider"','data-scenario-budget','data-go="insights"','Snapshot only','Not longitudinal analytics','state.insightBudget'])assert.ok(app.includes(needle),needle);
 for(const needle of ['data-tab="insights"','id="view-insights"'])assert.ok(html.includes(needle));
 assert.ok(css.includes('.insights-progress-ring')&&css.includes('@media(max-width:560px)'));
 assert.ok(!app.includes('fetch("/api/insights"'));
});
