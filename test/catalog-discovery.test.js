import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog as serverCatalog,evaluateShop,sampleShelf} from '../src/recommendations.js';
import {catalog as browserCatalog} from '../public/recommendations.js';
import {SAVED_CONCEPTS_KEY,MAX_SAVED_CONCEPTS,FILTER_STEPS,FILTER_DECISIONS,SORT_OPTIONS,
  normalizeSavedConcepts,toggleSavedConcept,discoverConcepts} from '../public/catalog-discovery.js';

const evaluated=evaluateShop({shelf:sampleShelf,goal:'moisture',budget:60});
test('concept dataset is identical on server and browser, deliberately fictional and unique',()=>{
  assert.deepEqual(browserCatalog,serverCatalog);
  assert.equal(serverCatalog.length,25);
  assert.equal(new Set(serverCatalog.map(x=>x.id)).size,25);
  assert.ok(serverCatalog.every(x=>x.brand==='RoutineGap concepts'||x.brand==='Concept collection'));
  assert.ok(serverCatalog.every(x=>Number.isFinite(x.price)&&x.price>0&&typeof x.description==='string'));
  assert.deepEqual(new Set(serverCatalog.map(x=>x.step)),new Set(['cleanser','moisturizer','spf','serum']));
});
test('sort and filters do not change the canonical matching results or recommendations',()=>{
  const before=evaluated.rows.map(x=>x.id);
  const found=discoverConcepts(evaluated.rows,{query:'gel',step:'moisturizer',sort:'price-low'});
  assert.ok(found.length>0&&found.every(x=>x.step==='moisturizer'));
  assert.ok(found.every(x=>[x.name,x.description,...x.tags].join(' ').toLowerCase().includes('gel')));
  assert.deepEqual(evaluated.rows.map(x=>x.id),before);
  const expected=evaluateShop({shelf:sampleShelf,goal:'moisture',budget:60});
  assert.deepEqual(expected.cartIds,evaluated.cartIds);
});
test('every catalog step can be filtered without leaking another category',()=>{
  for(const step of FILTER_STEPS.filter(x=>x!=='all')){
    const found=discoverConcepts(evaluated.rows,{step});
    assert.ok(found.length>0);
    assert.ok(found.every(p=>p.step===step));
  }
});
test('actionability puts already-owned cleanser and moisturizer last without hiding them',()=>{
  const results=discoverConcepts(evaluated.rows,{sort:'recommended'});
  assert.equal(results.length,evaluated.rows.length);
  const firstSkip=results.findIndex(x=>x.decision==='skip');
  assert.ok(firstSkip>0);
  assert.ok(results.slice(firstSkip).every(x=>x.decision==='skip'));
  const skipped=discoverConcepts(evaluated.rows,{decision:'skip'});
  assert.ok(skipped.length>0&&skipped.every(x=>['cleanser','moisturizer'].includes(x.step)));
  assert.ok(discoverConcepts(evaluated.rows,{decision:'consider'}).every(x=>x.decision==='consider'));
});
test('saved-board filter, search, affordable-only and price sorting compose consistently',()=>{
  const one=evaluated.rows.find(x=>x.step==='spf'),saved=[one.id];
  const results=discoverConcepts(evaluated.rows,{savedOnly:true,savedIds:saved,step:'spf',affordableOnly:true,budget:one.price});
  assert.deepEqual(results.map(x=>x.id),saved);
  assert.equal(discoverConcepts(evaluated.rows,{savedOnly:true,savedIds:[],step:'spf'}).length,0);
  assert.equal(discoverConcepts(evaluated.rows,{affordableOnly:true,budget:0}).length,0);
  const ascending=discoverConcepts(evaluated.rows,{sort:'price-low'});
  const descending=discoverConcepts(evaluated.rows,{sort:'price-high'});
  assert.ok(ascending[0].price<=ascending.at(-1).price);
  assert.ok(descending[0].price>=descending.at(-1).price);
});
test('untrusted saved concept IDs are allowlisted, deduplicated and capped',()=>{
  const ids=serverCatalog.slice(0,MAX_SAVED_CONCEPTS+2).map(x=>x.id);
  const normalized=normalizeSavedConcepts(JSON.stringify([ids[0],'unrecognized',ids[0],...ids,{id:ids[2]},null]),serverCatalog);
  assert.equal(normalized.length,MAX_SAVED_CONCEPTS);
  assert.ok(normalized.every(id=>serverCatalog.some(x=>x.id===id)));
  assert.deepEqual(normalizeSavedConcepts('{invalid',serverCatalog),[]);
  assert.deepEqual(normalizeSavedConcepts('{"ids":["mist-cleanser"]}',serverCatalog),[]);
  assert.deepEqual(normalizeSavedConcepts(null,serverCatalog),[]);
  assert.match(SAVED_CONCEPTS_KEY,/routinegap_/);
});
test('shortlist toggles without being confused with cart purchases',()=>{
  const id=serverCatalog[0].id;
  const a=toggleSavedConcept([],id,serverCatalog);
  assert.deepEqual(a.saved,[id]);
  assert.equal(a.added,true);
  const b=toggleSavedConcept(a.saved,id,serverCatalog);
  assert.deepEqual(b.saved,[]);
  assert.equal(b.added,false);
  const full=serverCatalog.slice(0,MAX_SAVED_CONCEPTS).map(x=>x.id);
  const rejected=toggleSavedConcept(full,serverCatalog[MAX_SAVED_CONCEPTS].id,serverCatalog);
  assert.equal(rejected.limitReached,true);
  assert.deepEqual(rejected.saved,full);
  assert.deepEqual(toggleSavedConcept(full,'unknown',serverCatalog).saved,full);
});
test('unsupported filter values are safely treated as normal defaults',()=>{
  assert.deepEqual(discoverConcepts(evaluated.rows,{step:'__proto__',decision:'unknown',sort:'invalid'}).map(x=>x.id),
    discoverConcepts(evaluated.rows,{}).map(x=>x.id));
  assert.deepEqual(discoverConcepts(null,{}),[]);
  assert.ok(FILTER_DECISIONS.includes('skip')&&SORT_OPTIONS.includes('name'));
});
test('all auto-suggested items remain essential and within the selected budget with the expanded dataset',()=>{
  for(const budget of [0,10,20,40,60,100,300]){
    for(const goal of ['moisture','texture','oiliness','routine']){
      const d=evaluateShop({shelf:[],goal,budget});
      assert.ok(d.cartTotal<=budget);
      assert.ok(d.cartIds.every(id=>serverCatalog.some(p=>p.id===id&&p.step!=='serum')));
    }
  }
});
