/**
 * Local-only, deterministic and privacy-conscious Markdown export.
 * This module knows nothing about photo files, provider credentials or scan receipts.
 * No report is sent to a server, and no actual products are purchased.
 */
import {goals,stepLabels} from './recommendations.js';
const clean=(value,max=120)=>String(value??'').replace(/https?:\/\/[^\s)]+/gi,'[external link omitted]').replace(/[\r\n\t\0-\x1f\x7f]/g,' ').replace(/[\\`*_[\]()<>{}#!|~]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const dollars=value=>'$'+(Number.isFinite(Number(value))?Math.max(0,Number(value)):0).toFixed(2);
const money=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
const heading=step=>stepLabels[step]||'Other routine step';
const goalName=goal=>goals.find(x=>x.id===goal)?.name||'Simple routine';
const cosmeticLabels={moisture:'Moisture',oiliness:'Oiliness',pore:'Pore appearance',texture:'Texture',redness:'Redness',skin_type:'Skin type'};
const sourceLabel=source=>source==='live'?'LIVE YOUCAM COSMETIC OBSERVATIONS':source==='sample'?'ILLUSTRATIVE SAMPLE — NOT YOUCAM':'NO SKIN ANALYSIS';
const withList=(entries,empty)=>entries.length?entries.map(x=>'- '+x).join('\n'):'- '+empty;
const goodScore=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;
export function createDecisionBrief({decision,cartIds=[],scanSource=null,signals=[],goalFromScan=null,sampleInventory=false,generatedAt=''}={}){
  if(!decision||!Array.isArray(decision.rows)||!Array.isArray(decision.owned))
    throw new Error('A valid shopping evaluation is required.');
  const date=typeof generatedAt==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(generatedAt)?generatedAt:'Date not supplied';
  const source=scanSource==='live'?'live':scanSource==='sample'?'sample':null;
  const validSignals=source&&Array.isArray(signals)?signals.filter(s=>s&&typeof s.type==='string'&&Object.hasOwn(cosmeticLabels,s.type)).slice(0,12):[];
  const observationRows=validSignals.map(s=>{
    const measures=[];
    if(goodScore(s.uiScore))measures.push('UI score '+s.uiScore+'/100 (vendor presentation score, not probability)');
    if(goodScore(s.rawScore))measures.push('raw score '+s.rawScore+'/100');
    if(s.type==='skin_type'&&typeof s.regions?.whole==='string')
      measures.push('vendor label '+clean(s.regions.whole,50));
    return clean(cosmeticLabels[s.type])+(measures.length?' — '+measures.join('; '):' — no displayable value');
  });
  const selected=new Set(Array.isArray(cartIds)?cartIds.filter(x=>typeof x==='string'):[]);
  const items=decision.rows.filter(row=>selected.has(row.id)&&row.decision!=='skip');
  const total=items.reduce((sum,row)=>sum+money(row.price),0);
  const budget=money(decision.budget);
  const overBudget=total>budget+1e-7;
  const owned=decision.owned.slice(0,60).map(x=>clean(x.name,90)+' ('+heading(x.step)+')');
  const missing=(decision.missingSteps||[]).map(heading);
  const skipped=decision.rows.filter(x=>x.decision==='skip');
  const exportText=[
    '# RoutineGap — Shopping decision brief',
    '',
    'Created: '+date,
    'Report provenance: '+sourceLabel(source),
    'Inventory provenance: '+(sampleInventory?'ILLUSTRATIVE SAMPLE INVENTORY':'USER-ENTERED INVENTORY'),
    '',
    '## Selected shopping preferences',
    '- Cosmetic focus: '+clean(goalName(decision.goal)),
    '- Focus origin: '+(goalFromScan&&source&&goalFromScan===source?'Explicitly chosen by user after reviewing the '+(source==='live'?'real YouCam report':'labeled example report'):'User-selected preference (not inferred automatically from a scan)'),
    '- Fragrance-free concept filter: '+(decision.fragranceFree?'On':'Off'),
    '- Spending limit: '+dollars(budget),
    '',
    '## Cosmetic skin observations',
    'Source: '+sourceLabel(source),
    withList(observationRows,source?'No supported values included in the current report.':'No scan performed; no scores have been inferred.'),
    '',
    'UI scores are cosmetic presentation scores, not diagnostic confidence, clinical severity, or probabilities. RoutineGap does not use them to predict product efficacy.',
    '',
    '## Your shelf',
    withList(owned, 'No owned products recorded.'),
    '',
    '## Routine gaps (heuristic, not medical necessity)',
    withList(missing.map(x=>clean(x)), 'No missing basic routine steps identified.'),
    '',
    '## Suggested duplicate avoidance',
    '- '+skipped.length+' illustrative catalog alternatives were marked redundant because their routine step is already present on your shelf.',
    withList(skipped.slice(0,20).map(x=>clean(x.name,90)+' — '+clean(x.reason,220)), 'No duplicate category matches identified.'),
    '',
    '## Your demo cart (not a real purchase)',
    withList(items.map(x=>clean(x.name,90)+' ('+heading(x.step)+') — '+dollars(x.price)), 'No items selected.'),
    '- Demo total: '+dollars(total),
    '- Budget: '+dollars(budget),
    '- Budget check: '+(overBudget?'OVER BUDGET by '+dollars(total-budget):'WITHIN BUDGET, '+dollars(budget-total)+' remaining'),
    '',
    '## How the suggestions were produced',
    '1. Read the shopping preferences and budget chosen by the user.',
    '2. Compare basic routine categories with the shelf entered by the user or explicitly loaded as a sample.',
    '3. Mark catalog examples from already-owned steps as redundant.',
    '4. Offer missing basic routine steps first; optional care remains optional.',
    '5. Keep the final cart and any purchases under human control.',
    '',
    '## Important limitations & privacy',
    '- Fictional skincare product names and illustrative prices; there is no live merchant, checkout, order or review.',
    '- Product suggestions are deterministic category-matching examples, not verified treatment or product-effectiveness recommendations.',
    '- This is cosmetic guidance only, not medical advice or an allergy assessment.',
    '- This text was generated privately in your browser. It contains neither the source photo, API key, demo passcode nor scan receipt.',
    '- Do not share a real scan report publicly without considering the privacy of the person pictured.',
    ''
  ];
  return exportText.join('\n');
}
