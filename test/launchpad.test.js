import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildRoutinePlan,localRoutineDate} from '../public/routine-planner.js';
import {buildLaunchpad,mobileSelection,MOBILE_TABS,MOBILE_MORE_TABS} from '../public/launchpad.js';
import {WORKSPACE_PAGES} from '../public/workspace-search.js';

const date=new Date(2026,9,31);
const mine=[
 {id:'my-cleanser',name:'My cleanser',step:'cleanser',tags:[],price:20},
 {id:'my-cream',name:'My moisturizer',step:'moisturizer',tags:[],price:17},
 {id:'my-spf',name:'My sunscreen',step:'spf',tags:[],price:25}
];
test('first visit counts zero real products and zero personal categories despite sample shelf entries',()=>{
 const snap=buildLaunchpad({shelf:mine,sampleInventory:true,now:date});
 assert.equal(snap.ownedCount,0);
 assert.equal(snap.coveredCount,0);
 assert.deepEqual(snap.missingSteps,['cleanser','moisturizer','spf']);
 assert.equal(snap.sampleInventory,true);
 assert.equal(snap.priority.go,'shelf');
 assert.equal(snap.checkedToday,0);
 assert.ok(snap.milestones.every(x=>!x.complete));
 assert.match(snap.milestones[0].detail,/not ownership/);
});
test('single real product shows exactly one covered basic category',()=>{
 const snap=buildLaunchpad({shelf:[mine[0]],sampleInventory:false,now:date});
 assert.equal(snap.ownedCount,1);
 assert.equal(snap.coveredCount,1);
 assert.deepEqual(snap.missingSteps,['moisturizer','spf']);
 assert.equal(snap.milestones[0].complete,true);
 assert.equal(snap.milestones[1].complete,false);
 assert.equal(snap.priority.go,'routine');
});
test('full real shelf is not an invented clinical effectiveness result or completed shopping transaction',()=>{
 const snap=buildLaunchpad({shelf:mine,sampleInventory:false,now:date});
 assert.equal(snap.ownedCount,3);
 assert.equal(snap.coveredCount,3);
 assert.equal(snap.milestones[1].complete,true);
 assert.equal(snap.savedCount,0);
 assert.equal(snap.comparedCount,0);
 assert.match(snap.disclosure,/not clinical outcomes/);
 assert.match(snap.disclosure,/purchases/);
});
test('only actual checked local daily tasks count as routine milestone activity',()=>{
 const plan=buildRoutinePlan(mine);
 const key=plan.morning.find(x=>x.available).key;
 const raw=JSON.stringify({date:localRoutineDate(date),done:[key,key,'fake']});
 const snap=buildLaunchpad({shelf:mine,sampleInventory:false,routineLog:raw,now:date});
 assert.equal(snap.checkedToday,1);
 assert.equal(snap.availableToday,5);
 assert.equal(snap.milestones[2].complete,true);
 assert.equal(snap.priority.go,'shop');
 assert.equal(snap.milestones[2].detail,'1 of 5 available daily checks marked');
});
test('stale or fake checklist state never contributes to activity',()=>{
 const old=JSON.stringify({date:'2026-10-30',done:['am-cleanser:my-cleanser']});
 const snap=buildLaunchpad({shelf:mine,sampleInventory:false,routineLog:old,now:date});
 assert.equal(snap.checkedToday,0);
 const sample=buildLaunchpad({shelf:mine,sampleInventory:true,routineLog:old,now:date});
 assert.equal(sample.checkedToday,0);
 assert.equal(sample.availableToday,0);
});
test('saving or comparing illustrative concepts is discovery activity, not evidence of buying',()=>{
 const snap=buildLaunchpad({shelf:mine,sampleInventory:false,savedIds:['id'],compareIds:['different-id'],now:date,scanSource:'sample'});
 assert.equal(snap.savedCount,1);
 assert.equal(snap.comparedCount,1);
 assert.equal(snap.milestones[3].complete,true);
 assert.match(snap.supporting,/illustrative/);
 assert.doesNotMatch(snap.disclosure,/saved purchases/);
});
test('real scan provenance is distinct from a sample view, but a scan remains optional',()=>{
 const a=buildLaunchpad({scanSource:'live',now:date});
 assert.match(a.supporting,/real YouCam/);
 assert.equal(a.priority.id,'shelf');
 const b=buildLaunchpad({scanSource:'sample',now:date});
 assert.match(b.supporting,/illustrative/);
 const c=buildLaunchpad({now:date});
 assert.match(c.supporting,/optional/);
});
test('mobile dock and More menu cover all nine real workspaces without invented pages',()=>{
 assert.equal(MOBILE_TABS.length,4);
 assert.equal(MOBILE_MORE_TABS.length,5);
 const tabs=[...MOBILE_TABS,...MOBILE_MORE_TABS].map(x=>x.id);
 assert.equal(new Set(tabs).size,9);
 assert.deepEqual(new Set(tabs),new Set(WORKSPACE_PAGES.map(x=>x.id)));
 for(const tab of MOBILE_TABS)assert.equal(mobileSelection(tab.id),tab.id);
 for(const tab of MOBILE_MORE_TABS)assert.equal(mobileSelection(tab.id),'more');
 assert.equal(mobileSelection('malicious'),'overview');
});
test('responsive mobile UI is a functioning navigation surface, keyboard-dismissible, not decorative',async()=>{
 const [html,js,css,pkg]=await Promise.all([
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
  readFile(new URL('../package.json',import.meta.url),'utf8')
 ]);
 assert.ok(html.includes('id="mobile-dock"')&&html.includes('aria-label="Mobile quick navigation"'));
 assert.ok(html.includes('id="mobile-more-overlay" hidden')&&html.includes('aria-modal="true"'));
 for(const tab of MOBILE_TABS)assert.ok(html.includes('data-mobile-tab="'+tab.id+'"'),tab.id);
 for(const tab of MOBILE_MORE_TABS)assert.ok(html.includes('data-mobile-tab="'+tab.id+'"'),tab.id);
 for(const part of ['function syncMobileNavigation()','function openMobileMore()','function closeMobileMore(','data-mobile-tab','window.addEventListener(\'resize\'','event.key===\'Escape\'','aria-expanded','mobileSelection(state.tab)','buildLaunchpad({'])assert.ok(js.includes(part),part);
 assert.ok(css.includes('.mobile-dock')&&css.includes('.mobile-more-overlay[hidden]')&&css.includes('@media(max-width:760px)')&&css.includes('safe-area-inset-bottom'));
 assert.ok(pkg.includes('node --check public/launchpad.js'));
});
test('overview no longer suggests purchases saved when there were only fictional catalog classifications',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.ok(app.includes('Covered concepts flagged'));
 assert.ok(app.includes('Rule-based demo labels, not purchases avoided'));
 assert.ok(!app.includes('Duplicate purchases avoided'));
 assert.ok(app.includes('Examples, not items you own'));
});
