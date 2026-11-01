/**
 * Scenario Lab — four authored, fictional shelf situations for explaining the
 * existing essentials-first shopping logic. No real customer records, skin
 * diagnoses, price claims, fake retail products, network requests or storage.
 */
import {catalog,evaluateShop,goals,stepLabels} from './recommendations.js';

export const SCENARIOS=Object.freeze([
 Object.freeze({
  id:'fresh-start',index:'01',label:'Fresh start',headline:'Nothing entered yet',
  short:'See the illustrative plan before adding any owned products.',
  story:'A new visitor has not recorded a cleanser, moisturizer or SPF product. The lab demonstrates how a budget constrains an essentials-first example shortlist.',
  focus:'routine',budget:50,fragranceFree:false,
  products:[],icon:'✧',tag:'0 recorded steps',takeaway:'Entering a real shelf matters: without it, RoutineGap cannot know what you already own.'
 }),
 Object.freeze({
  id:'missing-spf',index:'02',label:'The SPF gap',headline:'Two basics already covered',
  short:'Explore how recorded ownership changes the shortlist.',
  story:'This fictional shelf contains a cleanser and a moisturizer. Recording those categories excludes example concepts that overlap the same steps.',
  focus:'routine',budget:65,fragranceFree:false,
  products:[{id:'case-cleanser',name:'Example owned cleanser',step:'cleanser',price:16,tags:['gentle']},{id:'case-cream',name:'Example owned moisturizer',step:'moisturizer',price:19,tags:['hydrating']}],
  icon:'☼',tag:'2 recorded steps',takeaway:'A concept labeled “already covered” is not a measured avoided purchase or verified product duplicate.'
 }),
 Object.freeze({
  id:'fully-covered',index:'03',label:'Already covered',headline:'The three basics are present',
  short:'See when the transparent rules suggest buying nothing.',
  story:'A fictional user has a cleanser, moisturizer and SPF category in their shelf. The core rule flags all matching essentials as covered; optional extras are not necessities.',
  focus:'texture',budget:85,fragranceFree:false,
  products:[{id:'case-full-cleanser',name:'Example cleanser',step:'cleanser',price:14,tags:['gentle']},{id:'case-full-cream',name:'Example moisturizer',step:'moisturizer',price:22,tags:['hydrating']},{id:'case-full-spf',name:'Example sunscreen',step:'spf',price:28,tags:['sun-protection']}],
  icon:'✓',tag:'3 recorded steps',takeaway:'Having all three categories on a shelf is not proof of product suitability, verified SPF efficacy or healthy skin.'
 }),
 Object.freeze({
  id:'tag-preference',index:'04',label:'Fewer tagged options',headline:'Preference changes discovery',
  short:'Watch a fragrance-tag filter narrow fictional concepts.',
  story:'A fictional cleanser has been entered, and the user chooses a fragrance-free catalog tag filter. The filter applies to concept metadata, not real ingredients or allergies.',
  focus:'moisture',budget:70,fragranceFree:true,
  products:[{id:'case-fragrance-cleanser',name:'Example unfragranced cleanser',step:'cleanser',price:20,tags:['fragrance-free']}],
  icon:'◇',tag:'1 recorded step',takeaway:'Fragrance-free tags on fictional concepts do not verify a real formula, allergen profile or clinical compatibility.'
 })
]);
const validGoals=new Set(goals.map(g=>g.id));
const byId=new Map(SCENARIOS.map(s=>[s.id,s]));
const basics=['cleanser','moisturizer','spf'];
const toShortlist=decision=>decision.cartIds.map(id=>{
 const row=decision.rows.find(r=>r.id===id);
 return row?{id:row.id,name:row.name,step:row.step,label:stepLabels[row.step]||row.step,price:row.price,decision:row.decision,reason:row.reason}:null;
}).filter(Boolean);
export function getScenario(id){
 return typeof id==='string'&&byId.has(id)?byId.get(id):SCENARIOS[0];
}
export function scenarioPreview(id,{budget=null,goal=null}={}){
 const s=getScenario(id);
 const exampleBudget=budget===null?s.budget:Number.isFinite(Number(budget))?Math.max(0,Math.min(1000,Math.round(Number(budget)))):s.budget;
 const selectedGoal=validGoals.has(goal)?goal:s.focus;
 const options={budget:exampleBudget,goal:selectedGoal,fragranceFree:s.fragranceFree};
 const without=evaluateShop({...options,shelf:[]});
 const withShelf=evaluateShop({...options,shelf:s.products.map(p=>({...p}))});
 const ownedSteps=basics.filter(step=>withShelf.owned.some(p=>p.step===step));
 const after=toShortlist(withShelf);
 const before=toShortlist(without);
 const unfilled=withShelf.missingSteps.filter(step=>!after.some(p=>p.step===step));
 const flags=withShelf.rows.filter(p=>p.decision==='skip').length;
 return {
  id:s.id,label:s.label,headline:s.headline,short:s.short,story:s.story,
  icon:s.icon,tag:s.tag,takeaway:s.takeaway,selectedGoal,budget:exampleBudget,
  fragranceFree:s.fragranceFree,scenarioOwned:s.products.map(p=>({id:p.id,name:p.name,step:p.step,label:stepLabels[p.step],price:p.price})),
  ownedCount:s.products.length,coveredCount:ownedSteps.length,covered:ownedSteps,
  missing:withShelf.missingSteps,unfilled,
  before:{shortlist:before,total:without.cartTotal,count:before.length},
  after:{shortlist:after,total:withShelf.cartTotal,count:after.length},
  taggedConcepts:withShelf.rows.length,overlapFlags:flags,
  cartDifference:without.cartTotal-withShelf.cartTotal,
  provenance:'All profiles, product names, prices and shopping outputs on this screen are fictional examples computed with the same deterministic rules as Shopping Studio. The before/after cart difference is not realized savings or evidence of a purchase.',
  constraints:'A category is present because a product was entered in the example, not because its ingredients, clinical safety, availability, effectiveness or true SPF have been verified.'
 };
}
export function scenarioBudgetPreset(value){
 const n=Number(value);
 return Number.isInteger(n)&&[25,50,75,100].includes(n)?n:null;
}
export function scenarioCaseSummary(id,{budget=null}={}){
 const x=scenarioPreview(id,{budget});
 const p=x.after.shortlist.map(item=>item.name+' (fictional USD '+item.price+')').join(', ')||'No essential concept selected';
 return [x.label+' — fictional scenario',x.story,'Owned categories: '+x.covered.length+'/3.',
  'Budget: illustrative USD '+x.budget+'.',
  'Without the example shelf: '+x.before.count+' proposed concepts, USD '+x.before.total+'.',
  'With the example shelf: '+x.after.count+' proposed concepts, USD '+x.after.total+'.',
  'Example shortlist: '+p+'.',x.provenance,x.constraints].join('\n');
}
