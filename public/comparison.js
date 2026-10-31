/**
 * Private comparison state for fictional concepts. No checkout, medical claims,
 * merchant stock, scan data, or transfer of personal records.
 */
export const COMPARE_KEY='routinegap_compare_ids_v1';
export const MAX_COMPARE=3;
export const COMPARE_FILTER_STEPS=['all','cleanser','moisturizer','spf','serum'];
export function normalizeCompareIds(value,catalog){
 let raw=value;
 if(typeof value==='string'){try{raw=JSON.parse(value);}catch{return [];}}
 if(!Array.isArray(raw)||!Array.isArray(catalog))return [];
 const allow=new Set(catalog.map(p=>p.id));
 return [...new Set(raw.filter(id=>typeof id==='string'&&allow.has(id)))].slice(0,MAX_COMPARE);
}
export function toggleCompareId(current,id,catalog){
 const ids=normalizeCompareIds(current,catalog);
 if(typeof id!=='string'||!catalog.some(p=>p.id===id))return {ids,added:false,limitReached:false};
 if(ids.includes(id))return {ids:ids.filter(x=>x!==id),added:false,limitReached:false};
 if(ids.length>=MAX_COMPARE)return {ids,added:false,limitReached:true};
 return {ids:[...ids,id],added:true,limitReached:false};
}
const allSteps=new Set(['cleanser','moisturizer','spf','serum']);
export function buildComparison({catalog=[],ids=[],owned=[],budget=0,goal='routine',fragranceFree=false,sampleInventory=false,savedIds=[]}={}){
 const selected=normalizeCompareIds(ids,catalog);
 const shelf=sampleInventory?[]:(Array.isArray(owned)?owned:[]);
 const ownedSteps=new Set(shelf.filter(p=>p&&allSteps.has(p.step)).map(p=>p.step));
 const saved=new Set(Array.isArray(savedIds)?savedIds:[]);
 const max=Number.isFinite(Number(budget))?Math.max(0,Math.min(1000,Number(budget))):0;
 const entries=selected.map(id=>catalog.find(p=>p.id===id)).filter(Boolean).map(p=>({
   ...p,ownedStep:ownedSteps.has(p.step),withinBudget:p.price<=max,
   goalMatch:Array.isArray(p.goals)&&p.goals.includes(goal),
   excludesPreference:!!fragranceFree&&!p.tags.includes('fragrance-free'),
   saved:saved.has(p.id)
 }));
 const total=entries.reduce((n,p)=>n+p.price,0);
 const represented=new Set(entries.map(x=>x.step));
 const repeated=entries.filter(x=>entries.some(y=>y.id!==x.id&&y.step===x.step));
 return {entries,selected,max,budget:max,total,withinCombinedBudget:total<=max,
   hasAlternatives:repeated.length>0,sameStep:entries.length>1&&represented.size===1,
   ownedOverlap:entries.filter(x=>x.ownedStep).length,
   preferenceExcluded:entries.filter(x=>x.excludesPreference).length,
   sampleInventory:!!sampleInventory,
   note:entries.length===0?'Select up to three illustrative products to compare.':
     repeated.length?'Some selections are alternatives for the same routine step, not a reason to purchase both.':
     'These examples represent different routine steps; compare each against what you already own.'
 };
}
export function filterComparisonCandidates(catalog,{query='',step='all'}={}){
 if(!Array.isArray(catalog))return [];
 const q=String(query||'').trim().slice(0,80).toLocaleLowerCase('en');
 const s=COMPARE_FILTER_STEPS.includes(step)?step:'all';
 return catalog.filter(p=>{
  if(!p||typeof p!=='object')return false;
  if(s!=='all'&&p.step!==s)return false;
  if(!q)return true;
  return [p.name,p.description,p.step,p.brand,...(Array.isArray(p.tags)?p.tags:[])]
    .map(x=>String(x||'').toLocaleLowerCase('en')).join(' ').includes(q);
 });
}
