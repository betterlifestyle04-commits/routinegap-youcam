import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateShop,sampleShelf,goals} from '../src/recommendations.js';

test('scan-to-shop link is explicit user action rather than automatic model-based shopping',async()=>{
  const js=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(js,/data-scan-goal/);
  assert.match(js,/Choose as shopping focus/);
  assert.match(js,/state\.goal=goal;state\.goalFromScan=state\.scanSource/);
  assert.match(js,/state\.scan\.some\(s=>s\.type===goal\)/);
  assert.match(js,/not inferred as a medical condition or diagnosis/);
  assert.match(js,/EVIDENCE → YOUR CHOICE/);
  assert.match(js,/state\.goalFromScan=null;state\.fragranceFree/);
});
test('user-selected preference still prioritizes using existing products, never overrides budget',()=>{
  for(const g of goals){
    const d=evaluateShop({shelf:sampleShelf,budget:30,goal:g.id});
    assert.equal(d.goal,g.id);
    assert.ok(d.cartTotal<=30);
    assert.ok(d.rows.filter(x=>x.decision==='skip').every(x=>['cleanser','moisturizer'].includes(x.step)));
    assert.ok(d.cartIds.every(id=>d.rows.find(x=>x.id===id).step==='spf'));
  }
});
