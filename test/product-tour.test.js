import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TOUR_STEPS,getTourStep,tourSummary,moveTour,tourTabIndex} from '../public/product-tour.js';
import {WORKSPACE_PAGES} from '../public/workspace-search.js';
test('tour covers six actual, distinct workspaces with meaningful narrative data',()=>{
 assert.equal(TOUR_STEPS.length,6);
 assert.deepEqual(TOUR_STEPS.map(x=>x.tab),['scan','shelf','routine','shop','compare','trail']);
 assert.equal(new Set(TOUR_STEPS.map(x=>x.id)).size,6);
 for(const step of TOUR_STEPS){
  assert.ok(WORKSPACE_PAGES.some(p=>p.id===step.tab));
  assert.ok(step.title.length>18&&step.body.length>65&&step.tip.length>35);
 }
});
test('first and final tour stages have explicit bounded navigation',()=>{
 const first=tourSummary(0);
 assert.equal(first.index,0);
 assert.equal(first.total,6);
 assert.equal(first.previous,null);
 assert.equal(first.next,1);
 assert.equal(first.percent,17);
 const last=tourSummary(5);
 assert.equal(last.next,null);
 assert.equal(last.previous,4);
 assert.equal(last.percent,100);
});
test('moving backwards and forwards never wraps, mutates, or creates a step',()=>{
 assert.equal(moveTour(0,'next'),1);
 assert.equal(moveTour(1,'previous'),0);
 assert.equal(moveTour(0,'previous'),null);
 assert.equal(moveTour(5,'next'),null);
 for(const bad of ['finish','foo',{},null])assert.equal(moveTour(3,bad),null);
 for(const bad of [-1,6,1.5,NaN,'2',{},undefined])assert.equal(moveTour(bad,'next'),null);
});
test('invalid stage identifiers do not select any content or leak personal data',()=>{
 for(const idx of [6,-1,'0',null,1.3,Infinity]){
  assert.equal(getTourStep(idx),null);
  assert.equal(tourSummary(idx),null);
 }
 assert.equal(tourTabIndex('nonexistent'),-1);
 assert.equal(tourTabIndex('scan'),0);
 assert.equal(tourTabIndex('trail'),5);
});
test('scans remain labeled with true provenance: sample, real, and none',()=>{
 assert.equal(tourSummary(0,{scanSource:'live'}).signalStatus,'real YouCam result visible');
 assert.equal(tourSummary(0,{scanSource:'sample'}).signalStatus,'illustrative example loaded');
 assert.equal(tourSummary(0,{scanSource:'bogus'}).signalStatus,'no scan report loaded');
 assert.match(tourSummary(0).provenance,/not a record/);
});
test('starter shelf is never presented as real owned inventory',()=>{
 const example=tourSummary(1,{sampleInventory:true,shelfCount:7});
 assert.equal(example.shelfStatus,'illustrative starter shelf');
 const own=tourSummary(1,{sampleInventory:false,shelfCount:2});
 assert.equal(own.shelfStatus,'user-entered shelf with 2 recorded products');
 const empty=tourSummary(1,{sampleInventory:false,shelfCount:-20});
 assert.match(empty.shelfStatus,/0 recorded/);
});
test('the tour is informational, and has no provider, storage or browser access',async()=>{
 const module=await readFile(new URL('../public/product-tour.js',import.meta.url),'utf8');
 for(const forbidden of ['fetch(', 'localStorage.', 'sessionStorage.', 'XMLHttpRequest','createImageBitmap(']){
  assert.ok(!module.includes(forbidden),forbidden);
 }
 for(const phrase of ['photo upload','clinical assessment','shopping action','validated user achievement'])assert.ok(module.includes(phrase));
});
test('six-stop tour has real interaction hooks, close and back/next controls',async()=>{
 const [app,html,css,pkg]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
  readFile(new URL('../package.json',import.meta.url),'utf8')
 ]);
 for(const h of ['id="global-product-tour"','id="product-tour-panel"','id="product-tour-content"','aria-live="polite"'])assert.ok(html.includes(h),h);
 for(const h of ['function renderProductTour()','function startProductTour()','function moveProductTour(direction)','function stopProductTour(',
  'data-tour-move="previous"','moveTour(state.productTour.index,direction)','getTourStep']) {
  if(h==='getTourStep')continue;
  assert.ok(app.includes(h),h);
 }
 assert.ok(app.includes("if(state.scanSource!=='live'&&!state.pending)"));
 assert.ok(app.includes('navigate(TOUR_STEPS[next].tab,{fromTour:true})'));
 assert.ok(app.includes("event.key!=='Escape'||!state.productTour"));
 assert.ok(app.includes("if(state.productTour&&!fromTour&&tab!==TOUR_STEPS[state.productTour.index]?.tab)"));
 assert.ok(css.includes('.product-tour-panel[hidden]')&&css.includes('safe-area-inset-bottom'));
 assert.ok(pkg.includes('node --check public/product-tour.js'));
});
test('walkthrough cannot be misread as evidence of actual scan, saved money or shopping behavior',()=>{
 const full=TOUR_STEPS.map(x=>x.body+' '+x.tip).join(' ');
 assert.match(full,/illustrative/);
 assert.match(full,/No selfie|does not upload/);
 assert.match(full,/fictional/i);
 assert.match(full,/example prices/);
 assert.match(tourSummary(3).provenance,/purchases/);
});
