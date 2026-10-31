/**
 * Browser-local preference studio. Pure functions; no accounts, uploads,
 * YouCam requests or permanent profile fields beyond existing preferences.
 */
import {evaluateShop,goals,stepLabels} from '../src/recommendations.js';
export const PREF_STAGES=Object.freeze([
 {id:'focus',title:'Choose your cosmetic focus',subtitle:'A preference you choose, not an inferred skin diagnosis.'},
 {id:'budget',title:'Define your example budget',subtitle:'Concept prices are illustrative USD, not live retailer offers.'},
 {id:'review',title:'Review before applying',subtitle:'Compare a hypothetical plan without changing your saved settings.'}
]);
export const DEMO_BUDGETS=Object.freeze([25,50,75,100]);
const validGoals=new Set(goals.map(x=>x.id));
export function normalizePreferenceDraft(raw={}){
 const budget=typeof raw?.budget==='string'&&raw.budget.trim()===''?0:Number(raw?.budget);
 return {goal:validGoals.has(raw?.goal)?raw.goal:'moisture',
  budget:Number.isFinite(budget)?Math.max(0,Math.min(1000,Math.round(budget))):60,
  fragranceFree:raw?.fragranceFree===true};
}
export function modifyPreferenceDraft(current,change){
 const old=normalizePreferenceDraft(current);
 if(!change||typeof change!=='object'||Array.isArray(change))return old;
 if(Object.hasOwn(change,'goal')&&validGoals.has(change.goal))old.goal=change.goal;
 if(Object.hasOwn(change,'budget'))old.budget=normalizePreferenceDraft({...old,budget:change.budget}).budget;
 if(Object.hasOwn(change,'fragranceFree'))old.fragranceFree=change.fragranceFree===true;
 return old;
}
export function preferencePreview(draft,{shelf=[],sampleInventory=true}={}){
 const preferences=normalizePreferenceDraft(draft);
 // NEVER attribute starter demo products to real user ownership.
 const owned=sampleInventory?[]:Array.isArray(shelf)?shelf:[];
 const result=evaluateShop({shelf:owned,...preferences});
 const chosen=result.cartIds.map(id=>result.rows.find(x=>x.id===id)).filter(Boolean);
 const candidate=chosen.map(item=>({id:item.id,name:item.name,step:item.step,
  stepLabel:stepLabels[item.step]||item.step,price:item.price,reason:item.reason}));
 const matching=result.rows.filter(x=>x.goals.includes(preferences.goal)).length;
 const covered=['cleanser','moisturizer','spf'].filter(step=>result.owned.some(p=>p.step===step)).length;
 return {preferences,source:sampleInventory?'sample-excluded':'actual-shelf',
  covered,realOwned:result.owned.length,missingSteps:result.missingSteps,
  candidate,exampleTotal:result.cartTotal,remaining:result.remaining,
  matches:matching,exploredCount:result.rows.length,
  skipped:result.skippedRedundant,
  fragranceNote:preferences.fragranceFree?'Illustrative fragrance-free tags only; no verified ingredient or allergy data.':'No fragrance-related tag filter applied.',
  disclosure:'Fictional catalog with example USD prices. No real inventory, checkout, medically validated fit, proven savings or provider analysis. The preview does not change your saved choices.'};
}
export function stepPreferenceStage(index,action){
 if(!Number.isInteger(index)||index<0||index>=PREF_STAGES.length)return null;
 if(action==='next')return Math.min(PREF_STAGES.length-1,index+1);
 if(action==='back')return Math.max(0,index-1);
 return null;
}
export function differentPreferences(a,b){
 const x=normalizePreferenceDraft(a),y=normalizePreferenceDraft(b);
 return x.goal!==y.goal||x.budget!==y.budget||x.fragranceFree!==y.fragranceFree;
}
