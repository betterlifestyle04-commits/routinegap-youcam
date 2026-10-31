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
 assert.ok((await desktop.locator('.scan-journey').innerText()).includes('You are in control'));
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

 await mobile.locator('#launch-preference-studio').click();
 await shown(mobile,'#preference-overlay:not([hidden])');
 await mobile.locator('[data-pref-action="next"]').click();
 await shown(mobile,'#pref-budget-range');
 await mobile.keyboard.press('Escape');
 assert.equal(await mobile.locator('#preference-overlay').isVisible(),false);


 assert.deepEqual(providerCalls,[],'Tour and Help must never submit a scan');
 assert.deepEqual(errors,[],'No client-side JavaScript exceptions are allowed');
 console.log('Chromium smoke passed: 10-section navigation, 33 FAQs, article search, demo scan, six-stop tour, global search, mobile dock, preference save/cancel, scan recovery/erasure and no paid API calls.');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
