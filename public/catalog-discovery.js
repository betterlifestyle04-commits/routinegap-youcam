/**
 * RoutineGap catalog discovery: deterministic, non-clinical, and offline.
 * Products and prices are fictional concepts, never merchant offers or ratings.
 */
export const SAVED_CONCEPTS_KEY='routinegap_saved_concepts_v1';
export const MAX_SAVED_CONCEPTS=6;
export const FILTER_STEPS=['all','cleanser','moisturizer','spf','serum'];
export const FILTER_DECISIONS=['all','consider','optional','skip'];
export const SORT_OPTIONS=['recommended','price-low','price-high','name'];
export function normalizeSavedConcepts(value,catalog) {
  let ids=value;
  if(typeof value==='string'){
    try{ids=JSON.parse(value);}catch{return [];}
  }
  if(!Array.isArray(ids)||!Array.isArray(catalog))return [];
  const allowed=new Set(catalog.map(x=>x.id));
  return [...new Set(ids.filter(x=>typeof x==='string'&&allowed.has(x)))].slice(0,MAX_SAVED_CONCEPTS);
}
export function toggleSavedConcept(current,id,catalog) {
  const saved=normalizeSavedConcepts(current,catalog), allowed=new Set(catalog.map(x=>x.id));
  if(typeof id!=='string'||!allowed.has(id))return {saved,added:false,limitReached:false};
  if(saved.includes(id))return {saved:saved.filter(x=>x!==id),added:false,limitReached:false};
  if(saved.length>=MAX_SAVED_CONCEPTS)return {saved,added:false,limitReached:true};
  return {saved:[...saved,id],added:true,limitReached:false};
}
export function discoverConcepts(rows,{query='',step='all',decision='all',sort='recommended',savedOnly=false,affordableOnly=false,budget=0,savedIds=[]}={}){
  if(!Array.isArray(rows))return [];
  const q=String(query??'').trim().slice(0,80).toLocaleLowerCase('en');
  const filteredStep=FILTER_STEPS.includes(step)?step:'all';
  const filteredDecision=FILTER_DECISIONS.includes(decision)?decision:'all';
  const order=SORT_OPTIONS.includes(sort)?sort:'recommended';
  const saved=new Set(Array.isArray(savedIds)?savedIds:[]);
  const maxPrice=Number.isFinite(Number(budget))?Math.max(0,Number(budget)):0;
  const result=rows.filter(item=>{
    if(!item||typeof item!=='object')return false;
    if(filteredStep!=='all'&&item.step!==filteredStep)return false;
    if(filteredDecision!=='all'&&item.decision!==filteredDecision)return false;
    if(savedOnly&&!saved.has(item.id))return false;
    if(affordableOnly&&!(Number.isFinite(item.price)&&item.price<=maxPrice))return false;
    if(!q)return true;
    const searchable=[item.name,item.description,item.step,item.brand,...(Array.isArray(item.tags)?item.tags:[])].map(x=>String(x||'').toLocaleLowerCase('en')).join(' ');
    return searchable.includes(q);
  });
  const alphabetical=(a,b)=>String(a.name).localeCompare(String(b.name),'en');
  return result.sort((a,b)=>{
    if(order==='name')return alphabetical(a,b);
    if(order==='price-low')return a.price-b.price||alphabetical(a,b);
    if(order==='price-high')return b.price-a.price||alphabetical(a,b);
    // Sort by actionability, rather than implying that a recommendation is evidence of clinical efficacy.
    const decisionRank={consider:0,optional:1,skip:2};
    const da=decisionRank[a.decision]??3,db=decisionRank[b.decision]??3;
    if(da!==db)return da-db;
    return (b.priority||0)-(a.priority||0)||a.price-b.price||alphabetical(a,b);
  });
}
