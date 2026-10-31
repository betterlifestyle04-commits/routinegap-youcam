/**
 * Explainable merchandising heuristics. Not medical advice or medical diagnoses.
 * The sample catalog is fictional and the prices do not represent real merchants.
 */
export const catalog = [
  {id:'mist-cleanser',name:'Everyday Cloud Cleanser',brand:'Concept collection',step:'cleanser',price:12,tags:['gentle','fragrance-free'],goals:['texture','redness'],description:'A gentle, rinse-off first step.'},
  {id:'daily-gel',name:'Daily Balance Gel',brand:'Concept collection',step:'moisturizer',price:17,tags:['lightweight','fragrance-free'],goals:['oiliness','pore'],description:'A lightweight moisturizing texture.'},
  {id:'barrier-cream',name:'Comfort Barrier Cream',brand:'Concept collection',step:'moisturizer',price:19,tags:['hydrating','fragrance-free'],goals:['moisture','redness'],description:'A richer moisturizing option.'},
  {id:'mineral-spf',name:'Everyday Mineral SPF 30',brand:'Concept collection',step:'spf',price:23,tags:['sun-protection','fragrance-free'],goals:['routine','radiance'],description:'A daily sun-protection step.'},
  {id:'clear-spf',name:'Featherlight SPF 50',brand:'Concept collection',step:'spf',price:25,tags:['sun-protection','lightweight'],goals:['oiliness','pore'],description:'Lightweight sun protection for daily use.'},
  {id:'hydration-serum',name:'Water Lock Serum',brand:'Concept collection',step:'serum',price:18,tags:['hydrating','fragrance-free'],goals:['moisture','texture'],description:'An optional hydration-focused step.'},
  {id:'texture-serum',name:'Smooth Finish Serum',brand:'Concept collection',step:'serum',price:22,tags:['texture-focus'],goals:['texture','pore'],description:'An optional cosmetic texture-focused step.'},
  {id:'balance-serum',name:'Balance Support Serum',brand:'Concept collection',step:'serum',price:21,tags:['lightweight','fragrance-free'],goals:['oiliness','pore'],description:'An optional lightweight serum.'},
  {id:'soft-cleanser',name:'Cream Comfort Cleanser',brand:'Concept collection',step:'cleanser',price:15,tags:['hydrating','fragrance-free'],goals:['moisture','redness'],description:'An alternate creamy cleansing step.'}
];
export const sampleShelf = [
  {id:'mine-1',name:'My Gentle Cleanser',step:'cleanser',tags:['gentle','fragrance-free'],price:14},
  {id:'mine-2',name:'My Daily Moisturizer',step:'moisturizer',tags:['hydrating'],price:20}
];
export const goals = [{id:'moisture',name:'Hydration'}, {id:'oiliness',name:'Oil balance'}, {id:'texture',name:'Texture'}, {id:'pore',name:'Pore appearance'}, {id:'redness',name:'Visible redness'}, {id:'routine',name:'Simple routine'}];
export const stepLabels = {cleanser:'Cleanse',moisturizer:'Moisturize',spf:'Daily SPF',serum:'Optional targeted care'};
const essentials=['cleanser','moisturizer','spf'];
const byPrice=(a,b)=>a.price-b.price||a.name.localeCompare(b.name);
export function normalizeShelf(items){
  if(!Array.isArray(items))return [];
  return items.slice(0,60).filter(x=>x && typeof x.name==='string' && x.name.trim() && essentials.concat('serum').includes(x.step)).map((x,i)=>({
    id:typeof x.id==='string'&&x.id.slice(0,60)||`owned-${i}`,name:x.name.trim().slice(0,90),step:x.step,
    price:Number.isFinite(Number(x.price))?Math.max(0,Math.min(100000,Number(x.price))):0,
    tags:Array.isArray(x.tags)?x.tags.filter(z=>typeof z==='string').slice(0,8):[]
  }));
}
export function evaluateShop({shelf=[],budget=60,goal='moisture',fragranceFree=false}={}){
  const owned=normalizeShelf(shelf), totalBudget=Math.max(0,Math.min(2000,Number(budget)||0));
  const selectedGoal=goals.some(g=>g.id===goal)?goal:'routine';
  const available=catalog.filter(p=>!fragranceFree||p.tags.includes('fragrance-free'));
  const ownedSteps=new Set(owned.map(x=>x.step));
  const priority = (p)=> (essentials.includes(p.step)?15:0)+(p.goals.includes(selectedGoal)?9:0)+(p.tags.includes('fragrance-free')?1:0);
  const rows=available.map(item=>{
    const existing=owned.filter(x=>x.step===item.step);
    let decision='consider',reason='Matches a cosmetic preference but is optional.';
    if(existing.length){decision='skip';reason=`Use what you already own: ${existing.map(x=>x.name).join(', ')}. This serves the same routine step.`;}
    else if(item.step==='serum'){decision='optional';reason=`Optional ${selectedGoal==='routine'?'targeted care':selectedGoal+'-focused'} addition; prioritize routine essentials before extra purchases.`;}
    else {reason=`Missing ${stepLabels[item.step]} step; consider if it fits your budget and preferences.`;}
    return {...item,decision,reason,priority:priority(item)};
  });
  const choose=[];
  let spent=0;
  for(const step of essentials){
    if(ownedSteps.has(step))continue;
    const options=rows.filter(x=>x.step===step && x.decision==='consider').sort((a,b)=>b.priority-a.priority||byPrice(a,b));
    const affordable=options.find(x=>spent+x.price<=totalBudget);
    if(affordable){choose.push(affordable.id);spent+=affordable.price;}
  }
  const needed=essentials.filter(s=>!ownedSteps.has(s));
  return {owned,budget:totalBudget,goal:selectedGoal,fragranceFree,rows,cartIds:choose,cartTotal:spent,remaining:Math.max(0,totalBudget-spent),missingSteps:needed,skippedRedundant:rows.filter(x=>x.decision==='skip').length,
    message:needed.length===0?'Your shelf already covers the three basic routine steps.':`Your shelf has ${needed.length} routine gap${needed.length===1?'':'s'} to consider. No purchase is required.`};
}
/** Scores are vendor-reported cosmetic observations, not medical confidence percentages. */
export function normalizeScanOutput(payload){
  const result=payload?.data?.results?.output;
  if(!Array.isArray(result))throw Error('Provider completed without the expected YouCam result list.');
  const allow=new Set(['moisture','oiliness','pore','texture','skin_type','redness']);
  return result.filter(r=>r&&allow.has(r.type)).map(r=>({
    type:r.type,uiScore:Number.isFinite(Number(r.ui_score))?Number(r.ui_score):null,
    rawScore:Number.isFinite(Number(r.raw_score))?Number(r.raw_score):null,
    // Skin type may have nested categorical vendor data; do not guess from a number.
    regions:r.regions && typeof r.regions==='object'?r.regions:null
  }));
}
export const sampleScan = Object.freeze([
  {type:'moisture',uiScore:70,rawScore:49},
  {type:'oiliness',uiScore:72,rawScore:61},
  {type:'pore',uiScore:84,rawScore:88},
  {type:'texture',uiScore:76,rawScore:80},
  {type:'redness',uiScore:77,rawScore:72}
]);
