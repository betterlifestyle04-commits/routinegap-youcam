import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DATA_GROUPS,ERASE_CATEGORIES,dataGroupsFor,describeDataState,readStoragePresence,eraseOwnedStorage} from '../public/data-center.js';

function storage(values={}){
 const data=new Map(Object.entries(values));
 return {getItem:k=>data.has(k)?data.get(k):null,
   setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),
   keys:()=>[...data.keys()]};
}
const real=[{id:'my-a',name:'My cleanser',step:'cleanser',price:20,tags:[]}];

test('data center enumerates only six explicitly owned key groups',()=>{
 assert.equal(DATA_GROUPS.length,6);
 assert.equal(ERASE_CATEGORIES.length,7);
 assert.deepEqual(DATA_GROUPS.map(g=>g.id),['shelf','ideas','comparison','checklist','liveReport','pending']);
 assert.equal(DATA_GROUPS.flatMap(g=>g.keys).length,6);
 assert.equal(new Set(DATA_GROUPS.flatMap(g=>g.keys.map(x=>x.key))).size,6);
 assert.equal(dataGroupsFor('shelf').length,1);
 assert.equal(dataGroupsFor('all').length,6);
 assert.deepEqual(dataGroupsFor('__proto__'),[]);
});
test('privacy snapshot excludes fictitious starter products from real ownership',()=>{
 const sample=describeDataState({shelf:real,sampleInventory:true,savedIds:['mist-cleanser'],compareIds:['mineral-spf'],hasPhoto:true,cartIds:['cart']});
 assert.equal(sample.realProducts,0);
 assert.equal(sample.hasPhoto,true);
 assert.equal(sample.cartCount,1);
 assert.equal(sample.groups.find(g=>g.id==='shelf').status,'Illustrative starter shelf');
 assert.equal(sample.groups.find(g=>g.id==='ideas').count,1);
 assert.equal(sample.groups.find(g=>g.id==='comparison').count,1);
 const actual=describeDataState({shelf:real,sampleInventory:false,liveReport:true,pending:{receipt:'secret'}});
 assert.equal(actual.realProducts,1);
 assert.ok(actual.groups.find(g=>g.id==='liveReport').hasValue);
 assert.ok(actual.groups.find(g=>g.id==='pending').hasValue);
 assert.ok(!JSON.stringify(actual).includes('secret'));
});
test('readStoragePresence checks only known keys and handles blocked storage gracefully',()=>{
 const local=storage({'routinegap_state':'{}','unrelated_application_token':'protected'});
 const session=storage({'routinegap_pending_scan_v1':'secret'});
 const data=readStoragePresence(local,session);
 assert.equal(data.find(x=>x.id==='shelf').exists,true);
 assert.equal(data.find(x=>x.id==='pending').exists,true);
 assert.equal(data.find(x=>x.id==='ideas').exists,false);
 assert.equal(data.find(x=>x.id==='liveReport').exists,false);
 assert.equal(data.find(x=>x.id==='shelf').unavailable,false);
 const blocked=readStoragePresence({getItem(){throw Error('blocked');}},session);
 assert.equal(blocked.find(x=>x.id==='shelf').unavailable,true);
 const missing=readStoragePresence(null,session);
 assert.equal(missing.find(x=>x.id==='shelf').exists,false);
 assert.equal(missing.find(x=>x.id==='shelf').unavailable,true);
});
test('selective erasure preserves all other records and other app data',()=>{
 const local=storage({'routinegap_state':'shelf','routinegap_saved_concepts_v1':'saved',
  'routinegap_compare_ids_v1':'compare','routinegap_routine_checklist_v1':'checks','unrelated_key':'keep'});
 const session=storage({'routinegap_saved_live_report_v1':'report','routinegap_pending_scan_v1':'receipt'});
 const result=eraseOwnedStorage('ideas',{local,session});
 assert.deepEqual(result.removedKeys,['routinegap_saved_concepts_v1']);
 assert.equal(local.getItem('routinegap_saved_concepts_v1'),null);
 assert.equal(local.getItem('routinegap_state'),'shelf');
 assert.equal(local.getItem('unrelated_key'),'keep');
 assert.equal(session.getItem('routinegap_pending_scan_v1'),'receipt');
});
test('erase all deletes only RoutineGap keys in both storage scopes',()=>{
 const keys=Object.fromEntries(DATA_GROUPS.flatMap(g=>g.keys).map(x=>[x.key,'data']));
 const local=storage({...keys,external:'keep'});
 const session=storage({...keys,externalSession:'keep'});
 const before=DATA_GROUPS.flatMap(g=>g.keys);
 const result=eraseOwnedStorage('all',{local,session});
 assert.equal(result.removedKeys.length,before.length);
 for(const g of DATA_GROUPS){for(const item of g.keys){
   assert.equal((item.scope==='local'?local:session).getItem(item.key),null);
 }}
 assert.equal(local.getItem('external'),'keep');
 assert.equal(session.getItem('externalSession'),'keep');
});
test('rejected groups or missing APIs never trigger whole-storage clearing',()=>{
 const local=storage({'routinegap_state':'real'});
 const session=storage();
 assert.throws(()=>eraseOwnedStorage('random',{local,session}),/Invalid data category/);
 assert.throws(()=>eraseOwnedStorage('shelf',{local:null,session}),/not available/);
 assert.equal(local.getItem('routinegap_state'),'real');
});
test('read-only and removal errors are reported without promising successful deletion',()=>{
 const local={getItem:()=> 'still present',removeItem:()=>{}};
 assert.throws(()=>eraseOwnedStorage('shelf',{local,session:storage()}),/confirmed/);
 const denied={getItem:()=> 'content',removeItem:()=>{throw Error('denied');}};
 assert.throws(()=>eraseOwnedStorage('shelf',{local:denied,session:storage()}),/Could not delete/);
});
test('privacy page is a real accessible route with local-only storage controls',async()=>{
 const [app,html,css,search,packageJSON]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
  readFile(new URL('../public/workspace-search.js',import.meta.url),'utf8'),
  readFile(new URL('../package.json',import.meta.url),'utf8')
 ]);
 for(const marker of ["function renderPrivacy()","function erasePrivacyData(category)","data-privacy-erase","id=\"privacy-clear-all\"","id=\"privacy-export-shelf\"","window.location.reload()","window.confirm(prompt)","privacy:'Privacy & data'"])assert.ok(app.includes(marker),marker);
 assert.ok(html.includes('data-tab="privacy"')&&html.includes('id="view-privacy"'));
 assert.ok(search.includes("id:'privacy'"));
 assert.ok(css.includes('.privacy-hero')&&css.includes('.privacy-row')&&css.includes('@media(max-width:580px)'));
 assert.ok(packageJSON.includes('node --check public/data-center.js'));
});
