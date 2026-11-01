/**
 * End-to-end browser journey for GitHub Actions.
 * Intentionally disables all live YouCam calls and starts with isolated storage.
 * Run after: npm install --no-save playwright@1.56.1 && npx playwright install chromium
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const port=32765;
const base='http://127.0.0.1:'+port;
const root=fileURLToPath(new URL('../',import.meta.url));
const server=spawn(process.execPath,['server.js'],{
 cwd:root,env:{...process.env,PORT:String(port),NODE_ENV:'smoke',
   LIVE_SCANS_ENABLED:'false',YOUCAM_API_KEY:'',DEMO_ACCESS_TOKEN:''},
 stdio:['ignore','pipe','pipe']
});
let serverLog='';
for(const stream of [server.stdout,server.stderr]){
 stream.on('data',chunk=>{serverLog+=(chunk.toString()).slice(0,2000);});
}
let browser;
const errors=[];
const providerCalls=[];
async function ready(){
 for(let i=0;i<60;i++){
  if(server.exitCode!==null)throw new Error('App exited unexpectedly: '+serverLog);
  try{const r=await fetch(base+'/api/status');if(r.ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw new Error('App never became ready: '+serverLog);
}
function monitor(page){
 page.on('pageerror',err=>errors.push(err.message));
 page.on('request',request=>{
  if(request.method()==='POST'&&new URL(request.url()).pathname.startsWith('/api/scan'))providerCalls.push(request.url());
 });
}
async function shown(page,selector){
 const loc=page.locator(selector).first();
 await loc.waitFor({state:'visible',timeout:10000});
 return loc;
}
try{
 await ready();
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const desktop=await browser.newPage({viewport:{width:1366,height:950},locale:'en-US'});
 monitor(desktop);
 await desktop.goto(base+'/#/overview',{waitUntil:'networkidle'});
 await shown(desktop,'#view-overview:not(.hidden) .hero');
 assert.equal(await desktop.locator('#navigation .nav-link').count(),10);
 await desktop.locator('#global-help').click();
 await shown(desktop,'#view-help:not(.hidden) .help-hero');
 assert.equal(await desktop.locator('#help-results .help-article').count(),33);
 await desktop.locator('#help-search').fill('passcode');
 await shown(desktop,'#help-article-passcode');
 await desktop.locator('#help-article-passcode summary').click();
 await shown(desktop,'#help-article-passcode .help-article-body');
 await desktop.locator('#help-article-passcode [data-go="scan"]').click();
 await shown(desktop,'#view-scan:not(.hidden) #photo-readiness-panel');
 await desktop.locator('#sample-report').click();
 await shown(desktop,'#view-scan:not(.hidden) .report-card');
 assert.ok((await desktop.locator('#view-scan').innerText()).includes('ILLUSTRATIVE SAMPLE'));

 await desktop.locator('#global-product-tour').click();
 await shown(desktop,'#product-tour-panel:not([hidden])');
 const route=['scan','shelf','routine','shop','compare','trail'];
 for(let i=1;i<route.length;i++){
  await desktop.locator('#product-tour-panel [data-tour-move="next"]').click();
  await shown(desktop,'#view-'+route[i]+':not(.hidden)');
  assert.equal(new URL(desktop.url()).hash,'#/'+route[i]);
 }
 await desktop.locator('#product-tour-panel [data-tour-move="finish"]').click();
 await shown(desktop,'#view-overview:not(.hidden)');
 assert.equal(await desktop.locator('#product-tour-panel').isVisible(),false);

 await desktop.keyboard.press('Control+k');
 await shown(desktop,'#workspace-search-overlay:not([hidden])');
 await desktop.locator('#command-search-input').fill('How do I remove browser-local');
 const result=await shown(desktop,'#command-results [data-command-index]');
 await result.first().click();
 await shown(desktop,'#view-help:not(.hidden) #help-article-erase[open]');
 assert.equal(new URL(desktop.url()).hash,'#/help');

 // Preference Studio: confirm that Cancel preserves stored settings and Save updates them.
 await desktop.goto(base+'/#/overview',{waitUntil:'networkidle'});
 const priorSettings=await desktop.evaluate(()=>localStorage.getItem('routinegap_state'));
 await desktop.locator('#launch-preference-studio').click();
 await shown(desktop,'#preference-overlay:not([hidden]) #preference-title');
 await desktop.locator('[data-pref-goal="oiliness"]').click();
 await desktop.locator('[data-pref-action="next"]').click();
 await desktop.locator('[data-pref-budget="75"]').click();
 await desktop.locator('[data-pref-action="next"]').click();
 await shown(desktop,'#pref-fragrance');
 await desktop.locator('#pref-fragrance').check();
 await desktop.keyboard.press('Escape');
 assert.equal(await desktop.locator('#preference-overlay').isVisible(),false);
 assert.equal(await desktop.evaluate(()=>localStorage.getItem('routinegap_state')),priorSettings,'Canceled preference changes must not persist');
 await desktop.locator('#launch-preference-studio').click();
 await desktop.locator('[data-pref-goal="texture"]').click();
 await desktop.locator('[data-pref-action="next"]').click();
 await desktop.locator('[data-pref-budget="75"]').click();
 await desktop.locator('[data-pref-action="next"]').click();
 await desktop.locator('#pref-fragrance').check();
 await desktop.locator('[data-pref-action="apply"]').click();
 const settings=await desktop.evaluate(()=>JSON.parse(localStorage.getItem('routinegap_state')));
 assert.equal(settings.goal,'texture');
 assert.equal(settings.budget,75);
 assert.equal(settings.fragranceFree,true);
 assert.equal(await desktop.locator('#preference-overlay').isVisible(),false);
 await desktop.locator('#navigation [data-tab="shop"]').click();
 await shown(desktop,'#view-shop:not(.hidden) #goal');
 assert.equal(await desktop.locator('#goal').inputValue(),'texture');
 assert.equal(await desktop.locator('#budget').inputValue(),'75');
 assert.equal(await desktop.locator('#fragrance').isChecked(),true);

 // Recovery Center: verify the receipt-free marker is visible, blocks resubmission
 // and can be erased through the existing privacy group (no real provider calls).
 await desktop.goto(base+'/#/scan',{waitUntil:'networkidle'});
 await shown(desktop,'#view-scan:not(.hidden) .scan-journey');
 assert.ok((await desktop.locator('.scan-journey').innerText()).includes('LIVE SCAN JOURNEY'));
 await desktop.evaluate(()=>sessionStorage.setItem('routinegap_uncertain_scan_v1',JSON.stringify({kind:'submission-unknown',createdAt:Date.now()})));
 await desktop.reload({waitUntil:'networkidle'});
 await shown(desktop,'#scan-uncertain-clear');
 assert.equal(await desktop.locator('#live-scan').isDisabled(),true);
 assert.equal(await desktop.evaluate(()=>sessionStorage.getItem('routinegap_uncertain_scan_v1')!==null),true);
 await desktop.locator('#navigation [data-tab="privacy"]').click();
 await shown(desktop,'#view-privacy:not(.hidden) [data-privacy-erase="pending"]');
 desktop.once('dialog',dialog=>dialog.accept());
 await desktop.locator('[data-privacy-erase="pending"]').click();
 await shown(desktop,'#view-privacy:not(.hidden)');
 assert.equal(await desktop.evaluate(()=>sessionStorage.getItem('routinegap_uncertain_scan_v1')),null);
 await desktop.goto(base+'/#/overview',{waitUntil:'networkidle'});
 await mkdir('artifacts/browser',{recursive:true});
 await desktop.screenshot({path:'artifacts/browser/desktop-overview.png',fullPage:true});
 await desktop.goto(base+'/#/scan',{waitUntil:'networkidle'});
 await desktop.screenshot({path:'artifacts/browser/desktop-scan-journey.png',fullPage:true});
 
 // Isolated synthetic photo + intercepted API responses: this exercises the paid
 // request UI path without transmitting any photo or using real YouCam credits.
 async function fakePhoto(page,{ownerCode=true}={}){
  const image=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');
   canvas.width=720;canvas.height=960;
   const ctx=canvas.getContext('2d');
   for(let y=0;y<960;y+=6){ctx.fillStyle='rgb('+(y%217)+','+((y*3)%241)+',155)';ctx.fillRect(0,y,720,6);}
   for(let x=0;x<720;x+=15){ctx.fillStyle='rgba(20,45,100,.15)';ctx.fillRect(x,0,4,960);}
   return canvas.toDataURL('image/png').split(',')[1];
  });
  const bytes=Buffer.from(image,'base64');
  assert.ok(bytes.length>1500);
  await page.locator('#photo-file').setInputFiles({name:'generated-test-pattern.png',mimeType:'image/png',buffer:bytes});
  await shown(page,'#photo-readiness-panel .readiness-pill.ready');
  await page.locator('#consent').check();
  if(ownerCode){await page.locator('.owner-access-details summary').click();await page.locator('#demo-passcode').fill('mock-passcode-not-real');}
  await page.locator('#live-scan').waitFor({state:'visible'});
  assert.equal(await page.locator('#live-scan').isDisabled(),false);
 }
 async function mockStatus(page,{guest=false}={}){
  await page.route('**/api/status',route=>route.fulfill({
   status:200,contentType:'application/json',body:JSON.stringify({liveEnabled:true,providerConnection:'authenticated',guestEnabled:guest,guestRemaining:guest?3:0})
  }));
 }
 const judge=await browser.newPage({viewport:{width:1180,height:860}});
 const judgeErrors=[];judge.on('pageerror',e=>judgeErrors.push(e.message));
 await mockStatus(judge,{guest:true});
 let judgeSubmits=0,judgePolled=0,judgeCode='';
 await judge.route('**/api/scan',route=>{
  judgeSubmits++;judgeCode=route.request().headers()['x-demo-access']||'';
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:'running',receipt:'judge-mock-only-receipt'})});
 });
 await judge.route('**/api/scan/status',route=>{
  judgePolled++;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:'success',
   signals:[{type:'pore',uiScore:67,rawScore:50},{type:'moisture',uiScore:72,rawScore:45}]})});
 });
 await judge.goto(base+'/#/scan',{waitUntil:'networkidle'});
 await shown(judge,'.judge-access-panel');
 assert.ok((await judge.locator('.judge-access-panel').innerText()).includes('No passcode needed'));
 await fakePhoto(judge,{ownerCode:false});
 assert.equal(await judge.locator('.owner-access-details[open]').count(),0);
 await judge.locator('#live-scan').click();
 await shown(judge,'#view-scan:not(.hidden) .scan-journey-chip.success');
 assert.equal(judgeCode,'','judge test must not send the private owner secret');
 assert.equal(judgeSubmits,1);
 assert.equal(judgePolled,1);
 assert.ok((await judge.locator('#view-scan').innerText()).includes('REAL YOUCAM RESULT'));
 assert.deepEqual(judgeErrors,[]);
 await judge.close();
 const uncertain=await browser.newPage({viewport:{width:1180,height:860}});
 const uncertainErrors=[];
 uncertain.on('pageerror',e=>uncertainErrors.push(e.message));
 await mockStatus(uncertain);
 let uncertainPosts=0;
 await uncertain.route('**/api/scan',route=>{
  uncertainPosts++;
  return route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'Simulated upstream interruption; unknown provider task state.'})});
 });
 await uncertain.goto(base+'/#/scan',{waitUntil:'networkidle'});
 await fakePhoto(uncertain);
 await uncertain.locator('#live-scan').click();
 await shown(uncertain,'#scan-uncertain-clear');
 assert.equal(uncertainPosts,1);
 assert.equal(await uncertain.locator('#live-scan').isDisabled(),true);
 await uncertain.reload({waitUntil:'networkidle'});
 await shown(uncertain,'#scan-uncertain-clear');
 assert.equal(await uncertain.locator('#live-scan').isDisabled(),true);
 assert.deepEqual(uncertainErrors,[]);
 await uncertain.close();

 const completed=await browser.newPage({viewport:{width:1180,height:860}});
 const completedErrors=[];
 completed.on('pageerror',e=>completedErrors.push(e.message));
 await mockStatus(completed);
 let started=0,polled=0;
 await completed.route('**/api/scan',route=>{
  started++;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:'running',receipt:'mock-test-only-receipt'})});
 });
 await completed.route('**/api/scan/status',route=>{
  polled++;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:'success',
   signals:[{type:'moisture',uiScore:71,rawScore:54}]})});
 });
 await completed.goto(base+'/#/scan',{waitUntil:'networkidle'});
 await fakePhoto(completed);
 await completed.locator('#live-scan').click();
 await shown(completed,'#view-scan:not(.hidden) .scan-journey-chip.success');
 assert.equal(started,1,'Only one mocked task submission should occur');
 assert.equal(polled,1,'The existing task was checked using its receipt');
 assert.equal(await completed.locator('#scan-uncertain-clear').count(),0);
 assert.ok((await completed.locator('#view-scan').innerText()).includes('REAL YOUCAM RESULT'));
 assert.deepEqual(completedErrors,[]);
 await completed.close();

 // Scenario Lab: four fictional cases share the actual recommendation rules
 // without changing a visitor's owned shelf, preferences or demo cart.
 await desktop.goto(base+'/#/insights',{waitUntil:'networkidle'});
 await shown(desktop,'#scenario-lab .scenario-case-grid');
 const priorStorage=await desktop.evaluate(()=>({
  local:Object.fromEntries(Object.entries(localStorage).sort()),
  session:Object.fromEntries(Object.entries(sessionStorage).sort())
 }));
 assert.equal(await desktop.locator('[data-scenario-case]').count(),4);
 await desktop.locator('[data-scenario-case="fully-covered"]').click();
 await shown(desktop,'#scenario-choice-fully-covered[aria-pressed="true"]');
 assert.ok((await desktop.locator('.scenario-comparison-pane.after').innerText()).includes('No essential concept selected'));
 await desktop.locator('[data-scenario-case="missing-spf"]').click();
 await shown(desktop,'#scenario-choice-missing-spf[aria-pressed="true"]');
 assert.ok((await desktop.locator('.scenario-comparison-pane.after').innerText()).includes('Daily SPF'));
 await desktop.locator('[data-scenario-case-budget="25"]').click();
 await shown(desktop,'#scenario-budget-25[aria-pressed="true"]');
 await desktop.locator('[data-scenario-case-budget="100"]').click();
 await shown(desktop,'#scenario-budget-100[aria-pressed="true"]');
 const [caseNotes]=await Promise.all([
  desktop.waitForEvent('download'),
  desktop.locator('#scenario-case-export').click()
 ]);
 assert.ok(caseNotes.suggestedFilename().startsWith('routinegap-fictional-case-'));
 const afterStorage=await desktop.evaluate(()=>({
  local:Object.fromEntries(Object.entries(localStorage).sort()),
  session:Object.fromEntries(Object.entries(sessionStorage).sort())
 }));
 assert.deepEqual(afterStorage,priorStorage,'Scenario Lab must not alter actual customer browser data');
 await desktop.screenshot({path:'artifacts/browser/desktop-scenario-lab.png',fullPage:true});
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 monitor(mobile);
 await mobile.goto(base+'/#/overview',{waitUntil:'networkidle'});
 await shown(mobile,'#mobile-dock');
 await mobile.locator('#mobile-more-trigger').click();
 await shown(mobile,'#mobile-more-overlay:not([hidden])');
 await mobile.locator('#mobile-more-dialog [data-mobile-tab="help"]').click();
 await shown(mobile,'#view-help:not(.hidden) .help-hero');
 assert.equal(await mobile.locator('#mobile-more-overlay').isVisible(),false);
 await mobile.locator('#mobile-dock [data-mobile-tab="scan"]').click();
 await shown(mobile,'#view-scan:not(.hidden) #photo-readiness-panel');
 await mobile.locator('#mobile-more-trigger').click();
 await shown(mobile,'#mobile-more-dialog');
 await mobile.keyboard.press('Escape');
 assert.equal(await mobile.locator('#mobile-more-overlay').isVisible(),false);
 await mobile.locator('#mobile-dock [data-mobile-tab="overview"]').click();
 await shown(mobile,'#view-overview:not(.hidden)');
 await mobile.screenshot({path:'artifacts/browser/mobile-overview.png',fullPage:true});
 await mobile.goto(base+'/#/insights',{waitUntil:'networkidle'});
 await shown(mobile,'#scenario-lab .scenario-case-grid');
 await mobile.locator('[data-scenario-case="tag-preference"]').click();
 await shown(mobile,'#scenario-choice-tag-preference[aria-pressed="true"]');
 await mobile.screenshot({path:'artifacts/browser/mobile-scenario-lab.png',fullPage:true});
 await mobile.goto(base+'/#/overview',{waitUntil:'networkidle'});
 await shown(mobile,'#view-overview:not(.hidden) #launch-preference-studio');


 await mobile.locator('#launch-preference-studio').click();
 await shown(mobile,'#preference-overlay:not([hidden])');
 await mobile.locator('[data-pref-action="next"]').click();
 await shown(mobile,'#pref-budget-range');
 await mobile.keyboard.press('Escape');
 assert.equal(await mobile.locator('#preference-overlay').isVisible(),false);


 assert.deepEqual(providerCalls,[],'Tour and Help must never submit a scan');
 assert.deepEqual(errors,[],'No client-side JavaScript exceptions are allowed');
 console.log('Chromium smoke passed: 10-section navigation, 33 FAQs, article search, demo scan, six-stop tour, global search, mobile dock, preference save/cancel, scan recovery/erasure, intercepted synthetic task success/failure, four-case Scenario Lab, immutable local data and a public judge flow with no passcode and no paid provider calls.');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
