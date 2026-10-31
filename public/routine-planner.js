/**
 * A local, non-clinical checklist of ordinary skincare routine steps.
 * This is not medical advice or a recommendation to use active ingredients.
 * No scan scores, images, product names, or tracking identifiers are persisted here.
 */
export const ROUTINE_LOG_KEY = 'routinegap_routine_checklist_v1';
const STEP_DETAILS = [
  {period:'am',step:'cleanser',label:'Cleanse',hint:'A gentle cleansing step, as appropriate for your routine.'},
  {period:'am',step:'moisturizer',label:'Moisturize',hint:'Use the moisturizer you already own.'},
  {period:'am',step:'spf',label:'Daily SPF',hint:'Follow your sunscreen label and reapplication guidance.'},
  {period:'pm',step:'cleanser',label:'Cleanse',hint:'Remove the day’s sunscreen and impurities as appropriate.'},
  {period:'pm',step:'moisturizer',label:'Moisturize',hint:'Use the moisturizer you already own.'}
];
export function localRoutineDate(value = new Date()) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new TypeError('Invalid date');
  const part = n => String(n).padStart(2,'0');
  return value.getFullYear()+'-'+part(value.getMonth()+1)+'-'+part(value.getDate());
}
export function buildRoutinePlan(owned = []) {
  const safe = Array.isArray(owned) ? owned.slice(0,60) : [];
  const entries = STEP_DETAILS.map(item => {
    const product = safe.find(p => p && p.step===item.step &&
      typeof p.name==='string' && p.name.trim() && typeof p.id==='string' && p.id.length>0 && p.id.length<=60);
    return {...item,available:!!product,productName:product?.name.slice(0,90)||null,
      key:product ? item.period+'-'+item.step+':'+encodeURIComponent(product.id) : null};
  });
  return {morning:entries.filter(x=>x.period==='am'),
    evening:entries.filter(x=>x.period==='pm'),
    availableCount:entries.filter(x=>x.available).length,
    missingSteps:[...new Set(entries.filter(x=>!x.available).map(x=>x.step))]};
}
export function readRoutineLog(raw, date, plan) {
  const empty = {date,done:[]};
  if(typeof date!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))return empty;
  let value;
  try {value=typeof raw==='string'?JSON.parse(raw):raw;} catch {return empty;}
  if(!value||typeof value!=='object'||Array.isArray(value)||value.date!==date||!Array.isArray(value.done))return empty;
  const valid=new Set([...plan.morning,...plan.evening].filter(item=>item.available).map(item=>item.key));
  return {date,done:[...new Set(value.done.filter(key=>typeof key==='string'&&valid.has(key)))].slice(0,5)};
}
export function toggleRoutineStep(log, date, plan, key, complete) {
  const normalized=readRoutineLog(log,date,plan);
  const valid=[...plan.morning,...plan.evening].some(item=>item.available&&item.key===key);
  if(!valid)return normalized;
  const remaining=normalized.done.filter(item=>item!==key);
  if(complete)remaining.push(key);
  return {date,done:remaining};
}
export function routineProgress(log, plan) {
  const available=[...plan.morning,...plan.evening].filter(item=>item.available);
  const completed=available.filter(item=>log.done.includes(item.key)).length;
  return {completed,total:available.length};
}
