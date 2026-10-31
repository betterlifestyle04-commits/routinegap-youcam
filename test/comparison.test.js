import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalog,sampleShelf} from '../src/recommendations.js';
import {COMPARE_KEY,MAX_COMPARE,normalizeCompareIds,toggleCompareId,buildComparison,filterComparisonCandidates,COMPARE_FILTER_STEPS} from '../public/comparison.js';

const ids=['mist-cleanser','daily-gel','mineral-spf'];
const owned=[{id:'owned-c',name:'My personal cleanser',step:'cleanser',price:21,tags:[]},
 {id:'owned-m',name:'My moisturizer',step:'moisturizer',price:18,tags:[]}];

test('saved comparison IDs are recognized, unique, capped and never untrusted data',()=>{
 const list=normalizeCompareIds(JSON.stringify(['mist-cleanser','fake','mist-cleanser',...ids,'clear-spf']),catalog);
 assert.equal(list.length,MAX_COMPARE);
 assert.deepEqual(list,ids);
 assert.deepEqual(normalizeCompareIds('{broken',catalog),[]);
 assert.deepEqual(normalizeCompareIds('{"id":"mist-cleanser"}',catalog),[]);
 assert.deepEqual(normalizeCompareIds(null,catalog),[]);
 assert.match(COMPARE_KEY,/routinegap_/);
});
test('comparison selection toggles on/off, respects three items, rejects unknown IDs',()=>{
 let state=toggleCompareId([],ids[0],catalog);
 assert.deepEqual(state.ids,[ids[0]]);
 assert.equal(state.added,true);
 state=toggleCompareId(state.ids,ids[1],catalog);
 state=toggleCompareId(state.ids,ids[2],catalog);
 const over=toggleCompareId(state.ids,'clear-spf',catalog);
 assert.deepEqual(over.ids,ids);
 assert.equal(over.limitReached,true);
 assert.deepEqual(toggleCompareId(ids,ids[0],catalog).ids,ids.slice(1));
 assert.deepEqual(toggleCompareId(ids,'<script>',catalog).ids,ids);
});
test('catalog searching filters by category, tags, description and name',()=>{
 assert.ok(filterComparisonCandidates(catalog,{query:'mineral'}).some(p=>p.id==='mineral-spf'));
 assert.ok(filterComparisonCandidates(catalog,{query:'fragrance-free',step:'spf'}).every(p=>p.step==='spf'&&p.tags.includes('fragrance-free')));
 assert.ok(filterComparisonCandidates(catalog,{query:'no-results-at-all'}).length===0);
 assert.deepEqual(filterComparisonCandidates(catalog,{step:'unexpected'}),catalog);
 assert.deepEqual(COMPARE_FILTER_STEPS,['all','cleanser','moisturizer','spf','serum']);
});
test('overlap is based on actual owned routine category, not fictitious claims about ingredients',()=>{
 const d=buildComparison({catalog,ids,owned,budget:60,goal:'moisture',savedIds:['mineral-spf']});
 assert.equal(d.entries.length,3);
 assert.equal(d.ownedOverlap,2);
 assert.equal(d.entries[0].ownedStep,true);
 assert.equal(d.entries[1].ownedStep,true);
 assert.equal(d.entries[2].ownedStep,false);
 assert.equal(d.entries[2].saved,true);
 assert.equal(d.total,12+17+23);
 assert.equal(d.withinCombinedBudget,true);
 assert.equal(d.entries[2].withinBudget,true);
 assert.equal(d.hasAlternatives,false);
});
test('sample starter shelf never counts as actual owned product in comparison',()=>{
 const d=buildComparison({catalog,ids,owned:sampleShelf,budget:50,sampleInventory:true});
 assert.equal(d.sampleInventory,true);
 assert.equal(d.ownedOverlap,0);
 assert.ok(d.entries.every(p=>!p.ownedStep));
});
test('same-step alternatives are flagged without presenting them as necessary extra purchases',()=>{
 const d=buildComparison({catalog,ids:['mineral-spf','clear-spf','soft-mineral-spf'],owned:[],budget:30});
 assert.equal(d.sameStep,true);
 assert.equal(d.hasAlternatives,true);
 assert.equal(d.total,23+25+28);
 assert.equal(d.withinCombinedBudget,false);
 assert.match(d.note,/alternatives/);
 assert.ok(d.entries.every(p=>p.withinBudget));
});
test('individual budget match, excluded fragrance preference, and chosen focus are transparent',()=>{
 const d=buildComparison({catalog,ids:['mineral-spf','clear-spf'],owned:[],budget:24,goal:'routine',fragranceFree:true});
 assert.equal(d.entries[0].withinBudget,true);
 assert.equal(d.entries[1].withinBudget,false);
 assert.equal(d.preferenceExcluded,1);
 assert.equal(d.entries[1].excludesPreference,true);
 assert.equal(d.entries[0].goalMatch,true);
 assert.equal(d.entries[1].goalMatch,false);
});
test('comparing does not mutate user inventory, cart, saved list or original catalog',()=>{
 const opts={catalog,ids,owned,budget:60,savedIds:['mineral-spf']};
 const prior=JSON.stringify(opts);
 const d=buildComparison(opts);
 assert.equal(JSON.stringify(opts),prior);
 assert.deepEqual(d.selected,ids);
 d.entries[0].name='changed';
 assert.notEqual(catalog.find(p=>p.id===ids[0]).name,'changed');
});
test('empty comparison renders explicit invitation and no false conclusions',()=>{
 const d=buildComparison({catalog,ids:[],owned,fragranceFree:false});
 assert.equal(d.entries.length,0);
 assert.equal(d.total,0);
 assert.equal(d.ownedOverlap,0);
 assert.match(d.note,/Select up to three/);
});
test('new Compare Lab is actually linked, keyboard operable, and not a hidden payment integration',async()=>{
 const [html,js,css,pkg]=await Promise.all([
   readFile(new URL('../public/index.html',import.meta.url),'utf8'),
   readFile(new URL('../public/app.js',import.meta.url),'utf8'),
   readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
   readFile(new URL('../package.json',import.meta.url),'utf8')
 ]);
 for(const piece of ['data-tab="compare"','id="view-compare"'])assert.ok(html.includes(piece),piece);
 for(const piece of ["function renderCompare()","function renderComparePicker()",'data-compare','aria-pressed','id="compare-search"','id="compare-step"','Compare concepts ('])assert.ok(js.includes(piece),piece);
 assert.ok(js.includes('state.sampleInventory'));
 assert.ok(js.includes("localStorage.setItem(COMPARE_KEY"));
 assert.ok(js.includes("WORKSPACE_PAGES.some(p=>p.id===tab)"),'navigation is validated against the centralized route list');
 assert.ok(css.includes('.compare-matrix')&&css.includes('.compare-table-scroll'));
 assert.ok(pkg.includes('node --check public/comparison.js'));
 assert.equal(js.includes("fetch('/api/checkout"),false);
});
