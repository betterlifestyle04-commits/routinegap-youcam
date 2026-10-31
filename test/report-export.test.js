import test from 'node:test';
import assert from 'node:assert/strict';
import {createDecisionBrief} from '../public/report-export.js';
import {evaluateShop,sampleShelf,sampleScan} from '../src/recommendations.js';
import {readFile} from 'node:fs/promises';

const decision=evaluateShop({shelf:sampleShelf,budget:20,goal:'moisture'});
const input={decision,cartIds:['mineral-spf'],generatedAt:'2026-10-31',sampleInventory:true};

test('sample report is unambiguously labeled, with real cart total and overspend shown',()=>{
  const text=createDecisionBrief({...input,scanSource:'sample',signals:sampleScan,goalFromScan:'sample'});
  assert.match(text,/ILLUSTRATIVE SAMPLE — NOT YOUCAM/);
  assert.match(text,/ILLUSTRATIVE SAMPLE INVENTORY/);
  assert.match(text,/- Daily SPF/);
  assert.match(text,/Demo total: \$23\.00/);
  assert.match(text,/Budget: \$20\.00/);
  assert.match(text,/OVER BUDGET by \$3\.00/);
  assert.match(text,/UI score 70\/100 \(vendor presentation score, not probability\)/);
  assert.match(text,/Explicitly chosen by user after reviewing the labeled example report/);
  assert.match(text,/no live merchant, checkout, order or review/);
});
test('a real report is labeled vendor observation, not clinical efficacy',()=>{
  const text=createDecisionBrief({...input,scanSource:'live',goalFromScan:'live',signals:[
    {type:'moisture',uiScore:54,rawScore:26},
    {type:'skin_type',uiScore:null,regions:{whole:'Combination'}}
  ]});
  assert.match(text,/LIVE YOUCAM COSMETIC OBSERVATIONS/);
  assert.match(text,/vendor label Combination/);
  assert.match(text,/not diagnostic confidence, clinical severity, or probabilities/);
  assert.doesNotMatch(text,/ILLUSTRATIVE SAMPLE — NOT YOUCAM/);
});
test('no scan does not invent skin scores and still supports a useful shopping brief',()=>{
  const text=createDecisionBrief({...input,scanSource:null,signals:sampleScan,goalFromScan:null});
  assert.match(text,/NO SKIN ANALYSIS/);
  assert.match(text,/No scan performed; no scores have been inferred/);
  assert.doesNotMatch(text,/UI score 70/);
});
test('user product names are sanitized to prevent Markdown section spoofing',()=>{
  const d=evaluateShop({shelf:[{name:'## HACKED\n![](https://evil.test/steal)',step:'cleanser',price:15,tags:[]}],budget:60});
  const text=createDecisionBrief({decision:d,generatedAt:'2026-10-31'});
  assert.doesNotMatch(text,/!\[\]/);
  assert.doesNotMatch(text,/## HACKED/);
  assert.doesNotMatch(text,/evil\.test/);
  assert.match(text,/HACKED/);
});
test('secret keys, photos and scan receipts are never exported even if supplied as extra fields',()=>{
  const text=createDecisionBrief({...input,apiKey:'super-secret-provider-key',code:'private-passcode',fileName:'private-person-face.jpg',receipt:'private-task-receipt'});
  for(const forbidden of ['super-secret-provider-key','private-passcode','private-person-face.jpg','private-task-receipt'])assert.ok(!text.includes(forbidden));
  assert.match(text,/neither the source photo, API key, demo passcode nor scan receipt/);
});
test('invalid input is rejected and exports are explicitly triggered on a click',async()=>{
  assert.throws(()=>createDecisionBrief({}),/valid shopping evaluation/);
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/id="export-decision"/);
  assert.match(app,/downloadDecisionBrief\(\)/);
  assert.match(app,/text\/markdown/);
  assert.match(app,/routinegap-decision-brief\.md/);
  assert.match(app,/URL\.revokeObjectURL/);
});
