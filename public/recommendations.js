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
  {id:'soft-cleanser',name:'Cream Comfort Cleanser',brand:'Concept collection',step:'cleanser',price:15,tags:['hydrating','fragrance-free'],goals:['moisture','redness'],description:'An alternate creamy cleansing step.'},
  {id:'calm-milk',name:'Soft Milk Cleanser',brand:'RoutineGap concepts',step:'cleanser',price:16,tags:['gentle','fragrance-free','creamy'],goals:['moisture','redness'],description:'A mild-feeling cleansing format for a simple routine.'},
  {id:'fresh-foam',name:'Fresh Foam Wash',brand:'RoutineGap concepts',step:'cleanser',price:14,tags:['lightweight','foam'],goals:['oiliness','routine'],description:'An airy rinse-off concept for everyday cleansing.'},
  {id:'silk-gel-cleanser',name:'Silk Gel Cleanser',brand:'RoutineGap concepts',step:'cleanser',price:19,tags:['gel','fragrance-free'],goals:['texture','pore'],description:'A transparent gel-format cleanser concept.'},
  {id:'oat-cloud-cleanser',name:'Oat Cloud Cleanser',brand:'RoutineGap concepts',step:'cleanser',price:21,tags:['creamy','gentle','fragrance-free'],goals:['redness','moisture'],description:'A creamy-feeling daily wash concept.'},
  {id:'water-veil-gel',name:'Water Veil Gel Cream',brand:'RoutineGap concepts',step:'moisturizer',price:20,tags:['lightweight','hydrating','fragrance-free'],goals:['oiliness','moisture'],description:'A light gel-cream texture concept.'},
  {id:'daily-soft-lotion',name:'Daily Soft Lotion',brand:'RoutineGap concepts',step:'moisturizer',price:15,tags:['hydrating','fragrance-free'],goals:['routine','moisture'],description:'A straightforward daily moisturizer concept.'},
  {id:'evening-cream',name:'Evening Comfort Cream',brand:'RoutineGap concepts',step:'moisturizer',price:27,tags:['rich','fragrance-free'],goals:['moisture','redness'],description:'A richer finish for those who prefer cream textures.'},
  {id:'air-light-lotion',name:'Air Light Lotion',brand:'RoutineGap concepts',step:'moisturizer',price:18,tags:['lightweight','gel'],goals:['oiliness','pore'],description:'A quick-spreading lotion concept.'},
  {id:'soft-mineral-spf',name:'Soft Mineral SPF 50',brand:'RoutineGap concepts',step:'spf',price:28,tags:['sun-protection','fragrance-free','mineral'],goals:['routine','redness'],description:'An example mineral sunscreen format; no SPF testing is represented.'},
  {id:'city-screen-spf',name:'City Screen SPF 30',brand:'RoutineGap concepts',step:'spf',price:20,tags:['sun-protection','lightweight'],goals:['routine','oiliness'],description:'An illustrative everyday sunscreen concept.'},
  {id:'daily-shield-spf',name:'Daily Shield SPF 50',brand:'RoutineGap concepts',step:'spf',price:29,tags:['sun-protection','fragrance-free'],goals:['routine','moisture'],description:'An example higher-numbered SPF label, not an efficacy claim.'},
  {id:'dewy-screen-spf',name:'Dewy Screen SPF 30',brand:'RoutineGap concepts',step:'spf',price:26,tags:['sun-protection','hydrating'],goals:['moisture','texture'],description:'An illustrative moisturizing sunscreen format.'},
  {id:'comfort-drop',name:'Comfort Drop Serum',brand:'RoutineGap concepts',step:'serum',price:24,tags:['hydrating','fragrance-free'],goals:['moisture','redness'],description:'An optional comfort-focused cosmetic concept.'},
  {id:'glow-water-serum',name:'Glow Water Serum',brand:'RoutineGap concepts',step:'serum',price:19,tags:['hydrating','lightweight'],goals:['texture','moisture'],description:'An optional watery serum texture concept.'},
  {id:'silk-serum',name:'Silk Finish Serum',brand:'RoutineGap concepts',step:'serum',price:29,tags:['fragrance-free','texture-focus'],goals:['texture','pore'],description:'An optional sensory finish concept, not a treatment claim.'},
  {id:'quiet-serum',name:'Quiet Balance Serum',brand:'RoutineGap concepts',step:'serum',price:16,tags:['lightweight','fragrance-free'],goals:['oiliness','redness'],description:'An optional minimal-feeling cosmetic serum concept.'}
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
/**
 * Perfect Corp can return format=json results.output as a keyed object (the
 * official score_info structure), not only the record list used in older mocks.
 * Never fill missing scores with zero or invent an average across face regions.
 */
export function normalizeScanOutput(payload){
  const output=payload?.data?.results?.output;
  if(!output || typeof output!=='object')throw Error('Provider completed without a YouCam result payload.');
  const allow=new Set(['moisture','oiliness','pore','texture','skin_type','redness']);
  const entries=Array.isArray(output)?output.map(x=>[x?.type,x]):Object.entries(output);
  const score=value=>{
    if(value===null||value===undefined||value==='')return null;
    if(typeof value!=='number'&&!(typeof value==='string'&&value.trim()!==''))return null;
    const number=Number(value);
    return Number.isFinite(number)&&number>=0&&number<=100?number:null;
  };
  const signals=[];
  for(const [type,node] of entries){
    if(!allow.has(type)||!node||typeof node!=='object'||Array.isArray(node))continue;
    // 'whole' contains the vendor's own whole-face score for regional measures;
    // it is not an inferred or invented aggregation.
    const whole=node.whole&&typeof node.whole==='object'&&!Array.isArray(node.whole)?node.whole:node;
    const uiScore=score(whole.ui_score);
    const rawScore=score(whole.raw_score);
    const isSkinType=type==='skin_type';
    let regions=null;
    if(isSkinType){
      const allowed=['whole','t_zone','u_zone','T_zone','U_zone'];
      const source=node.regions&&typeof node.regions==='object'?node.regions:node;
      regions=Object.fromEntries(allowed.flatMap(k=>{
        const v=source[k], category=typeof v==='string'?v:
          v&&typeof v==='object'?(v.skin_type||v.type||v.value||null):null;
        return typeof category==='string'&&category.length<=60?[[k,category]]:[];
      }));
      if(Object.keys(regions).length===0)regions=null;
    }
    // Do not show empty vendor records as a successful cosmetic observation.
    if(uiScore===null&&rawScore===null&&!regions)continue;
    signals.push({type,uiScore,rawScore,regions});
  }
  if(!signals.length)throw Error('YouCam completed but returned no usable cosmetic observations.');
  return signals;
}

export const sampleScan = Object.freeze([
  {type:'moisture',uiScore:70,rawScore:49},
  {type:'oiliness',uiScore:72,rawScore:61},
  {type:'pore',uiScore:84,rawScore:88},
  {type:'texture',uiScore:76,rawScore:80},
  {type:'redness',uiScore:77,rawScore:72}
]);
