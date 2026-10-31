/**
 * Educational details for fictional ecommerce examples. These entries explain
 * what the demo catalog can and cannot tell a shopper. Nothing here is a
 * verified ingredient list, merchant offer, efficacy claim or medical advice.
 */
export const CATEGORY_GUIDES=Object.freeze({
 cleanser:{heading:'Start with the cleanse step',placement:'Commonly a rinse-off cleansing category',intent:'Compare the advertised texture format and whether you already have a cleanser.',caution:'Choose products by their real ingredient labels and usage instructions. These concept descriptions are not real formulations.'},
 moisturizer:{heading:'Understand the moisturizer step',placement:'An ordinary moisturizing routine category',intent:'Compare lightweight and rich texture descriptors against the products you already own.',caution:'A moisturizing description is not clinical evidence, an allergy check or a verified ingredient claim.'},
 spf:{heading:'Daily sun-protection category',placement:'A routine category associated with sunscreen use',intent:'Check whether you already own a real labeled sunscreen before exploring these examples.',caution:'SPF numbers shown here are part of fictional product names, not tested or certified sunscreen performance. Use a real product with verified labeling and follow its directions.'},
 serum:{heading:'An optional extra',placement:'An optional cosmetic step, not one of the three basic routine categories',intent:'Ask whether this step is needed at all before considering another product.',caution:'These examples make no treatment, ingredient concentration, compatibility or effectiveness claims.'}
});
export const TAG_GLOSSARY=Object.freeze({
 'creamy':'A fictional descriptor for a cream-like texture; not a verified formula.',
 'foam':'A fictional descriptor for a foaming wash format.',
 'fragrance-free':'An illustrative catalog tag only, not ingredient-label verification or an allergy guarantee.',
 'gel':'A fictional texture descriptor, not evidence of ingredients or performance.',
 'gentle':'A concept descriptor, not clinical tolerability testing.',
 'hydrating':'An illustrative merchandising descriptor, not a measured hydration result.',
 'lightweight':'An illustrative texture preference, not a verified performance claim.',
 'mineral':'An illustrative sunscreen format tag, not an ingredient statement or SPF certification.',
 'rich':'An illustrative fuller-feel texture description.',
 'sun-protection':'A category tag only. Actual sunscreen performance has not been tested.',
 'texture-focus':'An illustrative cosmetic focus tag, not evidence of an effect.'
});
const allowed=new Set(Object.keys(CATEGORY_GUIDES));
function safeBudget(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1000,n)):0;}
export function buildConceptStory({id,catalog=[],decisionRows=[],owned=[],sampleInventory=true,budget=0,goal='',fragranceFree=false}={}){
 if(typeof id!=='string'||!Array.isArray(catalog))return null;
 const item=catalog.find(p=>p.id===id&&allowed.has(p.step));
 if(!item)return null;
 const row=Array.isArray(decisionRows)?decisionRows.find(p=>p.id===id):null;
 const genuine=sampleInventory?[]:(Array.isArray(owned)?owned:[]);
 const existing=genuine.filter(x=>x&&x.step===item.step&&typeof x.name==='string');
 const related=catalog.filter(p=>p.step===item.step&&p.id!==id)
   .sort((a,b)=>Math.abs(a.price-item.price)-Math.abs(b.price-item.price)||a.price-b.price||a.name.localeCompare(b.name,'en'))
   .slice(0,3).map(p=>({id:p.id,name:p.name,price:p.price,step:p.step}));
 const max=safeBudget(budget);
 const category=CATEGORY_GUIDES[item.step];
 const tags=Array.isArray(item.tags)?item.tags.map(label=>({label,meaning:TAG_GLOSSARY[label]||'Unverified illustrative product descriptor.'})):[];
 return {
   id:item.id,name:item.name,description:item.description,brand:item.brand,step:item.step,price:item.price,
   category,tags,related,
   storyLabel:row?.decision==='skip'?(sampleInventory?'SAMPLE SCENARIO OVERLAP':'ALREADY COVERED'):row?.decision==='optional'?'OPTIONAL EXAMPLE':row?.decision==='consider'?'CATEGORY TO REVIEW':'ILLUSTRATIVE EXAMPLE',
   reason:row?.decision==='skip'&&sampleInventory?'The illustrative starter shelf in this demonstration already contains this routine category. This is NOT evidence of ownership. Enter your real products for personalized decisions.':typeof row?.reason==='string'?row.reason:'Review your actual products and selected preferences before considering a category.',
   duplicate:existing.length>0,demoCovered:row?.decision==='skip',existing:existing.slice(0,3).map(p=>p.name),
   demoBudget:max,individuallyAffordable:item.price<=max,
   fragranceTagged:item.tags?.includes('fragrance-free')===true,fragranceFilter:fragranceFree===true,
   goalTagged:Array.isArray(item.goals)&&item.goals.includes(goal),
   sampleInventory:sampleInventory===true,
   disclosure:'Fictional educational catalog. No real ingredients, tested SPF, clinical efficacy, merchant pricing, inventory, ratings or checkout.'
 };
}
