/**
 * RoutineGap insight snapshot. The model reports only user-entered inventory
 * and the current fictional demonstration catalog, never invented history,
 * achieved savings, verified SPF performance, outcomes, or merchant prices.
 */
import {catalog,evaluateShop,normalizeShelf,stepLabels} from './recommendations.js';
export const BASIC_STEPS=['cleanser','moisturizer','spf'];
export const ALL_STEPS=[...BASIC_STEPS,'serum'];
const boundedBudget=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(1000,Number(value))):0;
export function makeInsights({shelf=[],sampleInventory=true,budget=60,goal='routine',fragranceFree=false,cartIds=[],savedIds=[]}={}){
  const owned=sampleInventory?[]:normalizeShelf(shelf);
  const recordedPriceTotal=owned.reduce((sum,p)=>sum+p.price,0);
  const counts=Object.fromEntries(ALL_STEPS.map(step=>[step,owned.filter(p=>p.step===step).length]));
  const costs=Object.fromEntries(ALL_STEPS.map(step=>[step,owned.filter(p=>p.step===step).reduce((sum,p)=>sum+p.price,0)]));
  const covered=BASIC_STEPS.filter(step=>counts[step]>0);
  const gaps=BASIC_STEPS.filter(step=>!covered.includes(step));
  const decision=evaluateShop({shelf:owned,budget:boundedBudget(budget),goal,fragranceFree});
  const selectedIds=new Set(Array.isArray(cartIds)?cartIds.filter(x=>typeof x==='string'):[]);
  const cart=decision.rows.filter(p=>p.decision!=='skip'&&selectedIds.has(p.id));
  const cartTotal=cart.reduce((sum,p)=>sum+p.price,0);
  const saved=new Set(Array.isArray(savedIds)?savedIds.filter(x=>typeof x==='string'):[]);
  const duplicateMatches=decision.rows.filter(p=>p.decision==='skip');
  return {
    sampleInventory:!!sampleInventory,ownedCount:owned.length,recordedPriceTotal,
    coveredCount:covered.length,coveragePercent:Math.round(covered.length/BASIC_STEPS.length*100),
    covered,gaps,counts,costs,decision,cart,cartTotal,
    cartOverBudget:cartTotal>decision.budget,
    savedCount:catalog.filter(p=>saved.has(p.id)).length,
    duplicateMatches:duplicateMatches.length,
    missingLabels:gaps.map(s=>stepLabels[s]),
    lastDataPoint:'Current local browser snapshot; no tracking or historical trends.'
  };
}
export function evaluateBudgetScenario(snapshot,newBudget) {
  if(!snapshot||!snapshot.decision||!Array.isArray(snapshot.decision.owned))throw Error('An insight snapshot is required.');
  const budget=boundedBudget(newBudget);
  const d=evaluateShop({shelf:snapshot.decision.owned,budget,goal:snapshot.decision.goal,fragranceFree:snapshot.decision.fragranceFree});
  const suggested=d.cartIds.map(id=>d.rows.find(p=>p.id===id)).filter(Boolean);
  const suggestedSteps=new Set(suggested.map(p=>p.step));
  return {budget,spent:d.cartTotal,remaining:budget-d.cartTotal,suggested,
    unmetGaps:d.missingSteps.filter(step=>!suggestedSteps.has(step)),totalGaps:d.missingSteps.length,
    complete:d.missingSteps.length>0&&d.missingSteps.every(s=>suggestedSteps.has(s)),
    noNewPurchase:d.missingSteps.length===0};
}
