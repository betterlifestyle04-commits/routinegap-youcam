/**
 * Non-persistent, deterministic guide data for a six-stop RoutineGap tour.
 * A tour is a navigation aid, never a clinical assessment, shopping action,
 * photo upload, real YouCam result or validated user achievement.
 */
export const TOUR_STEPS=Object.freeze([
 {id:'signals',tab:'scan',eyebrow:'01 / SKIN ANALYSIS',title:'Start with skin context, not a diagnosis.',body:'Inspect an explicitly illustrative skin signal preview. The live YouCam path is separate: it requires a suitable photo, consent and a protected demo passcode.',tip:'The photo readiness checklist runs on-device. This tour does not upload images or consume YouCam API credits.',action:'Inspect the example signals'},
 {id:'inventory',tab:'shelf',eyebrow:'02 / INVENTORY',title:'Your shelf comes before a shopping list.',body:'Review cleanser, moisturizer and SPF categories. Example shelf entries are fictional placeholders until you add your own products.',tip:'To personalize gap analysis, enter products you truly own. You can import or export your inventory locally.',action:'Review shelf coverage'},
 {id:'rhythm',tab:'routine',eyebrow:'03 / ROUTINE',title:'Turn owned products into a daily rhythm.',body:'Explore how morning and evening steps fit together. Only checklist actions tied to your actual owned items count as personal completion.',tip:'A daily checkbox reflects your own action. It is not verified adherence, effectiveness or medical progress.',action:'Inspect the routine planner'},
 {id:'discover',tab:'shop',eyebrow:'04 / SHOPPING STUDIO',title:'Browse thoughtfully before spending.',body:'Discover 25 clearly fictional skincare concepts, each with educational details, optional categories and transparent demo prices.',tip:'Explore labels and your budget without assuming ingredients, retailer inventory, results or real checkout.',action:'Explore concept details'},
 {id:'contrast',tab:'compare',eyebrow:'05 / COMPARE LAB',title:'Put alternatives side by side.',body:'Compare up to three illustrative concepts using their stated tags, example prices and your recorded shelf overlap.',tip:'Comparisons are local demonstrations, not real product rankings or verified merchant offers.',action:'Open comparison lab'},
 {id:'evidence',tab:'trail',eyebrow:'06 / DECISION TRAIL',title:'Make the reasoning easy to inspect.',body:'See why RoutineGap labels an option as covered, optional or worth considering. You can export a locally generated decision brief.',tip:'The brief distinguishes sample signals from a real YouCam report and excludes uploaded photos and credentials.',action:'Inspect the decision trail'}
]);
const validIndex=i=>Number.isInteger(i)&&i>=0&&i<TOUR_STEPS.length;
export function getTourStep(index){return validIndex(index)?TOUR_STEPS[index]:null;}
export function tourSummary(index,{scanSource='none',sampleInventory=true,shelfCount=0}={}){
 const step=getTourStep(index);if(!step)return null;
 const source=scanSource==='live'?'real YouCam result visible':scanSource==='sample'?'illustrative example loaded':'no scan report loaded';
 const shelf=sampleInventory?'illustrative starter shelf':'user-entered shelf with '+Math.max(0,Math.floor(Number(shelfCount)||0))+' recorded products';
 return {...step,index,total:TOUR_STEPS.length,percent:Math.round((index+1)/TOUR_STEPS.length*100),
  previous:validIndex(index-1)?index-1:null,next:validIndex(index+1)?index+1:null,
  signalStatus:source,shelfStatus:shelf,
  provenance:'This is a guided navigation tour. Moving between steps is not a record of product use, purchases, scan completion or medical outcomes.'};
}
export function moveTour(index,direction){
 if(!validIndex(index)||!['next','previous'].includes(direction))return null;
 const next=index+(direction==='next'?1:-1);
 return validIndex(next)?next:null;
}
export function tourTabIndex(tab){return TOUR_STEPS.findIndex(x=>x.tab===tab);}
