import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateShop,normalizeShelf,normalizeScanOutput,sampleShelf,sampleScan,catalog} from '../src/recommendations.js';
test('sample shelf prevents re-buying owned cleanser and moisturizer',()=>{const d=evaluateShop({shelf:sampleShelf,budget:60,goal:'moisture'});assert.equal(d.owned.length,2);assert.equal(d.missingSteps.length,1);assert.deepEqual(d.missingSteps,['spf']);assert.ok(d.rows.filter(x=>x.decision==='skip').every(x=>['cleanser','moisturizer'].includes(x.step)));assert.ok(d.cartIds.every(id=>catalog.find(p=>p.id===id).step==='spf'));});
test('the essentials-first cart never exceeds budget',()=>{for(let budget=0;budget<=125;budget+=5){const d=evaluateShop({shelf:[],budget,goal:'routine'});assert.ok(d.cartTotal<=budget);assert.equal(d.cartIds.length,new Set(d.cartIds).size);assert.ok(d.cartIds.every(id=>catalog.some(x=>x.id===id)));}});
test('owned essentials produce no unnecessary cart',()=>{const shelf=[...sampleShelf,{id:'s',name:'Daily SPF',step:'spf',tags:[],price:22}];const d=evaluateShop({shelf,budget:100});assert.equal(d.missingSteps.length,0);assert.equal(d.cartTotal,0);assert.equal(d.cartIds.length,0);});
test('fragrance-free preference removes untagged concepts',()=>{const d=evaluateShop({shelf:[],fragranceFree:true,budget:120});assert.ok(d.rows.every(p=>p.tags.includes('fragrance-free')));});
test('untrusted shelf data is bounded and malformed products ignored',()=>{assert.deepEqual(normalizeShelf(null),[]);const shelf=normalizeShelf([{id:'a',name:'S'.repeat(200),step:'cleanser',price:-10,tags:['one',2]},{name:'',step:'spf'},{name:'nope',step:'unknown'}]);assert.equal(shelf.length,1);assert.equal(shelf[0].name.length,90);assert.equal(shelf[0].price,0);assert.deepEqual(shelf[0].tags,['one']);});
test('provider scan scores are imported from provider, not fabricated or used as diagnosis',()=>{const d=normalizeScanOutput({data:{results:{output:[{type:'moisture',ui_score:80,raw_score:76},{type:'unknown',ui_score:12}]}}});assert.equal(d.length,1);assert.equal(d[0].uiScore,80);assert.equal(d[0].type,'moisture');assert.throws(()=>normalizeScanOutput({data:{results:{output:null}}}),/result payload/);});
test('sample score is labeled as a fixture, not fed by provider',()=>{assert.ok(Array.isArray(sampleScan));assert.ok(sampleScan.length>2);});

test('normalizes actual YouCam keyed SD JSON metrics without inventing zero scores',()=>{
  const output={
    moisture:{raw_score:48.69,ui_score:70,output_mask_name:'moisture_output.png'},
    oiliness:{raw_score:60.7,ui_score:72},
    pore:{raw_score:88.38,ui_score:84},
    texture:{raw_score:80.1,ui_score:76},
    redness:{raw_score:72.01,ui_score:77},
    unknown:{raw_score:2,ui_score:3}
  };
  const d=normalizeScanOutput({data:{results:{output}}});
  assert.equal(d.length,5);
  assert.deepEqual(d.map(x=>x.type),['moisture','oiliness','pore','texture','redness']);
  assert.equal(d[0].uiScore,70);
  assert.equal(d[0].rawScore,48.69);
});
test('uses provider whole-face region score without inferring an average',()=>{
  const output={pore:{forehead:{raw_score:30,ui_score:55},whole:{raw_score:52,ui_score:67}},
    texture:{whole:{raw_score:75,ui_score:78}}};
  const d=normalizeScanOutput({data:{results:{output}}});
  assert.equal(d[0].uiScore,67);
  assert.equal(d[0].rawScore,52);
  assert.equal(d[1].uiScore,78);
});
test('rejects empty and unparseable success payloads instead of faking a result',()=>{
  assert.throws(()=>normalizeScanOutput({data:{results:{output:{foo:{ui_score:99}}}}}),/no usable/);
  assert.throws(()=>normalizeScanOutput({data:{results:{output:[]}}}),/no usable/);
  assert.throws(()=>normalizeScanOutput({data:{results:{output:{moisture:{ui_score:null,raw_score:undefined}}}}}),/no usable/);
  assert.throws(()=>normalizeScanOutput({data:{results:{output:{moisture:{ui_score:'nan'}}}}}),/no usable/);
});
test('preserves actual categorical skin types without manufacturing a numeric score',()=>{
  const d=normalizeScanOutput({data:{results:{output:{skin_type:{whole:'Combination',t_zone:'Oily'}}}}});
  assert.equal(d[0].type,'skin_type');
  assert.equal(d[0].uiScore,null);
  assert.equal(d[0].rawScore,null);
  assert.deepEqual(d[0].regions,{whole:'Combination',t_zone:'Oily'});
});
