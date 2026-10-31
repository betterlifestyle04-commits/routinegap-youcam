/**
 * Private, versioned shelf portability. Never accepts scans, photos, passcodes,
 * provider receipts, or unrecognized fields. Backup stays on the user's device.
 */
import {goals,stepLabels,normalizeShelf} from './recommendations.js';
export const SHELF_BACKUP_FORMAT='routinegap-shelf';
export const SHELF_BACKUP_VERSION=1;
export const SHELF_BACKUP_MAX_BYTES=64*1024;
export const SHELF_LIMIT=60;
const allowedStep=new Set(Object.keys(stepLabels));
const allowedGoal=new Set(goals.map(x=>x.id));
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,60}$/.test(id);
const onlyKeys=(obj,allowed)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).every(k=>allowed.includes(k));
function validateProduct(p){
  if(!onlyKeys(p,['id','name','step','price','tags']))throw Error('Unsupported product data in backup.');
  if(!validId(p.id)||typeof p.name!=='string'||p.name.trim().length===0||p.name.length>90||!allowedStep.has(p.step)
   ||typeof p.price!=='number'||!Number.isFinite(p.price)||p.price<0||p.price>10000
   ||!Array.isArray(p.tags)||p.tags.length>8||!p.tags.every(t=>typeof t==='string'&&t.length<=40))
    throw Error('Backup has an invalid product entry.');
  return {id:p.id,name:p.name.trim(),step:p.step,price:p.price,tags:p.tags.slice()};
}
function validatedPrefs(p){
  if(!onlyKeys(p,['budget','goal','fragranceFree']))throw Error('Unsupported preferences in backup.');
  if(typeof p.budget!=='number'||!Number.isFinite(p.budget)||p.budget<0||p.budget>1000
   ||!allowedGoal.has(p.goal)||typeof p.fragranceFree!=='boolean')throw Error('Backup preferences are invalid.');
  return {budget:p.budget,goal:p.goal,fragranceFree:p.fragranceFree};
}
export function makeShelfBackup({shelf=[],budget=60,goal='moisture',fragranceFree=false,sampleInventory=false}={},exportedAt=new Date().toISOString()){
  if(sampleInventory)throw Error('The illustrative starter shelf cannot be exported as your real inventory.');
  const owned=normalizeShelf(shelf);
  if(owned.length>60)throw Error('Shelf exceeds maximum size.');
  const ids=new Set();
  const items=owned.map((x,i)=>{
    let id=validId(x.id)?x.id:'owned-'+i;
    while(ids.has(id))id='owned-'+i+'-'+ids.size;
    ids.add(id);
    return validateProduct({id,name:x.name,step:x.step,price:Math.min(10000,x.price),
      tags:x.tags.map(t=>t.slice(0,40))});
  });
  const preferences=validatedPrefs({budget,goal,fragranceFree});
  return {format:SHELF_BACKUP_FORMAT,version:SHELF_BACKUP_VERSION,
    exportedAt:String(exportedAt).slice(0,32),shelf:items,preferences};
}
export function readShelfBackup(raw){
  if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>SHELF_BACKUP_MAX_BYTES)
    throw Error('Choose a RoutineGap JSON backup smaller than 64 KB.');
  let parsed;
  try{parsed=JSON.parse(raw);}catch{throw Error('This file is not valid JSON.');}
  if(!onlyKeys(parsed,['format','version','exportedAt','shelf','preferences'])||
     parsed.format!==SHELF_BACKUP_FORMAT||parsed.version!==SHELF_BACKUP_VERSION||
     typeof parsed.exportedAt!=='string'||parsed.exportedAt.length>32)
    throw Error('This is not a supported RoutineGap shelf backup.');
  if(!Array.isArray(parsed.shelf)||parsed.shelf.length>SHELF_LIMIT)
    throw Error('Backup inventory exceeds 60 products or is malformed.');
  const shelf=parsed.shelf.map(validateProduct);
  if(new Set(shelf.map(p=>p.id)).size!==shelf.length)throw Error('Backup contains duplicate product identifiers.');
  const preferences=validatedPrefs(parsed.preferences);
  return {shelf,preferences};
}
export function shelfSummary(shelf=[],sampleInventory=true,savedCount=0){
  const owned=normalizeShelf(shelf);
  const real=!sampleInventory&&owned.length>0;
  const steps=['cleanser','moisturizer','spf'];
  const present=steps.filter(s=>owned.some(p=>p.step===s));
  return {real,ownedCount:real?owned.length:0,coveredCount:real?present.length:0,
    missingCount:real?steps.length-present.length:3,
    savedCount:Number.isInteger(savedCount)?Math.max(0,Math.min(6,savedCount)):0};
}
