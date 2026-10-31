/**
 * Local-only UX projection. Never interprets illustrative product data as ownership,
 * routine checkmarks as adherence evidence, or saved concepts as purchases.
 * No persistence and no network calls.
 */
import {buildRoutinePlan,readRoutineLog,routineProgress} from './routine-planner.js';
export const MOBILE_TABS=Object.freeze([
 {id:'overview',label:'Home',symbol:'◫'},
 {id:'shelf',label:'My shelf',symbol:'▧'},
 {id:'scan',label:'Skin scan',symbol:'◎'},
 {id:'shop',label:'Explore',symbol:'◇'}
]);
export const MOBILE_MORE_TABS=Object.freeze([
 {id:'routine',label:'Routine planner',description:'Morning and evening checklists',symbol:'☼'},
 {id:'insights',label:'My insights',description:'See recorded coverage and budgets',symbol:'◴'},
 {id:'compare',label:'Compare lab',description:'Review up to three example concepts',symbol:'⇄'},
 {id:'trail',label:'Decision trail',description:'Inspect the shopping rationale',symbol:'≡'},
 {id:'privacy',label:'Privacy & data',description:'Export or erase local records',symbol:'♧'}
]);
const basics=['cleanser','moisturizer','spf'];
export function buildLaunchpad({shelf=[],sampleInventory=true,savedIds=[],compareIds=[],routineLog=null,scanSource=null,now=new Date()}={}){
 const source=Array.isArray(shelf)?shelf:[];
 const real=sampleInventory===false?source.filter(p=>p&&typeof p.step==='string'&&typeof p.name==='string'&&p.name.trim()):[];
 const ownedCount=real.length;
 const covered=basics.filter(step=>real.some(p=>p.step===step));
 const missing=basics.filter(step=>!covered.includes(step));
 const plan=buildRoutinePlan(real);
 const date=new Date(now);
 const today=Number.isFinite(date.getTime())?date:new Date(0);
 const log=readRoutineLog(routineLog,localDate(today),plan);
 const progress=routineProgress(log,plan);
 const saved=Array.isArray(savedIds)?savedIds.length:0;
 const compared=Array.isArray(compareIds)?compareIds.length:0;
 const scan=scanSource==='live'?'real':scanSource==='sample'?'sample':'none';
 const milestones=[
  {id:'shelf',label:'Record your actual products',complete:ownedCount>0,detail:ownedCount?ownedCount+' user-entered product'+(ownedCount===1?'':'s'):'Example shelf is not ownership',go:'shelf',cta:ownedCount?'Manage my shelf':'Add my first product'},
  {id:'coverage',label:'Review routine coverage',complete:covered.length===3&&ownedCount>0,detail:ownedCount?covered.length+' of 3 basic categories represented':'Start by entering one owned product',go:ownedCount?'routine':'shelf',cta:ownedCount?'Inspect my categories':'Set up my shelf'},
  {id:'routine',label:'Build a daily rhythm',complete:ownedCount>0&&progress.completed>0,detail:progress.total?progress.completed+' of '+progress.total+' available daily checks marked':'No real daily steps available yet',go:ownedCount?'routine':'shelf',cta:ownedCount?'Open my routine':'Record my products'},
  {id:'discover',label:'Explore before you spend',complete:saved+compared>0,detail:saved+' saved example ideas · '+compared+' comparison selections',go:'shop',cta:'Browse example concepts'}
 ];
 // Incomplete coverage is information to review, not a requirement to purchase.
 const priority=ownedCount===0?milestones[0]:
  progress.completed===0?milestones[2]:
  saved+compared===0?milestones[3]:
  milestones[1];
 return {ownedCount,coveredCount:covered.length,missingSteps:missing,
  sampleInventory:sampleInventory===true,savedCount:saved,comparedCount:compared,
  checkedToday:progress.completed,availableToday:progress.total,scan,
  milestones,priority,
  supporting:scan==='real'?'A real YouCam cosmetic observation is available in this tab.':scan==='sample'?'Only illustrative scan observations are being shown.':'Skin analysis is optional; no scan is required to use your shelf.',
  disclosure:'These are local workspace milestones, not clinical outcomes, proven savings, purchases or validated YouCam scan results.'};
}
function localDate(date){
 const part=n=>String(n).padStart(2,'0');
 return date.getFullYear()+'-'+part(date.getMonth()+1)+'-'+part(date.getDate());
}
export function mobileSelection(tab){
 if(MOBILE_TABS.some(x=>x.id===tab))return tab;
 if(MOBILE_MORE_TABS.some(x=>x.id===tab))return 'more';
 return 'overview';
}
