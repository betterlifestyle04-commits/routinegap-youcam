import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalog,goals,sampleShelf,evaluateShop} from '../public/recommendations.js';
import {PREF_STAGES,DEMO_BUDGETS,normalizePreferenceDraft,modifyPreferenceDraft,preferencePreview,stepPreferenceStage,differentPreferences} from '../public/preference-studio.js';
const owned=[{id:'real-1',name:'My actual cream',step:'moisturizer',price:16,tags:['hydrating']}];
test('wizard has three bounded steps and four transparent demo budget presets',()=>{
 assert.deepEqual(PREF_STAGES.map(x=>x.id),['focus','budget','review']);
 assert.deepEqual(DEMO_BUDGETS,[25,50,75,100]);
 assert.equal(stepPreferenceStage(0,'next'),1);
 assert.equal(stepPreferenceStage(1,'next'),2);
 assert.equal(stepPreferenceStage(2,'next'),2);
 assert.equal(stepPreferenceStage(0,'back'),0);
 assert.equal(stepPreferenceStage(2,'back'),1);
 for(const invalid of [-1,3,2.5,'2',NaN,null])assert.equal(stepPreferenceStage(invalid,'next'),null);
 assert.equal(stepPreferenceStage(0,'cancel'),null);
});
test('normalization clamps and sanitizes budget and declared goals without diagnosing anything',()=>{
 assert.deepEqual(normalizePreferenceDraft({goal:'moisture',budget:'75',fragranceFree:true}),{goal:'moisture',budget:75,fragranceFree:true});
 assert.equal(normalizePreferenceDraft({goal:'unknown',budget:'99999',fragranceFree:'true'}).budget,1000);
 assert.equal(normalizePreferenceDraft({goal:'unknown',budget:-10,fragranceFree:'true'}).goal,'moisture');
 assert.equal(normalizePreferenceDraft({budget:' '}).budget,0);
 assert.equal(normalizePreferenceDraft({budget:'NaN'}).budget,60);
 assert.ok(goals.every(g=>normalizePreferenceDraft({goal:g.id}).goal===g.id));
});
test('edits produce new drafts, preserve untouched choices and ignore untrusted keys',()=>{
 const original=Object.freeze({goal:'moisture',budget:60,fragranceFree:false});
 const changed=modifyPreferenceDraft(original,{goal:'texture'});
 assert.deepEqual(original,{goal:'moisture',budget:60,fragranceFree:false});
 assert.deepEqual(changed,{goal:'texture',budget:60,fragranceFree:false});
 assert.deepEqual(modifyPreferenceDraft(original,{goal:'<script>'}),original);
 assert.deepEqual(modifyPreferenceDraft(original,{fragranceFree:1}),original);
 assert.equal(modifyPreferenceDraft(original,{budget:9.7}).budget,10);
 assert.deepEqual(modifyPreferenceDraft(original,{__proto__: {isAdmin:true}}),original);
});
test('sample shelf is always excluded from real ownership counts, even if it contains products',()=>{
 const preview=preferencePreview({goal:'routine',budget:60},{shelf:sampleShelf,sampleInventory:true});
 assert.equal(preview.realOwned,0);
 assert.equal(preview.covered,0);
 assert.deepEqual(preview.missingSteps,['cleanser','moisturizer','spf']);
 assert.equal(preview.source,'sample-excluded');
 assert.match(preview.disclosure,/Fictional catalog/);
});
test('genuine owned steps reduce gaps, and demo prices never become real purchases',()=>{
 const actual=preferencePreview({goal:'moisture',budget:100},{shelf:owned,sampleInventory:false});
 assert.equal(actual.realOwned,1);
 assert.equal(actual.covered,1);
 assert.deepEqual(actual.missingSteps,['cleanser','spf']);
 assert.equal(actual.source,'actual-shelf');
 assert.ok(actual.exampleTotal<=100);
 assert.ok(actual.candidate.every(p=>p.step!=='moisturizer'));
 assert.ok(actual.candidate.every(p=>catalog.some(c=>c.id===p.id&&c.price===p.price)));
 assert.match(actual.disclosure,/No real inventory, checkout/);
});
test('preview uses existing evaluation rules exactly, including budget and goal preferences',()=>{
 for(const goal of goals){
  for(const budget of [0,25,60,100]){
   const draft={goal:goal.id,budget,fragranceFree:false};
   const preview=preferencePreview(draft,{shelf:owned,sampleInventory:false});
   const base=evaluateShop({shelf:owned,...draft});
   assert.deepEqual(preview.candidate.map(x=>x.id),base.cartIds);
   assert.equal(preview.exampleTotal,base.cartTotal);
   assert.equal(preview.remaining,base.remaining);
  }
 }
});
test('fragrance-free is a fictional tag filter only, not ingredient certification',()=>{
 const base=preferencePreview({goal:'moisture',budget:60,fragranceFree:false});
 const filtered=preferencePreview({goal:'moisture',budget:60,fragranceFree:true});
 assert.ok(filtered.exploredCount<=base.exploredCount);
 assert.ok(filtered.exploredCount>0);
 assert.match(filtered.fragranceNote,/no verified ingredient/);
 assert.ok(filtered.candidate.every(p=>catalog.find(c=>c.id===p.id).tags.includes('fragrance-free')));
});
test('preference change detection supports true cancel and save behavior',()=>{
 const a={goal:'moisture',budget:60,fragranceFree:false};
 assert.equal(differentPreferences(a,{...a}),false);
 assert.equal(differentPreferences(a,{...a,budget:75}),true);
 assert.equal(differentPreferences(a,{...a,goal:'oiliness'}),true);
 assert.equal(differentPreferences(a,{...a,fragranceFree:true}),true);
});
test('preview does not mutate supplied products or draft state',()=>{
 const shelf=owned.map(p=>({...p}));
 const raw=JSON.stringify(shelf);
 const draft=Object.freeze({goal:'texture',budget:75,fragranceFree:true});
 const first=preferencePreview(draft,{shelf,sampleInventory:false});
 first.candidate.push({id:'fake'});
 assert.equal(JSON.stringify(shelf),raw);
 assert.deepEqual(draft,{goal:'texture',budget:75,fragranceFree:true});
});
test('Preference Studio is a real accessible workspace interaction, not a placeholder',async()=>{
 const [html,app,css,pkg]=await Promise.all([
   readFile(new URL('../public/index.html',import.meta.url),'utf8'),
   readFile(new URL('../public/app.js',import.meta.url),'utf8'),
   readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
   readFile(new URL('../package.json',import.meta.url),'utf8')
 ]);
 for(const t of ['id="preference-overlay" hidden','id="preference-dialog" role="dialog"','aria-modal="true"','id="preference-close"'])assert.ok(html.includes(t),t);
 for(const t of ['function renderPreferenceStudio()','function openPreferenceStudio()','function closePreferenceStudio(','function changePreferenceStage(action)',
 'id="launch-preference-studio"','id="shop-preference-studio"','data-pref-goal','data-pref-action','id="pref-budget-number"','id="pref-fragrance"',
 'state.cartIds=[];persist();','normalizePreferenceDraft(','preferencePreview('])assert.ok(app.includes(t),t);
 assert.ok(app.includes("if(event.key==='Escape')"));
 assert.ok(css.includes('.preference-overlay[hidden]')&&css.includes('.pref-goal-grid')&&css.includes('@media(max-width:460px)'));
 assert.ok(pkg.includes('node --check public/preference-studio.js'));
});
