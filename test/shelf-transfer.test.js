import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeShelfBackup,readShelfBackup,shelfSummary,SHELF_BACKUP_FORMAT,SHELF_BACKUP_MAX_BYTES,SHELF_LIMIT} from '../public/shelf-transfer.js';
const own=[{id:'my-1',name:'Gentle wash',step:'cleanser',price:15.50,tags:['gentle','fragrance-free']},
 {id:'my-2',name:'Daily SPF',step:'spf',price:28,tags:['sun-protection']}];
const prefs={shelf:own,budget:80,goal:'routine',fragranceFree:true,sampleInventory:false};

test('clean shelf backups round-trip exact user-entered products and preferences',()=>{
 const backup=makeShelfBackup(prefs,'2026-10-31T15:00:00Z');
 assert.equal(backup.format,SHELF_BACKUP_FORMAT);
 assert.equal(backup.version,1);
 assert.equal(backup.exportedAt,'2026-10-31T15:00:00Z');
 assert.deepEqual(readShelfBackup(JSON.stringify(backup)),{shelf:own,preferences:{budget:80,goal:'routine',fragranceFree:true}});
});
test('only inventory and selected shopping preferences are present; no provider secrets or reports',()=>{
 const input={...prefs,photo:'selfie',scan:{score:77},demoAccess:'PRIVATE',receipt:'PRIVATE'};
 const text=JSON.stringify(makeShelfBackup(input));
 for(const secret of ['selfie','scan','demoAccess','receipt','PRIVATE','provider','skin_score'])assert.ok(!text.includes(secret));
});
test('illustrative starter inventory cannot be exported as real ownership',()=>{
 assert.throws(()=>makeShelfBackup({...prefs,sampleInventory:true}),/illustrative/);
 assert.deepEqual(shelfSummary(own,true,2),{real:false,ownedCount:0,coveredCount:0,missingCount:3,savedCount:2});
});
test('workspace statistics separate real shelf from coverage and do not overclaim results',()=>{
 assert.deepEqual(shelfSummary(own,false,1),{real:true,ownedCount:2,coveredCount:2,missingCount:1,savedCount:1});
 assert.deepEqual(shelfSummary([],false,9),{real:false,ownedCount:0,coveredCount:0,missingCount:3,savedCount:6});
});
test('unsupported schema, unexpected fields, invalid price, and duplicate IDs fail closed',()=>{
 const good=makeShelfBackup(prefs);
 for(const wrong of [
  {...good,version:99},
  {...good,format:'some-other-site'},
  {...good,photo:'should never import'},
  {...good,preferences:{...good.preferences,passcode:'bad'}},
  {...good,preferences:{...good.preferences,budget:99999}},
  {...good,shelf:[{...own[0],price:-2}]},
  {...good,shelf:[own[0],own[0]]},
  {...good,shelf:[{...own[0],tags:['x'.repeat(41)]}]}
 ])assert.throws(()=>readShelfBackup(JSON.stringify(wrong)));
});
test('prototype pollution attempts and unexpected product fields are rejected',()=>{
 const good=makeShelfBackup(prefs);
 const bad=JSON.parse(JSON.stringify(good));
 bad.shelf[0]['__proto__']={isAdmin:true}; // assignment may change the prototype, not an own key
 const malicious=JSON.parse(JSON.stringify(good));
 Object.defineProperty(malicious.shelf[0],'__proto__',{value:{polluted:true},enumerable:true});
 assert.throws(()=>readShelfBackup(JSON.stringify(malicious)),/Unsupported product data/);
 const stored=readShelfBackup(JSON.stringify(good));
 assert.equal(({}).polluted,undefined);
 assert.equal(stored.shelf.length,2);
});
test('reject malformed JSON, overlarge payloads and more than 60 inventory items',()=>{
 assert.throws(()=>readShelfBackup('not json'),/valid JSON/);
 assert.throws(()=>readShelfBackup(' '.repeat(SHELF_BACKUP_MAX_BYTES+1)),/64 KB/);
 const good=makeShelfBackup(prefs);
 const tooMany={...good,shelf:Array.from({length:SHELF_LIMIT+1},(_,i)=>({...own[0],id:'prod-'+i}))};
 assert.throws(()=>readShelfBackup(JSON.stringify(tooMany)),/60 products/);
});
test('non-ASCII names preserve human input while limits and duplicates are enforced',()=>{
 const text=JSON.stringify(makeShelfBackup({...prefs,shelf:[{...own[0],name:'Crème douceur 🌿'}]}));
 assert.equal(readShelfBackup(text).shelf[0].name,'Crème douceur 🌿');
 const good=makeShelfBackup({...prefs,shelf:[{...own[0],id:'<img src=x>'}]});
 assert.match(good.shelf[0].id,/^owned-/);
});
test('UI keeps import and export local and exposes real editing/search/undo controls',async()=>{
 const js=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
 for(const fragment of ['function renderWorkspaceHub','id="shelf-search"','id="edit-product"','id="export-shelf"','id="shelf-import"','id="undo-shelf"','window.confirm','readShelfBackup(await file.text())','data-edit','aria-current'])assert.ok(js.includes(fragment),fragment);
 assert.ok(js.includes("state.sampleInventory=false"));
 assert.ok(html.includes('class="skip-link"'));
 assert.ok(css.includes('.workspace-hub-grid')&&css.includes('.shelf-workspace'));
 assert.ok(js.includes('URL.createObjectURL(blob)'));
 assert.ok(!js.includes("fetch('/api/shelf/import'"));
});
