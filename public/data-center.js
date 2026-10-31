/**
 * Data transparency and precise deletion for RoutineGap's browser-local state.
 * No application storage value is uploaded or sent to the provider by this module.
 * Do not call localStorage.clear()/sessionStorage.clear() because other apps may
 * coexist on this origin now or in the future.
 */
export const DATA_GROUPS=Object.freeze([
  {id:'shelf',title:'Shelf & shopping preferences',description:'Your own product names, steps, tags, recorded prices, budget and cosmetic preferences.',keys:[{scope:'local',key:'routinegap_state'}]},
  {id:'ideas',title:'Saved concept ideas',description:'Identifiers for up to six illustrative catalog ideas, not purchases.',keys:[{scope:'local',key:'routinegap_saved_concepts_v1'}]},
  {id:'comparison',title:'Comparison shortlist',description:'Identifiers for up to three fictional concepts, separate from saved ideas.',keys:[{scope:'local',key:'routinegap_compare_ids_v1'}]},
  {id:'checklist',title:'Daily routine checkmarks',description:'Your local daily checklist state, not evidence of treatment or medical progress.',keys:[{scope:'local',key:'routinegap_routine_checklist_v1'}]},
  {id:'liveReport',title:'Optional saved live observations',description:'If you explicitly saved one, a limited real YouCam cosmetic report stored in this tab for up to 24 hours.',keys:[{scope:'session',key:'routinegap_saved_live_report_v1'}]},
  {id:'pending',title:'Pending scan reference',description:'A task reference in this tab, used to resume a scan task after interruption.',keys:[{scope:'session',key:'routinegap_pending_scan_v1'}]}
]);
export const ERASE_CATEGORIES=Object.freeze([...DATA_GROUPS.map(x=>x.id),'all']);
export function dataGroupsFor(category){
 if(category==='all')return DATA_GROUPS;
 const found=DATA_GROUPS.find(x=>x.id===category);
 return found?[found]:[];
}
export function describeDataState({shelf=[],sampleInventory=true,savedIds=[],compareIds=[],routineLog=null,savedLiveReport=false,pending=null,hasPhoto=false,cartIds=[]}={}){
 const actual=!sampleInventory&&Array.isArray(shelf)?shelf.length:0;
 const saved=Array.isArray(savedIds)?savedIds.length:0;
 const compared=Array.isArray(compareIds)?compareIds.length:0;
 const data={
  shelf:{count:actual,hasValue:actual>0||!sampleInventory,status:sampleInventory?'Illustrative starter shelf':actual+' entered product'+(actual===1?'':'s')},
  ideas:{count:saved,hasValue:saved>0,status:saved+' saved concept ID'+(saved===1?'':'s')},
  comparison:{count:compared,hasValue:compared>0,status:compared+' selected concept ID'+(compared===1?'':'s')},
  checklist:{count:0,hasValue:!!routineLog,status:routineLog?'Saved daily checkmarks':'No saved checklist'},
  liveReport:{count:0,hasValue:!!savedLiveReport,status:savedLiveReport?'Report available in this tab':'No saved report'},
  pending:{count:0,hasValue:!!pending,status:pending?'Task reference available':'No saved reference'}
 };
 return {groups:DATA_GROUPS.map(g=>({...g,...data[g.id]})),realProducts:actual,
   hasPhoto:!!hasPhoto,cartCount:Array.isArray(cartIds)?cartIds.length:0,
   activeGroups:Object.values(data).filter(x=>x.hasValue).length};
}
export function readStoragePresence(localStorage,sessionStorage){
 const stores={local:localStorage,session:sessionStorage};
 return DATA_GROUPS.map(group=>{
  let exists=false,unavailable=false;
  for(const {scope,key} of group.keys){
   try{const store=stores[scope];if(!store){unavailable=true;continue;}
       if(store.getItem(key)!==null)exists=true;}
   catch{unavailable=true;}
  }
  return {id:group.id,exists,unavailable};
 });
}
/**
 * Returns a failure if any requested key could not be removed; caller must
 * never claim successful deletion on an error. Also verifies removal.
 */
export function eraseOwnedStorage(category,{local,session}={}){
 const selected=dataGroupsFor(category);
 if(!selected.length)throw new Error('Invalid data category.');
 const stores={local,session};
 const keys=selected.flatMap(g=>g.keys);
 if(keys.some(({scope})=>!stores[scope]||typeof stores[scope].removeItem!=='function'||typeof stores[scope].getItem!=='function'))
   throw new Error('Browser storage is not available. Nothing was erased.');
 for(const {scope,key} of keys){
   try{stores[scope].removeItem(key);}
   catch{throw new Error('Could not delete all requested local entries. Check browser storage settings.');}
 }
 for(const {scope,key} of keys){
   try{if(stores[scope].getItem(key)!==null)throw new Error('Deletion was not confirmed in browser storage.');}
   catch{throw new Error('Deletion could not be confirmed in browser storage.');}
 }
 return {category,removedKeys:keys.map(({key})=>key)};
}
