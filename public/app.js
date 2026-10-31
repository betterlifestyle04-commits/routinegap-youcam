import {catalog,goals,stepLabels,sampleShelf,sampleScan,normalizeShelf,evaluateShop} from '/recommendations.js';
import {ROUTINE_LOG_KEY,localRoutineDate,buildRoutinePlan,readRoutineLog,toggleRoutineStep,routineProgress} from '/routine-planner.js';
import {SAVED_CONCEPTS_KEY,MAX_SAVED_CONCEPTS,FILTER_STEPS,FILTER_DECISIONS,SORT_OPTIONS,normalizeSavedConcepts,toggleSavedConcept,discoverConcepts} from '/catalog-discovery.js';
import {makeShelfBackup,readShelfBackup,SHELF_BACKUP_MAX_BYTES,SHELF_LIMIT,shelfSummary} from '/shelf-transfer.js';
import {BASIC_STEPS,ALL_STEPS,makeInsights,evaluateBudgetScenario} from '/insights.js';
import {COMPARE_KEY,MAX_COMPARE,COMPARE_FILTER_STEPS,normalizeCompareIds,toggleCompareId,buildComparison,filterComparisonCandidates} from '/comparison.js';
import {WORKSPACE_PAGES,parseWorkspaceHash,workspaceHash,searchWorkspace} from '/workspace-search.js';
import {DATA_GROUPS,ERASE_CATEGORIES,describeDataState,readStoragePresence,eraseOwnedStorage} from '/data-center.js';
import {buildConceptStory} from '/concept-story.js';
import {planLocalPhoto,preparePhotoLocally,PHOTO_SOURCE_MAX_BYTES} from '/photo-tools.js';
import {SELF_CHECKS,toggleSelfCheck,photoReadiness} from '/photo-readiness.js';
import {createDecisionBrief} from '/report-export.js';
import {makePrivateReport,readPrivateReport,LIVE_REPORT_SESSION_KEY} from '/report-session.js';
const $=selector=>document.querySelector(selector);
const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=v=>'$'+Number(v||0).toFixed(0);
const PENDING_SCAN_KEY='routinegap_pending_scan_v1';
const savedLiveReport=(()=>{
  try{
    const raw=sessionStorage.getItem(LIVE_REPORT_SESSION_KEY);
    if(!raw)return null;
    const saved=readPrivateReport(raw);
    if(!saved)sessionStorage.removeItem(LIVE_REPORT_SESSION_KEY);
    return saved;
  }catch{return null;}
})();
function readPendingScan(){
  try{
    const pending=JSON.parse(sessionStorage.getItem(PENDING_SCAN_KEY)||'null');
    if(pending&&typeof pending.receipt==='string'&&pending.receipt.length<=600&&
       Number.isFinite(pending.createdAt)&&pending.createdAt<=Date.now()&&
       Date.now()-pending.createdAt<24*60*60*1000)return pending;
    sessionStorage.removeItem(PENDING_SCAN_KEY);
  }catch{}
  return null;
}
function savePendingScan(pending){
  state.pending=pending;
  try{if(pending)sessionStorage.setItem(PENDING_SCAN_KEY,JSON.stringify(pending));
      else sessionStorage.removeItem(PENDING_SCAN_KEY);}catch{}
}
const state={photoSelfChecks:{},storyId:null,tab:parseWorkspaceHash(window.location.hash)||'overview',globalSearchQuery:'',compareIds:(()=>{try{return normalizeCompareIds(localStorage.getItem(COMPARE_KEY),catalog);}catch{return [];}})(),compareQuery:'',compareStep:'all',insightBudget:null,shelfQuery:'',editingId:null,undoShelf:null,savedIds:(()=>{try{return normalizeSavedConcepts(localStorage.getItem(SAVED_CONCEPTS_KEY),catalog);}catch{return [];}})(),catalogQuery:'',catalogStep:'all',catalogDecision:'all',catalogSort:'recommended',savedOnly:false,affordableOnly:false,routineLog:(()=>{try{return localStorage.getItem(ROUTINE_LOG_KEY);}catch{return null;}})(),shelf:sampleShelf.map(x=>({...x})),budget:60,goal:'moisture',fragranceFree:false,sampleInventory:true,scan:savedLiveReport?.signals||null,scanSource:savedLiveReport?'live':null,savedLiveReport:!!savedLiveReport,cartIds:[],file:null,sourceFile:null,preview:null,imageReady:false,imageDimensions:null,canPrepare:false,preparing:false,photoPlan:null,consent:false,code:'',liveEnabled:false,providerConnection:'disabled',pending:readPendingScan(),busy:false,feedback:'',isError:false,goalFromScan:null};
try{const saved=JSON.parse(localStorage.getItem('routinegap_state')||'null');if(saved&&typeof saved==='object'){
  state.shelf=normalizeShelf(saved.shelf);state.budget=Number.isFinite(saved.budget)?Math.max(0,Math.min(1000,saved.budget)):60;state.goal=goals.some(g=>g.id===saved.goal)?saved.goal:'moisture';state.fragranceFree=saved.fragranceFree===true;state.sampleInventory=saved.sampleInventory===true;
}}catch{}
function persist(){try{localStorage.setItem('routinegap_state',JSON.stringify({shelf:state.shelf,budget:state.budget,goal:state.goal,fragranceFree:state.fragranceFree,sampleInventory:state.sampleInventory}));}catch{}}
const decide=()=>evaluateShop({shelf:state.shelf,budget:state.budget,goal:state.goal,fragranceFree:state.fragranceFree});
function notice(msg,error=false){state.feedback=msg;state.isError=error;drawMessage();}
function drawMessage(){const html=state.feedback?`<div class="notice ${state.isError?'error':''}" role="status">${escape(state.feedback)}</div>`:'';const el=$('#message');if(el)el.innerHTML=html;const local=$('#scan-status');if(local)local.innerHTML=state.tab==='scan'?html:'';}
const markMode=()=>state.scanSource==='live'?'<span class="label-pill">REAL YOUCAM RESULT</span>':state.scanSource==='sample'?'<span class="label-pill peach">ILLUSTRATIVE SAMPLE • NOT YOUCAM</span>':'<span class="label-pill peach">NO SCAN YET</span>';
function navigate(tab,{push=true,focus=true}={}){
  if(!WORKSPACE_PAGES.some(p=>p.id===tab))return;
  if(push&&window.location.hash!==workspaceHash(tab))window.history.pushState({tab},'',workspaceHash(tab));
  if(state.storyId&&tab!=='shop')closeConceptStory({restoreFocus:false});
  state.tab=tab;
  render();
  window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  if(focus)$('#main')?.focus({preventScroll:true});
}
function syncWorkspaceLocation(){
  const tab=parseWorkspaceHash(window.location.hash);
  // #main is the keyboard skip link, not a navigation destination.
  if((tab||window.location.hash==='')&&(tab||'overview')!==state.tab)navigate(tab||'overview',{push:false,focus:true});
}
window.addEventListener('popstate',syncWorkspaceLocation);
window.addEventListener('hashchange',syncWorkspaceLocation);
function render(){document.querySelectorAll('.view').forEach(el=>el.classList.toggle('hidden',el.id!==`view-${state.tab}`));document.querySelectorAll('.nav-link').forEach(el=>{const active=el.dataset.tab===state.tab;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});$('#crumb-page').textContent=({overview:'Overview',scan:'Skin analysis',shelf:'My shelf',routine:'Routine planner',insights:'My insights',shop:'Shopping studio',compare:'Compare lab',trail:'Decision trail',privacy:'Privacy & data'})[state.tab];
  const d=decide();const titles={overview:renderOverview,scan:renderScan,shelf:renderShelf,routine:renderRoutine,insights:renderInsights,shop:renderShop,compare:renderCompare,trail:renderTrail,privacy:renderPrivacy};titles[state.tab](d);drawMessage();$('#provider-chip').textContent=state.liveEnabled?'● YouCam API key authenticated':state.providerConnection==='failed'?'● YouCam authentication failed':state.providerConnection==='checking'?'● Checking YouCam credentials':'● Sample mode available';
}
const title=(eyebrow,h1,subtitle)=>`<div class="page-heading"><div class="eyebrow">${eyebrow}</div><h1>${h1}</h1><p>${subtitle}</p></div>`;
function renderWorkspaceHub(d) {
  const snap=shelfSummary(d.owned,state.sampleInventory,state.savedIds.length);
  const cards=[
    {step:'01',name:'Make your shelf yours',hint:snap.real?snap.ownedCount+' real items saved on this device':'Starter products are illustrative until you add your own',go:'shelf',cta:snap.real?'Manage inventory':'Add real products',done:snap.real},
    {step:'02',name:'Understand routine coverage',hint:snap.real?snap.coveredCount+' of 3 basic steps represented · '+snap.missingCount+' gaps to review':'Explore an example morning/evening planner before setup',go:'routine',cta:'Open daily planner',done:snap.real&&snap.coveredCount===3},
    {step:'03',name:'Compare before spending',hint:snap.savedCount?snap.savedCount+' saved concepts, not purchased':'Explore examples and save concepts privately',go:'shop',cta:'Browse concepts',done:snap.savedCount>0}
  ];
  return `<section class="workspace-hub" aria-label="Getting started with RoutineGap">
    <div class="workspace-hub-heading"><div><div class="eyebrow">YOUR WORKSPACE · GET STARTED</div><h2>Everything you need, in one place.</h2>
    <p>Start with your actual products, see which routine steps they cover, and explore options only if you want to. This workspace works without an account or skin scan.</p></div>
    <span class="workspace-setup-chip">${snap.real?'PERSONAL SHELF ACTIVE':'ILLUSTRATIVE PREVIEW'}</span></div>
    <div class="workspace-hub-grid">${cards.map(c=>`<button type="button" class="workspace-hub-card" data-go="${c.go}"><span class="workspace-step-num">${c.step} ${c.done?'<span aria-label="Ready">✓</span>':''}</span>
      <strong>${escape(c.name)}</strong><small>${escape(c.hint)}</small><em>${escape(c.cta)} →</em></button>`).join('')}</div>
    <p class="workspace-data-note">Your product list, preferences, and saved concepts stay in this browser. Sample inventory does not count as real ownership. A YouCam scan is optional and requires separate explicit consent.</p>
  </section>`;
}
function renderOverview(d){const selectedCart=d.rows.filter(x=>state.cartIds.includes(x.id));const selectedTotal=selectedCart.reduce((sum,item)=>sum+item.price,0);$('#view-overview').innerHTML=`<div class="hero"><div class="page-kicker"><span class="dot"></span><span class="eyebrow" style="color:#d9e9ca">THE SMARTER SKINCARE EDIT</span></div><h1>Your shelf first.<br><em>Shop smarter.</em></h1><p>Your next best skincare purchase might be one you don't need. Understand your cosmetic skin signals, see what you already have, and spend with intention.</p><button class="primary" data-go="scan">Start my skin-aware session →</button><div class="hero-art" aria-hidden="true"></div><div class="hero-orbit" aria-hidden="true"></div></div>
<div class="stats"><div class="stat"><span>Products on your shelf</span><strong>${d.owned.length}</strong><small>${state.sampleInventory?'Illustrative sample inventory':'Your saved local inventory'}</small></div><div class="stat"><span>Your selected demo cart</span><strong>${money(selectedTotal)}</strong><small>${selectedTotal>d.budget?'Over budget by '+money(selectedTotal-d.budget):state.cartIds.length?'Within '+money(d.budget)+' budget':'No selections yet · Suggested '+money(d.cartTotal)}</small></div><div class="stat"><span>Duplicate purchases avoided</span><strong>${d.skippedRedundant}</strong><small>Illustrative catalog options screened</small></div></div>
${renderWorkspaceHub(d)}
<section class="demo-journey" aria-label="Guided RoutineGap walkthrough">
  <div class="demo-journey-lead"><div><div class="eyebrow">THE 60-SECOND JUDGE WALKTHROUGH</div>
    <h2>See the full decision journey</h2><p>Explore a labeled example without uploading a face photo, entering a passcode, or using YouCam API credits. The demo is not evidence of a completed live scan.</p>
    <button type="button" class="primary" id="guided-demo" ${state.busy?'disabled':''}>Start illustrative walkthrough →</button>
  </div><div class="demo-journey-mark" aria-hidden="true">01 / 04</div></div>
  <div class="demo-journey-steps">
    <button type="button" id="demo-step-scan" ${state.busy?'disabled':''}><b>01</b><strong>Inspect example signals</strong><span>Clearly labeled synthetic values</span></button>
    <button type="button" data-go="shelf"><b>02</b><strong>Audit your shelf</strong><span>Identify steps you already own</span></button>
    <button type="button" data-go="shop"><b>03</b><strong>Review smart spending</strong><span>Consider budget and duplicates</span></button>
    <button type="button" data-go="trail"><b>04</b><strong>Export the reasoning</strong><span>Save a private decision brief</span></button>
  </div>
</section>
<div class="insights-overview-card"><div><div class="eyebrow">NEW · YOUR INSIGHTS</div><h2>See your routine and spending picture.</h2><p>Understand your basic step coverage, the price of products you recorded, and how different demo budgets change your suggested plan.</p></div><button class="secondary" data-go="insights">Explore my insights →</button></div>
<div class="privacy-overview-bridge"><div><div class="eyebrow">PRIVACY · UNDER YOUR CONTROL</div><h2>Know what your browser remembers.</h2><p>Review stored data, export your shelf and clear records you no longer need.</p></div><button class="secondary" data-go="privacy">Open Privacy & Data →</button></div>
<div class="routine-overview-callout"><div><div class="eyebrow">NEW · DAILY ROUTINE PLANNER</div><h2>From your shelf to your everyday routine.</h2><p>Make a morning and evening checklist from what you own. Only your own checkmarks count, not illustrative sample items.</p></div><button class="primary" data-go="routine">Open routine planner →</button></div>
<div class="section-title"><h2>Today's smart decisions</h2><button class="tiny-btn" data-go="shop">Open shopping studio ↗</button></div><div class="two-col"><div class="panel"><div class="eyebrow">SHELF AUDIT</div><h3 style="margin-top:9px">${d.missingSteps.length?'Room for a smarter routine':'Your essentials are covered'}</h3><p class="muted">${escape(d.message)} We start with what you own, before recommending anything to buy.</p>${['cleanser','moisturizer','spf'].map(s=>`<div class="list-row"><span>${escape(stepLabels[s])}</span><span class="label-pill ${d.owned.some(x=>x.step===s)?'':'peach'}">${d.owned.some(x=>x.step===s)?'IN YOUR SHELF':'POTENTIAL GAP'}</span></div>`).join('')}<div class="panel-actions"><button class="secondary" data-go="shelf">Review my shelf →</button></div></div><div class="panel"><div class="eyebrow">WHY IT MATTERS</div><h3 style="margin-top:9px">Clarity before checkout</h3><p class="muted">Connect a real YouCam Skin Analysis session to review cosmetic observations, or preview the workflow with clearly labeled example data.</p><div class="list-row"><span>Skin analysis</span>${markMode()}</div><div class="list-row"><span>Live provider configuration</span><span class="label-pill ${state.liveEnabled?'':'peach'}">${state.liveEnabled?'KEY AUTHENTICATED':state.providerConnection==='failed'?'AUTHENTICATION FAILED':state.providerConnection==='checking'?'CHECKING API KEY':'NOT CONNECTED'}</span></div><div class="list-row"><span>Recommendation logic</span><span class="label-pill">TRANSPARENT RULES</span></div><div class="panel-actions"><button class="secondary" data-go="scan">View skin studio →</button></div></div></div>`;}
function renderLiveReportSaveControls(reports){
  if(state.scanSource!=='live'||!reports.length)return '';
  const action=state.savedLiveReport
    ?'<span class="label-pill">SAVED IN THIS TAB</span><button type="button" id="forget-live-report" class="ghost">Forget saved report</button>'
    :'<button type="button" id="save-live-report" class="secondary">Save report in this tab →</button>';
  return '<div class="private-report-save"><strong>Keep your completed scan report?</strong>'+
    '<p class="muted small">Optional: save only the cosmetic observations in this browser tab for up to 24 hours. No photo, filename, API key, passcode or scan receipt is stored. You can delete the report anytime.</p>'+
    '<div class="panel-actions">'+action+'</div></div>';
}
function renderPhotoReadiness(){
 const root=$('#photo-readiness-panel');if(!root)return;
 const check=photoReadiness({
  sourceFile:state.sourceFile,preparedFile:state.file,
  dimensions:state.imageDimensions,plan:state.photoPlan,
  checks:state.photoSelfChecks,consent:state.consent,passcodeReady:!!state.code,
  providerReady:state.liveEnabled,pending:!!state.pending,busy:state.busy,preparing:state.preparing
 });
 const label=check.status==='ready'?'TECHNICALLY ELIGIBLE':check.status==='prepare'?'LOCAL PREPARATION AVAILABLE':
  check.status==='invalid'?'PHOTO NOT ELIGIBLE':check.status==='checking'?'CHECKING IMAGE':'NO PHOTO SELECTED';
 const tone=check.status==='ready'?'ready':check.status==='prepare'?'prepare':check.status==='invalid'?'invalid':'idle';
 const diagnostics=check.diagnostics.map(item=>{
  const icon=item.status==='pass'?'✓':item.status==='fail'?'×':item.status==='fix'?'↻':'·';
  return `<div class="readiness-diagnostic ${item.status}"><span aria-hidden="true">${icon}</span><div><strong>${escape(item.label)}</strong><small>${escape(item.detail)}</small></div></div>`;
 }).join('');
 const confirmed=check.manualChecks.map(item=>`<label class="readiness-selfcheck">
   <input type="checkbox" data-photo-selfcheck="${item.id}" ${item.checked?'checked':''} ${!check.selected?'disabled':''}>
   <span><strong>${escape(item.title)}</strong><small>${escape(item.detail)}</small></span></label>`).join('');
 root.innerHTML=`<div class="readiness-top"><div><span class="eyebrow">REAL-TIME · ON-DEVICE CHECK</span><h3>Photo readiness dashboard</h3>
 <p>File metadata is checked automatically; capture quality is confirmed by you.</p></div><span class="readiness-pill ${tone}">${label}</span></div>
 <div class="readiness-progress" role="img" aria-label="${check.diagnostics.filter(x=>x.status==='pass').length} of 5 technical requirements passed"><span style="width:${check.diagnostics.filter(x=>x.status==='pass').length/5*100}%"></span></div>
 <div class="readiness-content"><section class="readiness-tech"><div class="readiness-section-head"><strong>01 · Technical specifications</strong><span>Checked automatically</span></div>
 <div class="readiness-diagnostics">${diagnostics}</div>
 <p class="readiness-next"><strong>Next action</strong><span>${escape(check.next)}</span></p></section>
 <section class="readiness-visual"><div class="readiness-section-head"><strong>02 · Visual-quality self-check</strong><span>${check.manualCount} / ${check.manualTotal} confirmed</span></div>
 <div class="readiness-checkboxes">${confirmed}</div><p class="readiness-manual-caption">Optional self-checks. RoutineGap cannot determine actual lighting, blur, skin visibility, filters or provider acceptance from file dimensions.</p></section></div>
 <p class="readiness-truth"><span aria-hidden="true">ⓘ</span> ${escape(check.truth)}</p>`;
}
function renderScan(){const reports=state.scan||[];$('#view-scan').innerHTML=`${title('SKIN SIGNALS','The skin intelligence studio','Begin with a clear front-facing selfie for live Perfect Corp YouCam Skin Analysis, or explore an unmistakably illustrative sample. Cosmetic signals are not medical diagnoses.')}
<div class="two-col"><div class="panel"><div class="eyebrow">STEP 01 • YOUR IMAGE</div><h3 style="margin-top:9px">Start a skin-aware session</h3><div class="scan-input photo-drop-zone" id="upload-area" aria-label="Select or drop a JPG or PNG original image"><div style="font-size:36px;margin-bottom:8px">◎</div><strong>${state.sourceFile?escape(state.file?.name||state.sourceFile.name):'Choose a clear JPG or PNG selfie'}</strong><p class="muted small">JPG / PNG · 480 px minimum short side · 2,560 px maximum long side · Max 8 MB for scanning · larger originals up to 24 MB can be prepared privately</p><label for="photo-file" class="photo-select-button">Choose photo</label><input id="photo-file" type="file" accept="image/jpeg,image/png" class="sr-only" aria-label="Choose selfie for YouCam analysis"><div class="photo-selected-preview">${state.preview?`<img class="photo-preview" src="${escape(state.preview)}" alt="Preview of your selected image. Nothing has been uploaded yet.">`:''}<span class="muted small">${state.sourceFile?((state.imageDimensions?state.imageDimensions.width+' × '+state.imageDimensions.height+' pixels • ':'')+(state.imageReady?'Ready for analysis':state.canPrepare?'Can be prepared privately':'Checking dimensions / not suitable for analysis')+' — not uploaded.'):'No photo selected yet.'}</span></div>${state.canPrepare?`<div class="local-prep-action"><button type="button" id="prepare-photo" class="secondary" ${state.preparing?"disabled":""}>${state.preparing?"Preparing locally…":"Prepare photo on this device →"}</button><p class="muted small">This runs entirely in your browser. It creates a smaller JPEG copy without filters or AI upscaling. No photo is sent to RoutineGap or YouCam until you explicitly start a scan.</p></div>`:""}</div>
<div id="photo-readiness-panel" class="photo-readiness-panel" role="region" aria-label="Photo technical diagnostics and self-checklist"></div>
<div class="consent-box" style="margin-top:14px"><label><input type="checkbox" id="consent" ${state.consent?'checked':''}><span>I understand my photo will be transferred to Perfect Corp for YouCam analysis. I have consent from the photographed person. Photos are not saved to RoutineGap's permanent database. This is a cosmetic assessment, not medical advice.</span></label></div><div class="field" style="margin-top:14px"><label for="demo-passcode">Live demo passcode (provided by project owner)</label><input id="demo-passcode" type="password" autocomplete="off" placeholder="Required only for real API calls" value="${escape(state.code)}"></div><p class="muted small">${state.liveEnabled?'YouCam API key authenticated with a free balance check. A real skin scan still needs to be tested.':state.providerConnection==='failed'?'The YouCam API key was rejected. The project owner must replace the key securely in Render before real scans can run.':state.providerConnection==='checking'?'YouCam API key verification is in progress. Reload after it finishes.':'The server is not yet connected to a YouCam API key. Sample mode works without a key.'} Real runs consume YouCam API units. The live route is intentionally protected against public credit abuse.</p><div class="panel-actions"><button id="live-scan" class="primary" ${state.busy||!state.liveEnabled||!state.imageReady||!!state.pending?'disabled':''}>${state.busy?'Working with YouCam…':state.pending?'Scan already started — resume below':'Analyze with YouCam →'}</button><button class="ghost" id="sample-report" ${state.busy?'disabled':''}>Explore example instead</button></div>
${state.pending?`<div class="scan-resume-panel" role="group" aria-label="Resume an existing YouCam analysis"><strong>Your earlier analysis may still be running</strong><p class="muted small">Resume this session without uploading the photo again or starting another paid task. The scan receipt is saved in this browser tab for up to 24 hours; your photo is not stored by RoutineGap.</p><div class="panel-actions"><button type="button" id="resume-scan" class="secondary" ${state.busy||!state.liveEnabled?'disabled':''}>Resume existing scan →</button><button type="button" id="forget-scan" class="ghost" ${state.busy?'disabled':''}>Discard saved session</button></div></div>`:''}
<div class="scan-feedback" id="scan-status" role="status" aria-live="polite">${state.feedback?`<div class="notice ${state.isError?'error':''}">${escape(state.feedback)}</div>`:''}</div></div>
<div class="panel"><div class="eyebrow">STEP 02 • COSMETIC INSIGHTS</div><h3 style="margin-top:9px">Your scan report</h3>${markMode()}<div style="margin-top:18px">${reports.length?reports.map(x=>`<div class="report-card"><div><strong>${escape(x.type.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase()))}</strong><div class="muted small">${state.scanSource==='sample'?'Illustrative example only':'YouCam reported cosmetic metric'}</div>
${goals.some(g=>g.id===x.type)?`<button type="button" class="scan-focus-action" data-scan-goal="${escape(x.type)}" ${state.busy?'disabled':''}>Choose as shopping focus ↗</button>`:''}</div><span class="signal-score">${Number.isFinite(x.uiScore)?escape(x.uiScore):x.type==='skin_type'&&typeof x.regions?.whole==='string'?escape(x.regions.whole):'—'}</span></div>`).join(''):`<div class="empty"><div style="font-size:34px;margin-bottom:8px">✧</div><strong>No skin report yet</strong><p>Explore the sample or connect YouCam for real results.</p></div>`}</div><p class="muted small">YouCam's UI scores are cosmetic presentation scores, not clinical risk estimates, diagnostic certainty or product-effectiveness predictions. Your shopping decisions below depend on your stated goals and owned shelf—not inferred disease.</p>${renderLiveReportSaveControls(reports)}${reports.length?'<div class="panel-actions"><button class="secondary" data-go="shop">Continue to shopping studio →</button></div>':''}</div></div>
<section class="scan-photo-guide" aria-labelledby="photo-guide-title">
  <div class="scan-guide-header">
    <div><div class="eyebrow">CAPTURE GUIDE · YOUCAM STANDARD SKIN ANALYSIS</div>
      <h2 id="photo-guide-title">Is your photo ready for a skin scan?</h2>
      <p class="muted">Choose the original photo, not a small thumbnail or screenshot. Check its dimensions before spending any API units.</p>
    </div><span class="scan-guide-ready">Local photo checks · no upload</span>
  </div>
  <div class="photo-specs">
    <div class="photo-spec"><span>Minimum dimension</span><strong>480 px</strong><small>on the <b>shorter</b> side</small></div>
    <div class="photo-spec"><span>Maximum dimension</span><strong>2,560 px</strong><small>on the <b>longer</b> side</small></div>
    <div class="photo-spec"><span>Accepted upload</span><strong>JPG / PNG</strong><small>up to 8 MB in RoutineGap</small></div>
  </div>
  <figure class="photo-example-figure">
    <img src="/scan-photo-examples.svg" alt="Illustrated good-versus-bad skin photo: a sharp, centered, evenly lit frontal photo measuring 960 by 1280 pixels is suitable, while a dim image measuring 236 by 354 pixels is too small." loading="lazy">
    <figcaption>Educational illustrations, not real skin-scan results. <b>Good examples:</b> 720 × 960 or 960 × 1280 px. <b>Too small:</b> 236 × 354 px.</figcaption>
  </figure>
  <div class="photo-capture-list">
    <div class="photo-tip"><span class="photo-tip-icon">01</span><div><strong>Face the camera</strong><p>Keep one entire face centered and straight-on; ideally the face fills about 60–80% of the photo's width.</p></div></div>
    <div class="photo-tip"><span class="photo-tip-icon">02</span><div><strong>Use soft, even light</strong><p>Avoid shadows, blur, beauty filters, strong makeup, and backlighting. Keep eyes open and a neutral expression.</p></div></div>
    <div class="photo-tip"><span class="photo-tip-icon">03</span><div><strong>Keep the skin visible</strong><p>Remove glasses and hats, keep hair off the forehead and cheeks, and use an original unretouched photo.</p></div></div>
  </div>
  <div class="photo-repair-guide">
    <div class="photo-repair-heading"><h3>Don't have the right pixel dimensions?</h3><p>Choose a solution that preserves genuine skin detail.</p></div>
    <div class="photo-repair-grid">
      <div class="photo-repair-card"><span class="photo-repair-type">TOO SMALL · BEST SOLUTION</span><strong>Find the original or retake it</strong><p>Download the full-size photo from your phone or photo library rather than a compressed thumbnail. If the original is tiny or blurry, retake it with your phone camera in daylight.</p></div>
      <div class="photo-repair-card"><span class="photo-repair-type">TOO LARGE · EASY FIX</span><strong>Reduce to a suitable size</strong><p>If the original is sharp but larger than 2,560 px on its long side, reduce the dimensions, preserve the aspect ratio, and keep the shorter side at least 480 px.</p></div>
      <div class="photo-repair-card"><span class="photo-repair-type">QUALITY WARNING</span><strong>Upscaling is not a real fix</strong><p>Enlarging a 236 × 354 photo cannot recover real pore and skin texture information. AI beautification or invented details are unsuitable for skin analysis.</p></div>
    </div>
    <div class="photo-tools">
      <a href="https://www.photopea.com/" target="_blank" rel="noopener noreferrer"><strong>Photopea</strong><small>Inspect or reduce dimensions: Image → Image Size</small><span aria-hidden="true">↗</span></a>
      <a href="https://squoosh.app/" target="_blank" rel="noopener noreferrer"><strong>Squoosh</strong><small>Resize oversized originals and compress locally</small><span aria-hidden="true">↗</span></a>
      <a href="https://www.photopea.com/learn/image-size" target="_blank" rel="noopener noreferrer"><strong>Image size tutorial</strong><small>How to inspect and adjust image dimensions</small><span aria-hidden="true">↗</span></a>
    </div>
    <p class="photo-guide-footnote">These tools can inspect, crop, export or downsize an existing high-quality photo, but <b>cannot restore missing skin detail</b> to a low-resolution image. See <a href="https://docs.perfectcorp.com/reference/ai_skin_analysis/section/overview/file-specs-and-errors" target="_blank" rel="noopener noreferrer">Perfect Corp's official photo specifications ↗</a>.</p>
  </div>
</section>`;renderPhotoReadiness();}
function renderShelfResults(d) {
  const q=state.shelfQuery.trim().toLocaleLowerCase('en');
  const results=d.owned.filter(item=>[item.name,stepLabels[item.step],...item.tags].join(' ').toLocaleLowerCase('en').includes(q));
  const counter=$('#shelf-count');if(counter)counter.textContent=results.length+' / '+d.owned.length+' visible';
  const target=$('#shelf-inventory');if(!target)return;
  target.innerHTML=results.length?results.map(item=>`<article class="shelf-owned-row">
    <div class="shelf-owned-icon" aria-hidden="true">${item.step==='spf'?'☀':item.step==='moisturizer'?'◒':item.step==='serum'?'✦':'◌'}</div>
    <div class="shelf-owned-copy"><strong>${escape(item.name)}</strong><span>${escape(stepLabels[item.step])} · ${money(item.price)} recorded purchase price</span><small>${item.tags.length?escape(item.tags.join(' · ')):'No additional tags'}</small></div>
    <div class="shelf-owned-actions"><button type="button" class="tiny-btn" data-edit="${escape(item.id)}" ${state.sampleInventory?'disabled title="Replace the sample shelf with your real products to edit"':''}>Edit</button>
    <button type="button" class="tiny-btn" data-remove="${escape(item.id)}" aria-label="${escape('Remove '+item.name)}">Remove</button></div>
  </article>`).join(''):`<div class="empty">${d.owned.length?'No shelf products match your search. Try fewer words.':'Your shelf is empty. Add your first product to get started.'}</div>`;
}
function renderShelf(d) {
 const editing=!state.sampleInventory?d.owned.find(p=>p.id===state.editingId):null;
 $('#view-shelf').innerHTML=`${title('YOUR PRODUCTS','Your personal shelf','Manage what you actually own. Search, correct product details, and keep a private backup of your inventory. Example starter products are never silently treated as real ownership.')}
 <div class="shelf-header-stats">
 <div><span>Recorded products</span><strong>${d.owned.length}</strong><small>${state.sampleInventory?'Illustrative preview':'Browser-local inventory'}</small></div>
 <div><span>Routine steps covered</span><strong>${new Set(d.owned.filter(x=>['cleanser','moisturizer','spf'].includes(x.step)).map(x=>x.step)).size} / 3</strong><small>${state.sampleInventory?'Preview only':'Category-based overview'}</small></div>
 <div><span>Inventory provenance</span><strong class="shelf-provenance">${state.sampleInventory?'SAMPLE':'USER-ENTERED'}</strong><small>No account or cloud sync</small></div></div>
 <div class="shelf-workspace">
 <div class="shelf-editor-column"><section class="panel shelf-editor">
 <div class="eyebrow">ADD TO YOUR SHELF</div><h3>Record an item you own</h3>
 <form id="add-product"><div class="field"><label for="owned-name">Product name</label><input id="owned-name" name="name" required maxlength="90" placeholder="e.g. My gentle face wash"></div>
 <div class="forms" style="margin-top:14px"><div class="field"><label for="owned-step">Routine step</label><select id="owned-step">${Object.entries(stepLabels).map(([k,v])=>`<option value="${k}">${escape(v)}</option>`).join('')}</select></div>
 <div class="field"><label for="owned-price">Purchase price (USD)</label><input id="owned-price" type="number" min="0" max="10000" step=".01" value="15"></div></div>
 <div class="field" style="margin-top:14px"><label for="owned-tags">Tags (optional, comma-separated)</label><input id="owned-tags" maxlength="140" placeholder="hydrating, fragrance-free"></div>
 <button class="primary" type="submit" style="margin-top:16px">Add to shelf +</button>
 <p class="muted small">Adding your first real item replaces the illustrative starter shelf. Maximum ${SHELF_LIMIT} products; don't enter medical records or private credentials.</p></form>
 </section>
 ${editing?`<section class="panel shelf-edit-panel"><div class="eyebrow">EDIT AN OWNED PRODUCT</div><h3>Update ${escape(editing.name)}</h3>
 <form id="edit-product"><input type="hidden" id="edit-owned-id" value="${escape(editing.id)}">
 <div class="field"><label for="edit-owned-name">Product name</label><input id="edit-owned-name" required maxlength="90" value="${escape(editing.name)}"></div>
 <div class="forms" style="margin-top:14px"><div class="field"><label for="edit-owned-step">Routine step</label><select id="edit-owned-step">${Object.entries(stepLabels).map(([id,label])=>`<option value="${id}" ${editing.step===id?'selected':''}>${escape(label)}</option>`).join('')}</select></div>
 <div class="field"><label for="edit-owned-price">Purchase price (USD)</label><input type="number" min="0" max="10000" step=".01" id="edit-owned-price" value="${editing.price}"></div></div>
 <div class="field" style="margin-top:14px"><label for="edit-owned-tags">Tags</label><input id="edit-owned-tags" maxlength="140" value="${escape(editing.tags.join(', '))}"></div>
 <div class="panel-actions"><button class="primary" type="submit">Save changes</button><button class="ghost" id="cancel-edit" type="button">Cancel</button></div></form></section>`:''}
 <section class="panel shelf-data-panel"><div class="eyebrow">DATA & CONTROL</div><h3>Your inventory belongs to you.</h3>
 <p class="muted small">Export a JSON copy or restore one from another browser. All processing is on your device; uploads never reach RoutineGap or YouCam. Backups intentionally exclude photos, scans, passcodes and receipts.</p>
 <div class="shelf-data-actions"><button class="secondary" id="export-shelf" type="button" ${state.sampleInventory?'disabled title="Sample inventory cannot be exported as real user data"':''}>↓ Export shelf (.json)</button>
 <button class="ghost" id="import-shelf-trigger" type="button">↑ Import backup</button><input class="sr-only" id="shelf-import" type="file" accept=".json,application/json" aria-label="Choose RoutineGap shelf JSON backup"></div>
 <p class="muted small">Import replaces the existing product list and preferences only after confirmation. Keep JSON backups private because they contain product names you entered.</p>
 </section></div>
 <section class="panel shelf-inventory-panel"><div class="shelf-inventory-top"><div><div class="eyebrow">MY INVENTORY</div><h3>What's already on your shelf?</h3></div>
 <span class="label-pill ${state.sampleInventory?'peach':''}">${state.sampleInventory?'SAMPLE INVENTORY':'OWNED PRODUCTS'}</span></div>
 <div class="shelf-search-row"><label for="shelf-search">Search your shelf</label><input id="shelf-search" type="search" maxlength="80" placeholder="Search name, type or tag…" value="${escape(state.shelfQuery)}"><span id="shelf-count" aria-live="polite"></span></div>
 ${state.undoShelf?'<div class="shelf-undo"><span>A recent shelf change can be reversed.</span><button id="undo-shelf" class="secondary" type="button">Undo change</button></div>':''}
 <div id="shelf-inventory"></div>
 <div class="shelf-actions-footer"><button class="tiny-btn" id="reset-shelf" type="button">Load illustrative starter shelf</button>
 <button class="tiny-btn" id="clear-shelf" type="button">Clear shelf</button>
 <button class="secondary" data-go="routine" type="button">Build my routine →</button></div>
 <p class="muted small">Category matches indicate possible duplicate routine steps, not ingredient equivalence, product efficacy, or medical suitability.</p>
 </section></div>`;
 renderShelfResults(d);
}
function snapshotShelf(){
 state.undoShelf={shelf:state.shelf.map(p=>({...p,tags:[...(p.tags||[])]})),sampleInventory:state.sampleInventory};
}
function finishShelfMutation(clearChecks=false){
 state.editingId=null;
 if(clearChecks){state.routineLog=null;try{localStorage.removeItem(ROUTINE_LOG_KEY);}catch{}}
 const validIds=new Set(decide().rows.filter(p=>p.decision!=='skip').map(p=>p.id));
 state.cartIds=state.cartIds.filter(id=>validIds.has(id));
 persist();
 renderShelf(decide());
}
function downloadShelfBackup(){
 try{
   const report=makeShelfBackup({shelf:state.shelf,budget:state.budget,goal:state.goal,fragranceFree:state.fragranceFree,sampleInventory:state.sampleInventory});
   const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'});
   const url=URL.createObjectURL(blob);
   const anchor=document.createElement('a');anchor.href=url;anchor.download='routinegap-shelf-backup.json';
   document.body.appendChild(anchor);anchor.click();anchor.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2000);
   notice('Shelf backup downloaded locally. Keep it private; it contains your entered product names.');
 }catch(e){notice(e.message||'Could not export your shelf.',true);}
}
async function importShelfBackup(file){
 if(!file)return;
 if(file.size>SHELF_BACKUP_MAX_BYTES||file.size===0)return notice('Select a nonempty RoutineGap backup JSON file no larger than 64 KB.',true);
 try{
   const imported=readShelfBackup(await file.text());
   if(!window.confirm('Restore '+imported.shelf.length+' products and saved shopping preferences? This replaces your current shelf and settings on this device. Your scan data and separate saved concept board are not imported.'))return;
   snapshotShelf();
   state.shelf=imported.shelf;
   state.budget=imported.preferences.budget;state.goal=imported.preferences.goal;
   state.fragranceFree=imported.preferences.fragranceFree;state.goalFromScan=null;
   state.sampleInventory=false;state.shelfQuery='';
   finishShelfMutation(true);
   notice('Backup restored locally: '+imported.shelf.length+' owned products. No data was uploaded.');
 }catch(e){notice(e.message||'Could not import this backup. Your existing shelf was left unchanged.',true);}
}
function renderRoutine(d){
  const plan=buildRoutinePlan(d.owned), day=localRoutineDate(), sample=state.sampleInventory;
  const log=sample?{date:day,done:[]}:readRoutineLog(state.routineLog,day,plan);
  const progress=routineProgress(log,plan);
  const section=(items)=>items.map((step,i)=>{const done=step.available&&log.done.includes(step.key);
    return `<div class="routine-step ${done?'is-done':''} ${step.available?'':'is-missing'}">
      <div class="routine-step-index">${String(i+1).padStart(2,'0')}</div><div class="routine-step-content">
      <strong>${escape(step.label)}</strong><span class="label-pill ${step.available?'':'peach'}">${step.available?'OWNED':'STEP MISSING'}</span>
      <p class="routine-step-product">${step.available?escape(step.productName):'No owned product recorded'}</p>
      <p class="muted small">${escape(step.hint)}</p></div>
      ${step.available?`<label class="routine-step-check"><input type="checkbox" data-routine-key="${escape(step.key)}" ${done?'checked':''} ${sample?'disabled':''} aria-label="${escape('Check '+step.period+' '+step.label)}"><span>${done?'Checked':'Check off'}</span></label>`:'<button class="tiny-btn" data-go="shelf">Add yours</button>'}
      </div>`;}).join('');
  $('#view-routine').innerHTML=`${title('YOUR EVERYDAY SPACE','A routine you can actually follow','Use your own shelf to organize a simple morning and evening checklist. It is not medical advice, a treatment plan, or a reason to buy more products.')}
  <section class="routine-banner"><div><div class="eyebrow">DAILY SKINCARE STUDIO</div><h2>Small steps, made simple.</h2><p>No scan required. Begin with what you already own.</p></div><div class="routine-progress"><strong>${sample?'Preview':progress.completed+' / '+progress.total}</strong><span>${sample?'Illustrative starter products':'Steps you checked today'}</span><small>${escape(new Intl.DateTimeFormat('en',{weekday:'long',month:'short',day:'numeric'}).format(new Date()))}</small></div></section>
  ${sample?'<div class="routine-warning" role="note"><strong>Example inventory — not your own products</strong><p>This is a preview. Logging is disabled until you add a real product. Starter items will be replaced, not blended into your shelf.</p><button class="secondary" data-go="shelf">Enter my actual products →</button></div>':''}
  <div class="routine-summary-strip"><span><b>${plan.availableCount}</b> steps covered</span><span><b>${plan.missingSteps.length}</b> unique gaps</span><span><b>${d.owned.length}</b> ${sample?'sample':'owned'} products</span></div>
  <div class="routine-columns">
    <section class="routine-period"><div class="routine-period-head"><span class="routine-period-symbol">☀</span><div><div class="eyebrow">AM / DAYTIME</div><h3>Morning routine</h3><p>Cleanse · Moisturize · SPF</p></div></div>${section(plan.morning)}</section>
    <section class="routine-period"><div class="routine-period-head"><span class="routine-period-symbol evening">☾</span><div><div class="eyebrow">PM / EVENING</div><h3>Evening routine</h3><p>Cleanse · Moisturize</p></div></div>${section(plan.evening)}</section>
  </div>
  <div class="routine-bottom-panel"><div><h3>Good routines start with what you own.</h3><p class="muted small">These steps are organization suggestions, not individualized advice. Optional serums and treatments aren't automatically scheduled; follow the product label. Checks reflect what you marked, not verified adherence. Only today's task keys are stored in this browser, not photos, scan scores, product names or credentials.</p></div><div class="routine-bottom-actions"><button class="secondary" data-go="shelf">Edit my shelf →</button><button class="ghost" data-go="shop">Review shopping gaps →</button>${sample?'':'<button class="tiny-btn" id="clear-routine">Clear today’s checks</button>'}</div></div>`;
}
function renderCatalogResults(d){
  const rows=discoverConcepts(d.rows,{
    query:state.catalogQuery,step:state.catalogStep,decision:state.catalogDecision,
    sort:state.catalogSort,savedOnly:state.savedOnly,affordableOnly:state.affordableOnly,
    budget:d.budget,savedIds:state.savedIds
  });
  const count=$('#catalog-results-count'),results=$('#catalog-results');
  if(count)count.textContent=`${rows.length} of ${d.rows.length} example concepts · ${state.savedIds.length} saved`;
  if(!results)return;
  if(!rows.length){results.innerHTML=`<div class="catalog-no-results"><div class="catalog-no-results-icon" aria-hidden="true">◇</div><h3>No concepts match these filters</h3><p>Try another category, a broader search or clear the filters. Your shelf and saved list have not changed.</p><button class="secondary" type="button" id="reset-empty-catalog">Clear discovery filters</button></div>`;return;}
  results.innerHTML=rows.map(p=>{
    const cart=state.cartIds.includes(p.id);
    const saved=state.savedIds.includes(p.id);
    const unavailable=p.decision==='skip';
    return `<article class="product-card concept-card" aria-label="${escape(p.name)}">
      <div class="concept-art"><div class="product-art art-${escape(p.step)}" aria-hidden="true"></div>
        <span class="concept-art-label">ILLUSTRATIVE CONCEPT</span>
        <button class="concept-save ${saved?'is-saved':''}" type="button" data-save="${escape(p.id)}"
          aria-pressed="${saved}" aria-label="${escape((saved?'Remove ':'Save ')+p.name+(saved?' from':' to')+' concept board')}">${saved?'♥':'♡'}</button>
      </div>
      <div class="concept-card-body"><div class="eyebrow">${escape(stepLabels[p.step])} · ${escape(p.brand)}</div>
      <h3>${escape(p.name)}</h3><p class="concept-description">${escape(p.description)}</p>
      <div class="concept-tags">${p.tags.slice(0,3).map(t=>`<span>${escape(t)}</span>`).join('')}</div>
      <div class="product-meta"><span class="product-price">${money(p.price)} <small>demo price</small></span>
      <span class="label-pill ${unavailable?'peach':''}">${unavailable?'USE WHAT YOU OWN':p.decision==='optional'?'OPTIONAL':'ROUTINE GAP'}</span></div>
      <div class="concept-actions"><button class="tiny-btn" type="button" data-cart="${escape(p.id)}" ${unavailable?'disabled title="Already have this step on your shelf"':''}>${cart?'✓ Remove from demo cart':unavailable?'Already covered':'Add to demo cart +'}</button><button class="tiny-btn concept-compare ${state.compareIds.includes(p.id)?'is-comparing':''}" type="button" data-compare="${escape(p.id)}" aria-pressed="${state.compareIds.includes(p.id)}">${state.compareIds.includes(p.id)?'✓ In comparison':'⇆ Compare'}</button>
      <button class="concept-details-open" type="button" data-open-story="${escape(p.id)}">Explore full details →</button><details class="concept-detail"><summary>Why this label?</summary><p>${escape(p.reason)}</p></details></div></div>
    </article>`;
  }).join('');
}
function renderShop(d){
  const cartProducts=d.rows.filter(x=>state.cartIds.includes(x.id));
  const cartTotal=cartProducts.reduce((n,p)=>n+p.price,0);
  const saved=state.savedIds.map(id=>catalog.find(x=>x.id===id)).filter(Boolean);
  const fields=(key,options,selected,labels)=>{
    return `<select id="${key}">${options.map(x=>`<option value="${escape(x)}" ${selected===x?'selected':''}>${escape(labels[x]||x)}</option>`).join('')}</select>`;
  };
  $('#view-shop').innerHTML=`${title('DISCOVER & DECIDE','The shopping studio','Explore an expanded concept catalog, see what your shelf already covers, and compare possibilities without pressure to purchase. All products and prices are fictional examples, not merchant offers.')}
  <div class="scan-shop-bridge">
    <div><span class="eyebrow">EVIDENCE → YOUR CHOICE</span><h3>Thoughtful discovery, without guesswork</h3>
    <p class="muted small">${state.scanSource==='live'?'A real YouCam cosmetic observation is available.':state.scanSource==='sample'?'The skin report is explicitly illustrative, not YouCam evidence.':'No scan is needed to explore the catalog.'}
    ${state.goalFromScan?'You selected '+escape(goals.find(g=>g.id===state.goal)?.name||'a focus')+' yourself after reviewing the '+(state.goalFromScan==='live'?'real scan.':'illustrative report.'):'We match your own budget, routine steps and stated preference, not diagnostic or predictive scores.'}</p></div>
    <button class="tiny-btn" data-go="scan">Review skin observations ↗</button>
  </div>
  <div class="catalog-layout">
    <div class="catalog-main">
      <section class="panel catalog-preferences"><div class="catalog-panel-heading"><div><div class="eyebrow">YOUR SHOPPING PREFERENCES</div><h3>Make it yours</h3></div><span class="label-pill peach">NO LIVE CHECKOUT</span></div>
        <div class="forms"><div class="field"><label for="budget">Your spending limit (demo USD)</label><input id="budget" type="number" min="0" max="1000" value="${d.budget}"></div>
        <div class="field"><label for="goal">Your cosmetic focus</label><select id="goal">${goals.map(g=>`<option value="${g.id}" ${state.goal===g.id?'selected':''}>${escape(g.name)}</option>`).join('')}</select></div></div>
        <label class="checkbox-line"><input id="fragrance" type="checkbox" ${state.fragranceFree?'checked':''}> Filter to fragrance-free tagged concepts</label>
        <p class="muted small">Matching is category-based and illustrative; it does not establish skin compatibility, ingredients, verified SPF performance, allergies or clinical benefits.</p>
      </section>
      <section class="catalog-discover" aria-label="Explore sample product catalog">
        <div class="catalog-section-heading"><div><div class="eyebrow">CURATED CONCEPT LIBRARY</div><h2>Discover what fits your routine</h2><p>Explore ${catalog.length} fictional product concepts with transparent duplicate prevention.</p></div><span class="catalog-count" id="catalog-results-count" role="status" aria-live="polite"></span></div>
        <div class="catalog-toolbar"><div class="catalog-search"><label for="catalog-search">Search concept names, textures and tags</label><div class="catalog-search-wrap"><span aria-hidden="true">⌕</span><input id="catalog-search" type="search" maxlength="80" autocomplete="off" placeholder="Try hydration, gel, fragrance-free…" value="${escape(state.catalogQuery)}"></div></div>
          <div class="catalog-filter"><label for="catalog-step">Routine step</label>${fields('catalog-step',FILTER_STEPS,state.catalogStep,{all:'All steps',cleanser:'Cleanser',moisturizer:'Moisturizer',spf:'Daily SPF',serum:'Optional serum'})}</div>
          <div class="catalog-filter"><label for="catalog-decision">Shopping label</label>${fields('catalog-decision',FILTER_DECISIONS,state.catalogDecision,{all:'All labels',consider:'Gap to consider',optional:'Optional care',skip:'Already covered'})}</div>
          <div class="catalog-filter"><label for="catalog-sort">Sort by</label>${fields('catalog-sort',SORT_OPTIONS,state.catalogSort,{recommended:'Actionable first', 'price-low':'Price: low to high','price-high':'Price: high to low',name:'Name: A to Z'})}</div>
        </div>
        <div class="catalog-quick-filters"><label><input id="catalog-saved-only" type="checkbox" ${state.savedOnly?'checked':''}> Saved concepts only</label>
          <label><input id="catalog-affordable-only" type="checkbox" ${state.affordableOnly?'checked':''}> Individually within budget</label>
          <button class="tiny-btn" id="reset-catalog" type="button">Reset filters</button></div>
        <div class="catalog-results-grid" id="catalog-results"></div>
      </section>
    </div>
    <aside class="catalog-rail" aria-label="Saved concepts and spending summary">
      <div class="spend-box catalog-spend-box"><div class="eyebrow" style="color:#d7e7c4">YOUR SPENDING GUARDRAIL</div><strong>${money(cartTotal)} <span>/ ${money(d.budget)}</span></strong>
        <div class="catalog-budget-meter"><span style="width:${Math.min(100,(cartTotal/(d.budget||1))*100)}%" class="${cartTotal>d.budget?'is-over':''}"></span></div>
        <p>${cartTotal>d.budget?'Over your demo spending limit by '+money(cartTotal-d.budget):money(Math.max(0,d.budget-cartTotal))+' remains · No checkout occurs'}</p>
        <button class="primary" id="cart-auto" type="button">Build essentials-first demo cart</button>
      </div>
      <div class="panel catalog-cart"><div class="catalog-panel-heading"><div><div class="eyebrow">YOUR DECISIONS</div><h3>Considered cart</h3></div><span class="label-pill">${cartProducts.length} ITEMS</span></div>
      ${cartProducts.length?cartProducts.map(p=>`<div class="cart-line"><span>${escape(p.name)}</span><strong>${money(p.price)}</strong></div>`).join(''):'<p class="muted small">No concepts selected. This is not a real order.</p>'}
      <div class="cart-line"><strong>Example total</strong><strong>${money(cartTotal)}</strong></div>
      <div class="catalog-rail-buttons"><button class="secondary" data-go="trail">Review decision trail →</button>${cartProducts.length?'<button class="tiny-btn" id="cart-clear">Empty demo cart</button>':''}</div></div>
      <div class="panel catalog-shortlist"><div class="catalog-panel-heading"><div><div class="eyebrow">PRIVATE COMPARISON</div><h3>Saved concept board</h3></div><span class="label-pill">${saved.length} / ${MAX_SAVED_CONCEPTS}</span></div>
      <p class="muted small">Save up to ${MAX_SAVED_CONCEPTS} ideas in this browser. You can also compare up to ${MAX_COMPARE} products side by side. Neither action purchases anything.</p><button type="button" class="secondary catalog-compare-link" data-go="compare">Compare concepts (${state.compareIds.length}/${MAX_COMPARE}) →</button>
      ${saved.length?`<div class="catalog-saved-list">${saved.map(p=>{
        const evaluated=d.rows.find(x=>x.id===p.id);
        return `<div class="catalog-saved-item"><div><strong>${escape(p.name)}</strong><span>${escape(stepLabels[p.step])} · ${money(p.price)}</span><small>${evaluated?.decision==='skip'?'Shelf already covers this step':evaluated?.decision==='optional'?'Optional step':evaluated?'Gap to consider':'Outside current catalog filter'}</small></div><button class="concept-remove" type="button" data-save="${escape(p.id)}" aria-label="${escape('Unsave '+p.name)}">×</button></div>`;
      }).join('')}</div><button class="tiny-btn" id="clear-saved" type="button">Clear saved ideas</button>`:
      '<div class="catalog-saved-empty">♡ <span>Save an idea to compare its type and example price here.</span></div>'}
      <p class="muted small">No sign-in, external tracking or purchases. Only saved concept IDs are stored locally.</p></div>
    </aside>
  </div>`;
  renderCatalogResults(d);
  renderConceptStory();
}
function renderScenario(snapshot) {
 const budget=state.insightBudget===null?snapshot.decision.budget:state.insightBudget;
 const scenario=evaluateBudgetScenario(snapshot,budget);
 const display=$('#insights-budget-value'),panel=$('#insights-scenario'),slider=$('#insights-budget-slider');
 if(display)display.textContent=money(budget);
 if(slider&&Number(slider.value)!==budget)slider.value=budget;
 if(!panel)return;
 panel.innerHTML=`<div class="insights-scenario-top">
 <div><span>Illustrative essentials-first selection</span><strong>${money(scenario.spent)}</strong><small>Example catalog amount · not a purchase</small></div>
 <div><span>Unallocated budget</span><strong>${money(scenario.remaining)}</strong><small>Based only on these fictional prices</small></div>
 </div>
 ${scenario.noNewPurchase?'<div class="insights-info-notice">Your own product categories already cover cleanser, moisturizer, and daily SPF. The model suggests no essential purchase.</div>':
 scenario.suggested.length?`<div class="insights-scenario-items">${scenario.suggested.map(p=>`<div class="insights-scenario-item"><div><strong>${escape(p.name)}</strong><small>${escape(stepLabels[p.step])} · illustrative concept</small></div><b>${money(p.price)}</b></div>`).join('')}</div>`:
 '<div class="insights-info-notice">No illustrative missing-step options fit this amount. You can still use and review what you own.</div>'}
 ${scenario.unmetGaps.length?`<p class="insights-gap-reminder">${scenario.unmetGaps.length} step${scenario.unmetGaps.length===1?'':'s'} remain outside this simulated budget: ${escape(scenario.unmetGaps.map(s=>stepLabels[s]).join(', '))}.</p>`:
 `<p class="insights-positive-reminder">${scenario.noNewPurchase?'No new essentials suggested.':'The example budget can accommodate a concept for each missing essential step.'}</p>`}
 <div class="insights-scenario-footer"><p>This scenario does not change your shopping budget, saved board, real inventory, or demo cart.</p><button class="tiny-btn" data-go="shop">Open shopping studio ↗</button></div>`;
}
function renderInsights() {
 const snapshot=makeInsights({shelf:state.shelf,sampleInventory:state.sampleInventory,budget:state.budget,goal:state.goal,fragranceFree:state.fragranceFree,cartIds:state.cartIds,savedIds:state.savedIds});
 const total=snapshot.ownedCount;
 const largest=Math.max(1,...ALL_STEPS.map(x=>snapshot.counts[x]));
 const spentTotal=Math.max(1,snapshot.recordedPriceTotal);
 const mode=snapshot.sampleInventory?'ILLUSTRATIVE STARTER SHELF · EXCLUDED FROM PERSONAL STATS':total?'USER-ENTERED INVENTORY':'NO PRODUCTS ENTERED';
 const scenarioBudget=state.insightBudget===null?snapshot.decision.budget:state.insightBudget;
 const limit=Math.max(200,Math.ceil(snapshot.decision.budget/100)*100);
 $('#view-insights').innerHTML=`${title('THE BIG PICTURE','Your routine insights','A transparent snapshot of what you entered, what your routine categories cover, and what a hypothetical budget could support. This is not a medical assessment or a spending-history tracker.')}
 <div class="insights-hero">
   <div class="insights-hero-text"><div class="eyebrow">YOUR ROUTINE · YOUR DECISIONS</div><h2>Know what you have. <em>Choose what comes next.</em></h2>
   <p>Every number below comes from your local shelf and stated preferences, or from a clearly labeled fictional concept catalog. No estimated savings or invented trends.</p><div class="insights-hero-actions"><button class="primary" data-go="shelf">Manage my shelf →</button><button class="ghost" data-go="shop">Browse concepts →</button></div></div>
   <div class="insights-progress-ring" style="--p:${snapshot.coveragePercent}" role="img" aria-label="${snapshot.coveredCount} of three basic routine steps covered by user-owned inventory"><div><strong>${snapshot.coveredCount}<span>/ 3</span></strong><small>basic steps</small></div></div>
 </div>
 <div class="insights-mode"><span class="insights-mode-dot"></span><strong>${mode}</strong><span>Snapshot only · Not longitudinal analytics</span></div>
 <div class="insights-metric-grid">
   <div class="insights-metric"><span>Products you entered</span><strong>${snapshot.ownedCount}</strong><small>${snapshot.sampleInventory?'Sample products do not count':total?'Stored locally in this browser':'Add your first real product'}</small></div>
   <div class="insights-metric"><span>Recorded purchase prices</span><strong>${money(snapshot.recordedPriceTotal)}</strong><small>Sum of amounts entered · not verified spending</small></div>
   <div class="insights-metric"><span>Illustrative duplicate flags</span><strong>${snapshot.duplicateMatches}</strong><small>Concepts overlapping your owned routine steps</small></div>
   <div class="insights-metric"><span>Saved ideas</span><strong>${snapshot.savedCount}</strong><small>Example products you saved, not purchased</small></div>
 </div>
 <div class="insights-main-grid">
 <section class="panel insights-breakdown"><div class="eyebrow">YOUR SHELF AT A GLANCE</div><h3>What's in your routine?</h3><p class="muted small">Count by routine category. These are entries on your shelf, not products detected by YouCam.</p>
 <div class="insights-category-list">${ALL_STEPS.map(step=>{
   const count=snapshot.counts[step],cost=snapshot.costs[step],percent=Math.round(count/largest*100);
   return `<div class="insights-category"><div class="insights-category-label"><strong>${escape(stepLabels[step])}</strong><span>${count} item${count===1?'':'s'} · ${money(cost)} recorded</span></div><div class="insights-category-track" aria-hidden="true"><span style="width:${percent}%"></span></div></div>`;
 }).join('')}</div>
 <div class="insights-breakdown-footer">Recorded purchase-price sum: <strong>${money(snapshot.recordedPriceTotal)}</strong> <span>· No merchant price feeds or market valuations</span></div></section>
 <section class="panel insights-coverage"><div class="eyebrow">THREE BASIC ROUTINE STEPS</div><h3>Coverage, not a diagnosis</h3><p class="muted small">Based exclusively on the routine types you recorded. Having an item does not establish its suitability or effectiveness.</p>
 ${BASIC_STEPS.map((step,i)=>{const covered=snapshot.covered.includes(step);return `<div class="insights-step-row"><span class="insights-step-number">0${i+1}</span><div><strong>${escape(stepLabels[step])}</strong><small>${step==='spf'?'An everyday sun-protection category':step==='moisturizer'?'The moisturizing routine category':'The basic cleansing category'}</small></div><span class="label-pill ${covered?'':'peach'}">${covered?'RECORDED':'POTENTIAL GAP'}</span></div>`;}).join('')}
 <div class="insights-coverage-footer">${snapshot.coveredCount===3?'All three basic categories are represented in your user-entered shelf.':'There are '+snapshot.gaps.length+' missing basic categories in your user-entered shelf. This does not mean a purchase is required.'}</div>
 <button class="secondary" data-go="routine">View daily routine →</button></section></div>
 <div class="insights-simulator">
 <div class="insights-sim-heading"><div><div class="eyebrow">INTERACTIVE · WHAT-IF LAB</div><h2>Explore a different budget.</h2><p>Slide to test an illustrative essentials-first shopping scenario without changing your actual preferences or cart.</p></div><span class="label-pill peach">FICTIONAL PRICES ONLY</span></div>
 <div class="insights-sim-body"><div class="insights-budget-control"><label for="insights-budget-slider">What-if budget: <strong id="insights-budget-value">${money(scenarioBudget)}</strong></label>
 <input type="range" id="insights-budget-slider" min="0" max="${limit}" value="${scenarioBudget}" step="1">
 <div class="insights-budget-scale"><span>$0</span><span>${money(limit)}</span></div>
 <div class="insights-budget-presets"><span>Quick scenarios</span>${[0,30,60,100].map(n=>`<button type="button" class="tiny-btn" data-scenario-budget="${n}">${money(n)}</button>`).join('')}
 <button type="button" class="tiny-btn" id="insights-budget-reset">Use my ${money(snapshot.decision.budget)} budget</button></div>
 <p class="muted small">This is a simple category/price thought experiment, not a prediction of savings, results or actual merchant availability.</p></div>
 <div class="insights-scenario" id="insights-scenario" aria-live="polite"></div></div></div>
 <section class="insights-explain"><div><div class="eyebrow">TRANSPARENCY MATTERS</div><h2>Know what these numbers can—and cannot—tell you.</h2><p>These snapshots do not estimate skincare effectiveness, allergy safety, real-world spending, behavioral adherence, or improvement over time. Scan scores, if available, are vendor cosmetic observations and are not used to infer clinical outcomes or purchases.</p></div><button class="secondary" data-go="trail">Inspect decision logic →</button></section>`;
 renderScenario(snapshot);
}
function renderComparePicker(){
  const all=filterComparisonCandidates(catalog,{query:state.compareQuery,step:state.compareStep});
  const sorted=all.slice().sort((a,b)=>Number(state.savedIds.includes(b.id))-Number(state.savedIds.includes(a.id))||a.name.localeCompare(b.name));
  const grid=$('#compare-candidate-list'),count=$('#compare-candidate-count');if(count)count.textContent=`${sorted.length} concepts · ${state.compareIds.length} selected`;
  if(!grid)return;
  grid.innerHTML=sorted.length?sorted.map(p=>{
    const picked=state.compareIds.includes(p.id),saved=state.savedIds.includes(p.id);
    return `<article class="compare-candidate ${picked?'is-picked':''}">
      <div class="compare-candidate-art art-${escape(p.step)}" aria-hidden="true"><span>${p.step==='spf'?'☼':p.step==='serum'?'✦':p.step==='moisturizer'?'◓':'◌'}</span></div>
      <div class="compare-candidate-copy"><div class="eyebrow">${escape(stepLabels[p.step])} ${saved?'· SAVED IDEA':''}</div>
      <strong>${escape(p.name)}</strong><span>${money(p.price)} example price · ${escape(p.tags.slice(0,2).join(' · '))}</span></div>
      <button class="tiny-btn ${picked?'is-selected':''}" type="button" data-compare="${escape(p.id)}" aria-pressed="${picked}" aria-label="${escape((picked?'Remove ':'Compare ')+p.name)}">${picked?'✓ Selected':'+ Compare'}</button>
    </article>`;
  }).join(''):'<div class="compare-picker-empty">No fictional concepts match these filters. Try a different word or step.</div>';
}
function renderCompare(){
 const model=buildComparison({catalog,ids:state.compareIds,owned:state.shelf,budget:state.budget,goal:state.goal,fragranceFree:state.fragranceFree,sampleInventory:state.sampleInventory,savedIds:state.savedIds});
 const selected=model.entries;
 const status=p=>p.ownedStep?{label:'Already represented',detail:'You already recorded a product in this routine category. Prioritize using what you own.',className:'warn'}:
   p.step==='serum'?{label:'Optional care',detail:'This is an optional cosmetic step, not required to fill the basic routine.',className:'neutral'}:
   {label:'Potential routine gap',detail:'This category is not recorded in your real shelf. A purchase is never mandatory.',className:'good'};
 const renderValue=(fn)=>selected.map(p=>`<td>${fn(p)}</td>`).join('');
 const sourceShelf=state.sampleInventory?'The starter shelf is illustrative and has been excluded from personalized duplicate checks.':'This comparison reflects the routine categories you entered in My Shelf.';
 $('#view-compare').innerHTML=`${title('YOUR PRODUCT SHORTLIST','The comparison lab','Explore fictional skincare concepts side by side, understand which routine steps you already own, and make more considered decisions. No live merchant data or checkout.')}
 <div class="compare-hero"><div><div class="eyebrow">SIDE-BY-SIDE · ZERO PRESSURE TO BUY</div><h2>Keep the routine.<br><em>Skip the guesswork.</em></h2><p>Compare up to ${MAX_COMPARE} illustrative ideas by category, description, tags, budget fit and shelf overlap—without inventing scores, ratings or clinical benefits.</p>
 <div class="compare-hero-actions"><button class="primary" data-go="shop">Explore product library →</button>${selected.length?'<button class="ghost" id="compare-clear" type="button">Clear comparison</button>':''}</div>
 </div><div class="compare-hero-count"><strong>${selected.length}<span> / ${MAX_COMPARE}</span></strong><small>concepts selected</small></div></div>
 <div class="compare-summary-grid">
 <div class="compare-summary-card"><span>Compared concepts</span><strong>${selected.length}</strong><small>Fictional product examples only</small></div>
 <div class="compare-summary-card"><span>Combined example price</span><strong>${money(model.total)}</strong><small>${model.withinCombinedBudget?'Within your demo budget':'Above your demo budget'} · not an order</small></div>
 <div class="compare-summary-card"><span>Overlap with your real shelf</span><strong>${model.ownedOverlap}</strong><small>Category matches, not ingredient duplicates</small></div></div>
 <section class="compare-selection-section"><div class="compare-section-head"><div><div class="eyebrow">STEP 01 · BUILD A SHORTLIST</div><h2>Select concepts to compare</h2><p>${escape(sourceShelf)} Selected ideas are saved as product IDs in this browser, independently of your cart.</p></div><div id="compare-candidate-count" class="catalog-count" role="status" aria-live="polite"></div></div>
 <div class="compare-filter-bar"><div class="field"><label for="compare-search">Search illustrative concepts</label><input id="compare-search" type="search" maxlength="80" placeholder="Try mineral, serum, gel…" value="${escape(state.compareQuery)}"></div>
 <div class="field"><label for="compare-step">Routine category</label><select id="compare-step">${COMPARE_FILTER_STEPS.map(step=>`<option value="${step}" ${state.compareStep===step?'selected':''}>${step==='all'?'All categories':escape(stepLabels[step])}</option>`).join('')}</select></div>
 <button class="tiny-btn" id="compare-reset-filters" type="button">Clear filters</button></div>
 <div class="compare-candidate-grid" id="compare-candidate-list"></div></section>
 <section class="compare-detail-section"><div class="compare-section-head"><div><div class="eyebrow">STEP 02 · UNDERSTAND YOUR OPTIONS</div><h2>Side-by-side decision board</h2><p>${escape(model.note)}</p></div><span class="label-pill peach">ILLUSTRATIVE DATA</span></div>
 ${selected.length?`<div class="compare-table-scroll" role="region" aria-label="Scrollable side-by-side comparison" tabindex="0">
 <table class="compare-matrix"><thead><tr><th scope="col">Comparison area</th>${selected.map(p=>`<th scope="col"><div class="compare-matrix-head"><span class="eyebrow">CONCEPT PRODUCT</span><strong>${escape(p.name)}</strong><small>${escape(stepLabels[p.step])}</small><button class="tiny-btn" type="button" data-compare="${escape(p.id)}">Remove ×</button></div></th>`).join('')}</tr></thead><tbody>
 <tr><th scope="row">Example price</th>${renderValue(p=>`<strong class="compare-price">${money(p.price)}</strong><small>Illustrative USD, not a merchant offer</small>`)}</tr>
 <tr><th scope="row">Routine category</th>${renderValue(p=>`<strong>${escape(stepLabels[p.step])}</strong>`)}</tr>
 <tr><th scope="row">Designed concept</th>${renderValue(p=>`<span>${escape(p.description)}</span>`)}</tr>
 <tr><th scope="row">Descriptive tags</th>${renderValue(p=>`<div class="compare-tag-list">${p.tags.map(tag=>`<span>${escape(tag)}</span>`).join('')}</div>`)}</tr>
 <tr><th scope="row">Your chosen cosmetic focus</th>${renderValue(p=>`<span class="compare-indicator ${p.goalMatch?'good':'neutral'}">${p.goalMatch?'Tagged for your stated focus':'No specific concept tag match'}</span><small>Catalog tags only · not an efficacy prediction</small>`)}</tr>
 <tr><th scope="row">Your fragrance-free filter</th>${renderValue(p=>`<span class="compare-indicator ${p.excludesPreference?'warn':'neutral'}">${state.fragranceFree?(p.excludesPreference?'Not tagged fragrance-free':'Tagged fragrance-free'):'Filter is currently off'}</span><small>Catalog metadata; not ingredient verification</small>`)}</tr>
 <tr><th scope="row">Your existing shelf</th>${renderValue(p=>`<span class="compare-indicator ${status(p).className}">${escape(status(p).label)}</span><small>${escape(status(p).detail)}</small>`)}</tr>
 <tr><th scope="row">Individual budget fit</th>${renderValue(p=>`<span class="compare-indicator ${p.withinBudget?'good':'warn'}">${p.withinBudget?'Within '+money(model.budget):'Above '+money(model.budget)}</span><small>Compared separately, not as a real purchase</small>`)}</tr>
 <tr><th scope="row">Save for later</th>${renderValue(p=>`<button class="tiny-btn" type="button" data-save="${escape(p.id)}">${p.saved?'♥ Unsave':'♡ Save idea'}</button>`)}</tr>
 </tbody></table></div>
 <div class="compare-decision-summary"><div><strong>${model.hasAlternatives?'Compare alternatives, not quantities.':'A clearer way to decide.'}</strong><p>${model.hasAlternatives?'Two or more selections share one routine category; the comparison total is not a purchase recommendation. ':''}${model.ownedOverlap?'At least one selected category is already on your own shelf. ':''}${model.preferenceExcluded?'Some ideas do not meet your selected catalog tag filter. ':''}Descriptions, prices and tags are fictional illustrative data, not product-performance evidence.</p></div><button class="secondary" data-go="trail">Explore decision logic →</button></div>`:
 `<div class="compare-empty-state"><div aria-hidden="true">⇄</div><h3>Start with a pair of ideas.</h3><p>Choose two or three concepts above to build a side-by-side decision table. You can compare one concept too, but the differences become clearer with a pair.</p><button class="secondary" data-go="shop">Browse the Shopping Studio →</button></div>`}
 </section><div class="compare-safety-note"><div><div class="eyebrow">IMPORTANT CONTEXT</div><h3>What this comparison does not claim</h3><p>No verified ingredients, clinical outcomes, skin compatibility, sunscreen effectiveness, merchant availability, ratings, or live checkout. YouCam observations remain separate from product efficacy claims. Your selected IDs are stored only in this browser.</p></div><button class="tiny-btn" data-go="shelf">Review real shelf →</button></div>`;
 renderComparePicker();
}
function renderPrivacy(){
 const data=describeDataState({shelf:state.shelf,sampleInventory:state.sampleInventory,savedIds:state.savedIds,compareIds:state.compareIds,routineLog:state.routineLog,savedLiveReport:state.savedLiveReport,pending:state.pending,hasPhoto:!!state.file||!!state.preview,cartIds:state.cartIds});
 const presence=readStoragePresence(localStorage,sessionStorage);
 const rows=data.groups.map(group=>{
  const stored=presence.find(p=>p.id===group.id)||{};
  const status=stored.unavailable?'STORAGE RESTRICTED':stored.exists?'STORED LOCALLY':'NOT STORED';
  const symbols={shelf:'▧',ideas:'♡',comparison:'⇄',checklist:'☑',liveReport:'◎',pending:'◌'};
  return `<div class="privacy-row">
   <span class="privacy-row-symbol" aria-hidden="true">${symbols[group.id]}</span>
   <div class="privacy-row-content"><div class="privacy-row-head"><strong>${escape(group.title)}</strong><span class="privacy-data-status ${stored.exists?'stored':''}">${status}</span></div>
   <p>${escape(group.description)}</p><small>${escape(group.status)} · ${group.keys[0].scope==='session'?'This browser tab':'This browser'}</small></div>
   <button class="tiny-btn" data-privacy-erase="${group.id}" type="button" ${!stored.exists||stored.unavailable?'disabled':''}>Erase</button></div>`;
 }).join('');
 const metrics=[['Owned products',String(data.realProducts),state.sampleInventory?'Example shelf excluded':'Your actual entries'],
 ['Saved ideas',String(state.savedIds.length),'Fictional concepts'],
 ['Comparisons',String(state.compareIds.length),'Separate from demo cart'],
 ['Photo in memory',data.hasPhoto?'Yes':'No','Not saved locally by this app']];
 const stats=metrics.map(item=>`<div><span>${escape(item[0])}</span><strong>${escape(item[1])}</strong><small>${escape(item[2])}</small></div>`).join('');
 $('#view-privacy').innerHTML=title('YOUR CONTROL','Privacy & data center','See what this browser remembers, export real shelf entries, and erase only the RoutineGap data you choose. Browser erasure never deletes provider-side records or previously downloaded files.')+
 `<section class="privacy-hero"><div><div class="eyebrow">CLARITY · CONTROL · CONSENT</div><h2>It is your routine. <em>It is your data.</em></h2>
 <p>Everyday preferences stay in this browser. Uploading an image for a real YouCam analysis is a separate, optional action that sends the selected image to Perfect Corp.</p>
 <div class="privacy-hero-actions"><button class="primary" data-go="shelf">Manage my shelf →</button><button class="ghost" data-go="scan">Review scan consent →</button></div></div><span class="privacy-hero-icon" aria-hidden="true">◉</span></section>
 <div class="privacy-stats">${stats}</div>
 <div class="privacy-layout"><section class="panel privacy-main-panel"><div class="eyebrow">YOUR BROWSER STORAGE</div><h2>Choose what to keep.</h2>
 <p class="muted small">Data is divided into independent groups. Delete an individual group or remove every known RoutineGap browser key. Changes are confirmed before deletion.</p>
 <div class="privacy-rows">${rows}</div><div class="privacy-danger-area"><p>Deleting local data reloads the application and also clears temporary in-memory photo selections. It cannot reverse an already submitted live scan.</p>
 <button id="privacy-clear-all" type="button" class="privacy-danger-button">Erase all RoutineGap browser data →</button></div></section>
 <aside class="privacy-side"><section class="privacy-card privacy-export"><div class="eyebrow">DOWNLOAD A COPY</div><h3>Your inventory is portable.</h3>
 <p>Export your own shelf products and preferences as validated JSON. Backups never include selfies, scan observations, API keys or task references.</p>
 <button type="button" class="secondary" id="privacy-export-shelf" ${state.sampleInventory?'disabled title="Sample inventory is not genuine ownership"':''}>↓ Export real shelf (.json)</button>
 <button type="button" class="tiny-btn" id="privacy-export-brief">↓ Export decision brief (.md)</button></section>
 <section class="privacy-card"><div class="eyebrow">WHAT GOES WHERE</div><h3>Data lifecycle</h3>
 <div class="privacy-flow"><div><b>01 · Local workspace</b><p>Products, saved concept IDs, checklist data, and preferences are stored in this browser, not sent to YouCam for shopping.</p></div>
 <div><b>02 · Opt-in skin scan</b><p>A selected face photo is transmitted to Perfect Corp only after the separate scan-consent action. A resumable task reference can remain in this tab.</p></div>
 <div><b>03 · Export and erasure</b><p>Downloads stay on your device. Removing browser storage does not remove uploaded images or revoke already-running provider tasks.</p></div></div></section></aside></div>
 <section class="privacy-reminder"><div><div class="eyebrow">IMPORTANT LIMITATION</div><h2>Local deletion ≠ provider deletion.</h2>
 <p>If a live scan was submitted, clearing a browser reference does not cancel it or remove data already processed by Perfect Corp. Deletion of provider-held information requires the provider's applicable process.</p></div>
 <button data-go="scan" class="secondary">Go to skin analysis →</button></section>`;
}
function erasePrivacyData(category){
 if(!ERASE_CATEGORIES.includes(category))return;
 const all=category==='all';
 const name=all?'all RoutineGap browser data':DATA_GROUPS.find(g=>g.id===category).title.toLowerCase();
 const providerWarning=['all','pending','liveReport'].includes(category)?' This does not cancel a remote YouCam task or remove any provider-side image or report.':'';
 const prompt='Erase '+name+' permanently on this device?'+providerWarning+' This cannot be undone.';
 if(!window.confirm(prompt))return;
 try{
  const result=eraseOwnedStorage(category,{local:localStorage,session:sessionStorage});
  if(!result.removedKeys.length)throw new Error('No browser keys were selected.');
  window.location.reload();
 }catch(error){notice(error.message||'Could not verify deletion. Please check browser storage settings.',true);renderPrivacy();}
}
function renderTrail(d){const rows=[{n:'01',title:'Cosmetic observation',body:state.scanSource==='live'?'Real YouCam Skin Analysis observations were returned. These vendor scores are not diagnoses.':state.scanSource==='sample'?'You selected a labeled illustrative scan. None of these scores came from the live API.':'No scan result yet. Your choices rely solely on your own stated preferences.'},{n:'02',title:'Your stated preference',body:`You chose “${goals.find(g=>g.id===state.goal)?.name||'Simple routine'}” as a shopping goal. ${state.goalFromScan?'You explicitly selected this after viewing '+(state.goalFromScan==='live'?'your real YouCam report':'an illustrative example')+'. ':''}This goal is user-selected, not inferred as a medical condition or diagnosis.`},{n:'03',title:'What you already own',body:`You have ${d.owned.length} products recorded. Routine steps in your shelf: ${[...new Set(d.owned.map(x=>stepLabels[x.step]))].join(', ')||'none yet'}.`},{n:'04',title:'Budget & exclusions',body:`We use your ${money(d.budget)} spending limit and ${state.fragranceFree?'restrict the illustrative catalog to products tagged fragrance-free':'do not apply a fragrance-free catalog filter'}.`},{n:'05',title:'Why we skip duplicates',body:`${d.skippedRedundant} catalog options match steps you already own. Our conservative heuristic says “Use your shelf” for those steps.`},{n:'06',title:'Human decision',body:'Any cart selections are yours. Neither the YouCam scores nor RoutineGap can establish treatment efficacy, allergy safety or what is medically appropriate.'}];$('#view-trail').innerHTML=`${title('EXPLAINABILITY','The decision trail','A full breakdown of where each shopping suggestion comes from. We separate provider-generated observations from human preferences and product-matching rules.')}
<div class="two-col"><div class="panel"><div class="eyebrow">THE LOGIC, STEP BY STEP</div><div style="margin-top:22px">${rows.map(x=>`<div class="trail-step"><span class="num">${x.n}</span><div class="timeline-card"><strong>${escape(x.title)}</strong><p class="muted small">${escape(x.body)}</p></div></div>`).join('')}</div></div><div><div class="panel"><div class="eyebrow">TRANSPARENCY LABELS</div><div class="list-row"><span>YouCam cosmetic scores</span><span class="label-pill">VENDOR OUTPUT, IF LIVE</span></div><div class="list-row"><span>Shopping priorities</span><span class="label-pill peach">USER PREFERENCES</span></div><div class="list-row"><span>Duplicate detection</span><span class="label-pill">DETERMINISTIC HEURISTIC</span></div><div class="list-row"><span>Catalog prices</span><span class="label-pill peach">ILLUSTRATIVE</span></div><div class="separator"></div><p class="muted small">The provider describes UI scores as cosmetically adjusted presentation scores. We show them as received and do not present them as probability, clinical severity, or causal evidence that a product will work.</p><div class="report-export-action"><button type="button" class="secondary" id="export-decision"><span aria-hidden="true">↓</span> Download decision brief (.md)</button><p class="muted small">Save a local report of your cosmetic observations, chosen priorities, current shelf, duplicates, and real cart-versus-budget total. Clearly labels sample data and excludes your photo and all credentials.</p></div><button class="secondary" data-go="shop">Back to shopping →</button></div><div class="panel" style="margin-top:18px"><h3>Privacy by design</h3><p class="muted small">Skin photos remain in browser memory until you explicitly request live analysis. On live analysis the photo is sent to Perfect Corp using its documented file upload flow. We do not store photo files in our application's database. For privacy, do not use another person's photo without consent. Remove browser-owned inventory from My Shelf at any time.</p><p class="muted small">YouCam API documentation: <a target="_blank" rel="noopener noreferrer" href="https://docs.perfectcorp.com/reference/ai_skin_analysis">Skin Analysis reference ↗</a></p></div></div></div>`;}
function updatePrefs(){const x=$('#budget'),y=$('#goal'),z=$('#fragrance');if(!x||!y||!z)return;state.budget=Math.max(0,Math.min(1000,Number(x.value)||0));state.goal=y.value;state.goalFromScan=null;state.fragranceFree=z.checked;state.cartIds=[];persist();renderShop(decide());}
let imageSelection=0;
function storeFile(file){
  if(state.preparing)return notice('Local photo preparation is in progress.',true);
  const generation=++imageSelection;
  if(state.preview){URL.revokeObjectURL(state.preview);state.preview=null;}
  state.file=null;state.sourceFile=null;state.imageReady=false;state.imageDimensions=null;
  state.consent=false;state.photoSelfChecks={};
  state.canPrepare=false;state.photoPlan=null;
  if(!file){renderScan();notice('No photo selected.');return;}
  if(!['image/jpeg','image/png'].includes(file.type)||file.size>PHOTO_SOURCE_MAX_BYTES||file.size<1500){
    renderScan();notice('Choose an original JPG or PNG between 1.5 KB and 24 MB. The final upload must be under 8 MB.',true);return;
  }
  state.sourceFile=file;
  state.preview=URL.createObjectURL(file);
  renderScan();
  notice('Checking the photo dimensions privately on this device. Nothing has been uploaded.');
  const probe=new Image();
  probe.onload=()=>{
    if(generation!==imageSelection)return;
    const w=probe.naturalWidth,h=probe.naturalHeight;
    const plan=planLocalPhoto({width:w,height:h,size:file.size,type:file.type});
    state.imageDimensions={width:w,height:h};
    state.imageReady=plan.status==='ready';
    state.canPrepare=plan.status==='prepare';
    state.photoPlan=plan;
    state.file=state.imageReady?file:null;
    renderScan();
    notice(state.imageReady?'Photo ready ('+w+' × '+h+' px). No photo uploaded. Click Analyze with YouCam to start.':plan.reason,plan.status!=='prepare'&&!state.imageReady);
  };
  probe.onerror=()=>{
    if(generation!==imageSelection)return;
    state.imageReady=false;state.canPrepare=false;renderScan();
    notice('Unable to decode this image. Choose another original JPG or PNG.',true);
  };
  probe.src=state.preview;
}
async function prepareSelectedPhoto(){
  if(state.busy||state.preparing)return;
  if(!state.sourceFile||!state.canPrepare)return notice('Choose an oversized, clear JPG or PNG original first.',true);
  const generation=imageSelection;
  const original=state.sourceFile;
  state.preparing=true;renderScan();
  notice('Preparing a smaller JPEG copy locally. No photo is being uploaded.');
  try{
    const converted=await preparePhotoLocally(original);
    if(generation!==imageSelection)return;
    if(state.preview)URL.revokeObjectURL(state.preview);
    state.file=converted.file;state.sourceFile=converted.file;
    state.preview=URL.createObjectURL(converted.file);
    state.imageDimensions={width:converted.width,height:converted.height};
    state.imageReady=true;state.canPrepare=false;
    state.photoPlan={status:'ready',width:converted.width,height:converted.height};
    notice('Photo prepared locally: '+converted.width+' × '+converted.height+' px, '+(converted.file.size/1024/1024).toFixed(2)+' MB. Original was not uploaded. You can now consent and start a YouCam scan.');
  }catch(error){
    if(generation===imageSelection)notice(error?.message||'Photo could not be prepared locally. Use a clearer original or Squoosh.',true);
  }finally{
    if(generation===imageSelection){state.preparing=false;renderScan();drawMessage();}
  }
}
function setSample(){
  state.goalFromScan=null;
  if(state.busy)return notice('The live scan is still processing. Wait until it finishes before opening the example.',true);
  state.scan=sampleScan.map(x=>({...x}));state.scanSource='sample';navigate('scan');
  notice('Illustrative sample loaded. These scores were not generated by the YouCam API.');
}
async function resumePendingScan(){
  if(state.busy)return;
  if(!state.pending)return notice('There is no saved scan to resume.',true);
  if(!state.liveEnabled)return notice('YouCam is not currently connected. Your pending session was not discarded.',true);
  if(!state.code)return notice('Enter your private demo passcode to resume the existing scan.',true);
  state.busy=true;state.scan=null;state.scanSource=null;renderScan();
  notice('Resuming your existing YouCam task without re-uploading the photo or starting another paid request.');
  try{
    let completed=false;
    for(let i=0;i<17;i++){
      if(i>0)await new Promise(resolve=>setTimeout(resolve,7000));
      const response=await fetch('/api/scan/status',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-Demo-Access':state.code},
        body:JSON.stringify({receipt:state.pending.receipt})
      });
      let result;
      try{result=await response.json();}catch{throw Error('YouCam returned an unreadable task-status response. Resume this scan later.');}
      if(!response.ok){
        if(response.status===404){savePendingScan(null);throw Error('The saved scan session expired or became invalid. Your earlier provider result could not be recovered.');}
        throw Error(result.error||'Could not retrieve the existing scan. Resume the same session later.');
      }
      if(result.state==='error'){
        savePendingScan(null);throw Error(result.message||'YouCam could not analyze the photo. A clearer original may be needed.');
      }
      if(result.state==='success'){
        if(!Array.isArray(result.signals)||!result.signals.length)throw Error('YouCam returned no usable skin observations. The existing scan is still available for inspection.');
        state.scan=result.signals;state.scanSource='live';savePendingScan(null);completed=true;break;
      }
      notice('YouCam is still processing your existing task — check '+(i+1)+' of 17. You can come back and resume without re-uploading.');
    }
    if(!completed)throw Error('The provider task is still running. Your session was saved; press Resume existing scan later rather than starting another request.');
    notice('Your real YouCam cosmetic report is ready. These are vendor observations, not medical diagnoses.');
  }catch(error){notice(error?.message||'Could not finish checking this task. Your session remains available for resuming.',true);}
  finally{state.busy=false;renderScan();drawMessage();}
}
async function scanLive(){
  if(state.busy)return;
  if(state.pending)return notice('An existing scan is still pending. Resume it rather than paying for another scan; discard the saved session only if you intend to start a new one.',true);
  if(!state.liveEnabled)return notice('The YouCam API is not currently authenticated.',true);
  if(state.preparing)return notice('Wait for local photo preparation to finish.',true);if(!state.file)return notice('Select a suitable JPG or PNG photo first. If it is too large, use Prepare photo on this device.',true);
  if(!state.imageReady)return notice('The selected photo must satisfy the YouCam resolution requirements before uploading.',true);
  if(!state.consent)return notice('Photo-processing consent is required before sending your image.',true);
  if(!state.code)return notice('Enter the protected live demo passcode.',true);
  state.busy=true;state.scan=null;state.scanSource=null;state.goalFromScan=null;renderScan();
  notice('Uploading your consented photo to YouCam and requesting a new skin analysis task…');
  try{
    const response=await fetch('/api/scan',{
      method:'POST',
      headers:{'Content-Type':state.file.type,'X-Image-Filename':state.file.name,
        'X-Skin-Consent':'yes','X-Demo-Access':state.code},
      body:state.file
    });
    let data;
    try{data=await response.json();}catch{throw Error('The server returned an unreadable response. Check with the project owner before sending the photo again.');}
    if(!response.ok)throw Error(data.error||'Could not start the YouCam scan.');
    if(!data.receipt)throw Error('The provider task was started but no recovery receipt was returned. Contact the owner before resubmitting the photo.');
    savePendingScan({receipt:data.receipt,createdAt:Date.now()});
    // Starting a new provider task invalidates any explicitly saved older report.
    try{sessionStorage.removeItem(LIVE_REPORT_SESSION_KEY);}catch{}
    state.savedLiveReport=false;
    notice('The task started. Your private recovery receipt is saved for this tab. No second upload is needed.');
  }catch(error){notice(error?.message||'The scan could not start. No sample result was substituted.',true);}
  finally{state.busy=false;renderScan();drawMessage();}
  if(state.pending)await resumePendingScan();
}

function saveLiveReportInTab(){
  if(state.busy||state.scanSource!=='live'||!Array.isArray(state.scan)||!state.scan.length)
    return notice('Only a completed, real YouCam cosmetic report can be saved in this tab.',true);
  try{
    const cleaned=makePrivateReport(state.scan);
    sessionStorage.setItem(LIVE_REPORT_SESSION_KEY,JSON.stringify(cleaned));
    state.savedLiveReport=true;renderScan();
    notice('Only cosmetic observations were saved in this tab. Your photo, API key, passcode and scan receipt were not stored.');
  }catch{notice('Tab-only report storage is unavailable. You can download a decision brief instead.',true);}
}
function forgetLiveReportInTab(){
  try{sessionStorage.removeItem(LIVE_REPORT_SESSION_KEY);}catch{}
  state.savedLiveReport=false;renderScan();
  notice('Saved report removed. The currently open report remains visible until you refresh.');
}
function downloadDecisionBrief(){
  try{
    const decision=decide();
    const markdown=createDecisionBrief({
      decision,cartIds:state.cartIds,scanSource:state.scanSource,signals:state.scan||[],
      goalFromScan:state.goalFromScan,sampleInventory:state.sampleInventory,
      generatedAt:new Date().toISOString().slice(0,10)
    });
    const blob=new Blob([markdown],{type:'text/markdown;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download='routinegap-decision-brief.md';
    document.body.appendChild(link);
    link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    notice('Decision brief downloaded locally. No photo, provider credentials or demo passcode is included.');
  }catch{notice('Could not export the brief in this browser. Please try again.',true);}
}

/* One keyboard-accessible local search for the eight actual workspaces and concept catalog. */
let commandReturnFocus=null;
function renderCommandResults(){
 const results=searchWorkspace(state.globalSearchQuery,{catalog,shelf:state.shelf,sampleInventory:state.sampleInventory,maxResults:10});
 const region=$('#command-results');if(!region)return;
 region.innerHTML=results.length?results.map((item,index)=>{
   const group=item.type==='page'?'WORKSPACE':item.type==='owned'?'YOUR INVENTORY':'ILLUSTRATIVE CONCEPT';
   return `<button type="button" class="command-result" data-command-index="${index}">
     <span class="command-result-icon ${item.type}" aria-hidden="true">${item.type==='page'?'◫':item.type==='owned'?'▧':'◇'}</span>
     <span class="command-result-label"><strong>${escape(item.title)}</strong><small>${escape(item.detail)}</small></span>
     <span class="command-result-type">${group}</span>
   </button>`;
 }).join(''):'<div class="command-empty">No matching pages or concepts. Try “routine”, “SPF” or “compare”.</div>';
 const status=$('#command-hint');if(status)status.textContent=state.globalSearchQuery?
   results.length+' local results. Private searches never leave this browser.':'Search pages and fictional concepts—or products you have entered into My Shelf.';
}
function openWorkspaceSearch(){
 const overlay=$('#workspace-search-overlay');if(!overlay||!overlay.hidden)return;
 if(state.storyId)closeConceptStory({restoreFocus:false});
 commandReturnFocus=document.activeElement;
 state.globalSearchQuery='';
 $('#command-search-input').value='';
 overlay.hidden=false;
 document.body.classList.add('is-command-open');
 $('#open-workspace-search')?.setAttribute('aria-expanded','true');
 renderCommandResults();
 $('#command-search-input').focus();
}
function closeWorkspaceSearch({restoreFocus=true}={}){
 const overlay=$('#workspace-search-overlay');if(!overlay||overlay.hidden)return;
 overlay.hidden=true;
 document.body.classList.remove('is-command-open');
 $('#open-workspace-search')?.setAttribute('aria-expanded','false');
 if(restoreFocus&&commandReturnFocus&&typeof commandReturnFocus.focus==='function')commandReturnFocus.focus();
 commandReturnFocus=null;
}
function activateCommandResult(index){
 const results=searchWorkspace(state.globalSearchQuery,{catalog,shelf:state.shelf,sampleInventory:state.sampleInventory,maxResults:10});
 const entry=results[index];if(!entry)return;
 if(entry.type==='concept'){
   const selected=catalog.find(p=>p.id===entry.id);if(!selected)return;
   state.catalogQuery=selected.name;state.catalogStep='all';state.catalogDecision='all';
   state.savedOnly=false;state.affordableOnly=false;state.catalogSort='recommended';
 }else if(entry.type==='owned'){
   const selected=state.shelf.find(p=>p.id===entry.id);if(!selected||state.sampleInventory)return;
   state.shelfQuery=selected.name;
 }
 closeWorkspaceSearch({restoreFocus:false});
 navigate(entry.tab);
 if(entry.type==='concept')openConceptStory(entry.id);
}
document.addEventListener('keydown',event=>{
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
   event.preventDefault();
   if($('#workspace-search-overlay')?.hidden)openWorkspaceSearch();
   else closeWorkspaceSearch();
   return;
 }
 const overlay=$('#workspace-search-overlay');
 if(!overlay||overlay.hidden)return;
 if(event.key==='Escape'){event.preventDefault();closeWorkspaceSearch();return;}
 const field=$('#command-search-input');
 const buttons=[...overlay.querySelectorAll('[data-command-index]')];
 if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();
   const index=buttons.indexOf(document.activeElement);
   if(event.key==='ArrowDown') (buttons[(index+1)%buttons.length]||field)?.focus();
   else (index<=0?field:buttons[index-1])?.focus();
   return;
 }
 if(event.key==='Enter'&&document.activeElement===field&&buttons.length){
   event.preventDefault();activateCommandResult(0);return;
 }
 if(event.key==='Tab'){
   const focusable=[field,$('#close-workspace-search'),...buttons].filter(Boolean);
   const first=focusable[0],last=focusable[focusable.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
});

let storyReturnFocus=null;
function renderConceptStory(){
 const overlay=$('#concept-story-overlay'),region=$('#concept-story-content');
 if(!overlay||overlay.hidden||!region||!state.storyId)return;
 const d=decide(),p=buildConceptStory({id:state.storyId,catalog,decisionRows:d.rows,owned:d.owned,sampleInventory:state.sampleInventory,budget:state.budget,goal:state.goal,fragranceFree:state.fragranceFree});
 if(!p){closeConceptStory();return;}
 const focused=document.activeElement;
 const action=focused?.dataset?.save?'save':focused?.dataset?.cart?'cart':focused?.dataset?.compare?'compare':null;
 const saved=state.savedIds.includes(p.id),compared=state.compareIds.includes(p.id),cart=state.cartIds.includes(p.id);
 region.innerHTML=`<div class="story-layout"><div class="story-media">
 <div class="story-concept-art art-${escape(p.step)}" aria-hidden="true"><div class="story-pack"><div class="story-pack-cap"></div><div class="story-pack-body"><small>routinegap.</small><b>${escape(stepLabels[p.step])}</b><em>CONCEPT</em></div></div></div>
 <div class="story-art-caption">FICTIONAL CONCEPT · NOT A PRODUCT PHOTO</div><div class="story-art-facts"><span>NO MERCHANT INVENTORY</span><span>NO VERIFIED FORMULA</span><span>NO REAL CHECKOUT</span></div></div>
 <div class="story-content"><div class="eyebrow">${escape(p.brand)} · ${escape(stepLabels[p.step])}</div>
 <h2 id="story-title">${escape(p.name)}</h2><p id="story-summary" class="story-lead">${escape(p.description)}</p>
 <div class="story-purchase-row"><div><strong>${money(p.price)}</strong><small>Example USD price, not a merchant offer</small></div><span class="label-pill ${p.demoCovered?'peach':''}">${escape(p.storyLabel)}</span></div>
 <div class="story-actions"><button class="primary" type="button" data-cart="${escape(p.id)}" ${p.demoCovered?'disabled title="This demo scenario already covers this category"':''}>${p.demoCovered?(p.sampleInventory?'Covered in starter demo':'Already represented on shelf'):cart?'✓ Remove from demo cart':'＋ Add to demo cart'}</button>
 <button class="secondary" type="button" data-save="${escape(p.id)}" aria-pressed="${saved}">${saved?'♥ Saved idea':'♡ Save idea'}</button>
 <button class="secondary" type="button" data-compare="${escape(p.id)}" aria-pressed="${compared}">${compared?'✓ In comparison':'⇄ Compare'}</button></div>
 <p class="story-local-caption">All three actions are fictional planning tools. No purchase, transaction or provider request is made.</p>
 <section class="story-reason"><div class="eyebrow">EXPLAINABLE RECOMMENDATION</div><h3>Why this concept?</h3><p>${escape(p.reason)}</p></section>
 <div class="story-fit-grid">
 ${[['Real shelf coverage',p.duplicate?'Already represented':p.sampleInventory?'Starter shelf excluded':'Not recorded as owned'],['Demo budget',p.individuallyAffordable?'Within '+money(p.demoBudget):'Over '+money(p.demoBudget)],['Fragrance-free tag',p.fragranceTagged?'Illustrative tag present':'Not tagged fragrance-free'],['Stated focus',p.goalTagged?'Concept-tag match':'No matching concept tag']].map(([a,b])=>`<div><span>${escape(a)}</span><strong>${escape(b)}</strong></div>`).join('')}</div>
 ${p.sampleInventory&&p.demoCovered?`<section class="story-owned-notice"><strong>This is demo-shelf coverage, not real ownership</strong><p>Illustrative starter entries include this category. Enter your actual products to personalize duplicate prevention.</p><button class="tiny-btn" data-go="shelf">Set up my real shelf →</button></section>`:""}
 ${p.existing.length?`<section class="story-owned-notice"><strong>You already recorded a ${escape(stepLabels[p.step].toLowerCase())}</strong><p>${escape(p.existing.join(' · '))}</p><button class="tiny-btn" data-go="shelf">See my real shelf →</button></section>`:''}
 <section class="story-education"><div class="eyebrow">EDUCATIONAL CATEGORY CONTEXT</div><h3>${escape(p.category.heading)}</h3>
 <div><strong>Routine placement</strong><p>${escape(p.category.placement)}</p></div>
 <div><strong>How to compare</strong><p>${escape(p.category.intent)}</p></div>
 <div><strong>What to verify</strong><p>${escape(p.category.caution)}</p></div></section>
 <section class="story-tag-explain"><div class="eyebrow">TAG GLOSSARY · NOT INGREDIENT VERIFICATION</div><h3>What's behind the labels?</h3>
 ${p.tags.map(t=>`<div><span>${escape(t.label)}</span><p>${escape(t.meaning)}</p></div>`).join('')}</section>
 <section class="story-alternatives"><div class="eyebrow">ALTERNATIVES WITHIN THE SAME CATEGORY</div><h3>Three more concepts to explore</h3>
 ${p.related.map(item=>`<button class="story-alternative" data-open-story="${escape(item.id)}" type="button"><span><strong>${escape(item.name)}</strong><small>${escape(stepLabels[item.step])} · illustrative alternative</small></span><b>${money(item.price)}</b><span aria-hidden="true">↗</span></button>`).join('')}
 <button class="tiny-btn" data-go="compare">Open Compare Lab →</button></section>
 <p class="story-disclosure">${escape(p.disclosure)} Cosmetic YouCam signals do not establish the effectiveness of these examples.</p>
 </div></div>`;
 if(action)region.querySelector(`[data-${action}]`)?.focus({preventScroll:true});
}
function openConceptStory(id){
 if(!catalog.some(p=>p.id===id))return;
 const o=$('#concept-story-overlay');if(!o)return;
 if($('#workspace-search-overlay')&&!$('#workspace-search-overlay').hidden)closeWorkspaceSearch({restoreFocus:false});
 if(o.hidden)storyReturnFocus=document.activeElement;
 state.storyId=id;o.hidden=false;document.body.classList.add('is-story-open');
 renderConceptStory();$('#close-concept-story')?.focus({preventScroll:true});
}
function closeConceptStory({restoreFocus=true}={}){
 const o=$('#concept-story-overlay');if(!o||o.hidden)return;
 const oldId=state.storyId;
 o.hidden=true;state.storyId=null;document.body.classList.remove('is-story-open');
 if(restoreFocus){const target=storyReturnFocus?.isConnected?storyReturnFocus:document.querySelector(`[data-open-story="${oldId}"]`);target?.focus({preventScroll:true});}
 storyReturnFocus=null;
}
document.addEventListener('keydown',event=>{const overlay=$('#concept-story-overlay');if(!overlay||overlay.hidden)return;if(event.key==='Escape'){event.preventDefault();closeConceptStory();return;}if(event.key==='Tab'){const controls=[...overlay.querySelectorAll('button:not([disabled])')].filter(x=>x.getClientRects().length);if(!controls.length)return;const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
document.addEventListener('click',event=>{
 const openStory=event.target.closest('[data-open-story]');if(openStory){openConceptStory(openStory.dataset.openStory);return;}
 if(event.target.closest('#close-concept-story')||event.target.closest('[data-story-close]')){closeConceptStory();return;}
 if(event.target.closest('#open-workspace-search')){openWorkspaceSearch();return;}
 if(event.target.closest('#close-workspace-search')||event.target.closest('[data-command-close]')){closeWorkspaceSearch();return;}
 const commandResult=event.target.closest('[data-command-index]');if(commandResult){activateCommandResult(Number(commandResult.dataset.commandIndex));return;}
 const tab=event.target.closest('[data-tab]');if(tab)return navigate(tab.dataset.tab);const nav=event.target.closest('[data-go]');if(nav)return navigate(nav.dataset.go);const remove=event.target.closest('[data-remove]');if(remove){if(!state.shelf.some(p=>p.id===remove.dataset.remove))return;snapshotShelf();state.shelf=state.shelf.filter(x=>x.id!==remove.dataset.remove);state.sampleInventory=state.sampleInventory&&state.shelf.length>0;finishShelfMutation(true);notice('Product removed. Use Undo change to restore it.');return;}
 const edit=event.target.closest('[data-edit]');if(edit){if(state.sampleInventory)return notice('Replace illustrative starter products with your own before editing.',true);state.editingId=edit.dataset.edit;renderShelf(decide());$('#edit-owned-name')?.focus();return;}
 if(event.target.closest('#cancel-edit')){state.editingId=null;renderShelf(decide());return;}
 if(event.target.closest('#undo-shelf')){if(!state.undoShelf)return;const prior=state.undoShelf;state.undoShelf=null;state.shelf=prior.shelf;state.sampleInventory=prior.sampleInventory;state.shelfQuery='';finishShelfMutation(true);notice('Previous shelf restored.');return;}
 if(event.target.closest('#export-shelf'))return downloadShelfBackup();
 if(event.target.closest('#import-shelf-trigger')){$('#shelf-import')?.click();return;}
 if(event.target.closest('#insights-budget-reset')){state.insightBudget=null;renderInsights();return;}
 const scenarioButton=event.target.closest('[data-scenario-budget]');if(scenarioButton){state.insightBudget=Number(scenarioButton.dataset.scenarioBudget);renderInsights();return;}
 const focus=event.target.closest('[data-scan-goal]');if(focus){
   const goal=focus.dataset.scanGoal;
   if(state.busy||!state.scan||!state.scan.some(s=>s.type===goal)||!goals.some(g=>g.id===goal))return;
   state.goal=goal;state.goalFromScan=state.scanSource;state.cartIds=[];persist();navigate('shop');
   notice('You chose the cosmetic focus yourself. Recommendations now use your selected preference, budget and owned products—not automated diagnosis or a promise that a product works.');
   return;
 }
 const eraser=event.target.closest('[data-privacy-erase]');if(eraser){erasePrivacyData(eraser.dataset.privacyErase);return;}
 if(event.target.closest('#privacy-clear-all')){erasePrivacyData('all');return;}
 if(event.target.closest('#privacy-export-shelf'))return downloadShelfBackup();
 if(event.target.closest('#privacy-export-brief'))return downloadDecisionBrief();
 const compare=event.target.closest('[data-compare]');if(compare){const id=compare.dataset.compare;const changed=toggleCompareId(state.compareIds,id,catalog);if(changed.limitReached)return notice('Compare up to '+MAX_COMPARE+' concepts at once. Remove one before adding another.',true);state.compareIds=changed.ids;try{localStorage.setItem(COMPARE_KEY,JSON.stringify(state.compareIds));}catch{notice('Comparison may not persist if browser storage is unavailable.',true);}if(state.tab==='compare'){renderCompare();$('#compare-candidate-list [data-compare="'+id+'"]')?.focus({preventScroll:true});}else if(state.tab==='shop')renderShop(decide());return;}
 if(event.target.closest('#compare-clear')){state.compareIds=[];try{localStorage.removeItem(COMPARE_KEY);}catch{}renderCompare();notice('Comparison cleared on this device. Your saved board and cart are unchanged.');return;}
 if(event.target.closest('#compare-reset-filters')){state.compareQuery='';state.compareStep='all';renderCompare();return;}
 const save=event.target.closest('[data-save]');if(save){const result=toggleSavedConcept(state.savedIds,save.dataset.save,catalog);if(result.limitReached)return notice('The saved board holds up to '+MAX_SAVED_CONCEPTS+' ideas. Remove one before adding another.',true);state.savedIds=result.saved;try{localStorage.setItem(SAVED_CONCEPTS_KEY,JSON.stringify(state.savedIds));}catch{notice('Your browser could not save this board persistently.',true);}(state.tab==='compare'?renderCompare():renderShop(decide()));return;}
 if(event.target.closest('#clear-saved')){state.savedIds=[];try{localStorage.removeItem(SAVED_CONCEPTS_KEY);}catch{}renderShop(decide());notice('Saved concept board cleared on this device.');return;}
 if(event.target.closest('#cart-clear')){state.cartIds=[];renderShop(decide());notice('Demo cart emptied. No transaction was made.');return;}
 if(event.target.closest('#reset-catalog')||event.target.closest('#reset-empty-catalog')){state.catalogQuery='';state.catalogStep='all';state.catalogDecision='all';state.catalogSort='recommended';state.savedOnly=false;state.affordableOnly=false;renderShop(decide());return;}
 if(event.target.closest('#clear-routine')){state.routineLog=null;try{localStorage.removeItem(ROUTINE_LOG_KEY);}catch{}renderRoutine(decide());notice('Today’s checklist cleared on this device.');return;}
 if(event.target.closest('#save-live-report'))return saveLiveReportInTab();if(event.target.closest('#forget-live-report'))return forgetLiveReportInTab();if(event.target.closest('#guided-demo')||event.target.closest('#demo-step-scan'))return setSample();if(event.target.closest('#export-decision'))return downloadDecisionBrief();if(event.target.closest('#prepare-photo'))return void prepareSelectedPhoto();if(event.target.closest('#sample-report'))return setSample();if(event.target.closest('#live-scan'))return void scanLive();if(event.target.closest('#resume-scan'))return void resumePendingScan();if(event.target.closest('#forget-scan')){if(state.busy)return;savePendingScan(null);renderScan();notice('Saved scan reference discarded. This does not cancel a task already running at Perfect Corp.');return;}if(event.target.closest('#reset-shelf')){if(!state.sampleInventory&&state.shelf.length&&!window.confirm('Replace your current shelf with fictional starter products? Your existing entries can be restored with Undo change on this page.'))return;snapshotShelf();state.shelf=sampleShelf.map(x=>({...x}));state.sampleInventory=true;state.shelfQuery='';finishShelfMutation(true);notice('Illustrative starter shelf loaded. This is not a record of your own products.');return;}
 if(event.target.closest('#clear-shelf')){if(state.shelf.length&&!window.confirm('Clear all '+state.shelf.length+' products? You can immediately undo this change.'))return;snapshotShelf();state.shelf=[];state.sampleInventory=false;state.shelfQuery='';finishShelfMutation(true);notice('Shelf cleared. Use Undo change to restore your entries.');return;}
 const cart=event.target.closest('[data-cart]');if(cart){state.cartIds=state.cartIds.includes(cart.dataset.cart)?state.cartIds.filter(x=>x!==cart.dataset.cart):[...state.cartIds,cart.dataset.cart];renderShop(decide());return;}
 if(event.target.closest('#cart-auto')){state.cartIds=decide().cartIds;renderShop(decide());return;}
});
document.addEventListener('change',event=>{if(event.target.matches('[data-photo-selfcheck]')){const id=event.target.dataset.photoSelfcheck;state.photoSelfChecks=toggleSelfCheck(state.photoSelfChecks,id,event.target.checked);renderPhotoReadiness();document.querySelector('[data-photo-selfcheck="'+id+'"]')?.focus({preventScroll:true});return;}if(event.target.id==='compare-step'){state.compareStep=event.target.value;renderComparePicker();return;}if(event.target.id==='shelf-import'){const file=event.target.files?.[0];event.target.value='';return void importShelfBackup(file);}if(event.target.id==='catalog-step'){state.catalogStep=event.target.value;renderCatalogResults(decide());return;}if(event.target.id==='catalog-decision'){state.catalogDecision=event.target.value;renderCatalogResults(decide());return;}if(event.target.id==='catalog-sort'){state.catalogSort=event.target.value;renderCatalogResults(decide());return;}if(event.target.id==='catalog-saved-only'){state.savedOnly=event.target.checked;renderCatalogResults(decide());return;}if(event.target.id==='catalog-affordable-only'){state.affordableOnly=event.target.checked;renderCatalogResults(decide());return;}if(event.target.matches('[data-routine-key]')){if(state.sampleInventory){notice('Illustrative items cannot count as actual activity.',true);renderRoutine(decide());return;}const plan=buildRoutinePlan(decide().owned),day=localRoutineDate();const log=toggleRoutineStep(state.routineLog,day,plan,event.target.dataset.routineKey,event.target.checked);state.routineLog=log;try{localStorage.setItem(ROUTINE_LOG_KEY,JSON.stringify(log));}catch{notice('Browser storage is unavailable; checks may disappear when you leave.',true);}renderRoutine(decide());return;}if(event.target.id==='photo-file'){storeFile(event.target.files?.[0]);return;}if(event.target.id==='consent'){state.consent=event.target.checked;renderPhotoReadiness();return;}if(['budget','goal','fragrance'].includes(event.target.id)){updatePrefs();}});
document.addEventListener('input',event=>{if(event.target.id==='command-search-input'){state.globalSearchQuery=event.target.value.slice(0,80);renderCommandResults();return;}if(event.target.id==='compare-search'){state.compareQuery=event.target.value.slice(0,80);renderComparePicker();return;}if(event.target.id==='insights-budget-slider'){state.insightBudget=Number(event.target.value);renderScenario(makeInsights({shelf:state.shelf,sampleInventory:state.sampleInventory,budget:state.budget,goal:state.goal,fragranceFree:state.fragranceFree,cartIds:state.cartIds,savedIds:state.savedIds}));return;}if(event.target.id==='shelf-search'){state.shelfQuery=event.target.value.slice(0,80);renderShelfResults(decide());return;}if(event.target.id==='catalog-search'){state.catalogQuery=event.target.value.slice(0,80);renderCatalogResults(decide());return;}if(event.target.id==='demo-passcode'){state.code=event.target.value.slice(0,120);renderPhotoReadiness();}});

/** Drag/drop is equivalent to the file chooser: no network transfer occurs. */
document.addEventListener('dragover',event=>{
 const zone=event.target.closest?.('#upload-area');if(!zone)return;
 event.preventDefault();event.dataTransfer.dropEffect='copy';zone.classList.add('is-dragover');
});
document.addEventListener('dragleave',event=>{
 const zone=event.target.closest?.('#upload-area');if(!zone)return;
 if(event.relatedTarget&&!zone.contains(event.relatedTarget))zone.classList.remove('is-dragover');
 if(!event.relatedTarget)zone.classList.remove('is-dragover');
});
document.addEventListener('drop',event=>{
 const zone=event.target.closest?.('#upload-area');if(!zone)return;
 event.preventDefault();zone.classList.remove('is-dragover');
 const files=event.dataTransfer?.files;
 if(files?.length!==1)return notice('Drop exactly one original JPG or PNG photo.',true);
 storeFile(files[0]);
});
document.addEventListener('submit',event=>{
 if(event.target.id!=='add-product'&&event.target.id!=='edit-product')return;
 event.preventDefault();
 const editing=event.target.id==='edit-product';
 const prefix=editing?'edit-owned-':'owned-';
 const name=$('#'+prefix+'name')?.value.trim()||'';
 const step=$('#'+prefix+'step')?.value;
 const rawPrice=$('#'+prefix+'price')?.value;
 const price=Number(rawPrice);
 const tags=($('#'+prefix+'tags')?.value||'').split(',').map(t=>t.trim().toLowerCase().slice(0,40)).filter(Boolean).slice(0,8);
 if(!name||name.length>90||!Object.hasOwn(stepLabels,step)||rawPrice===''||!Number.isFinite(price)||price<0||price>10000)
   return notice('Enter a product name, valid routine step and price between 0 and 10,000.',true);
 if(editing){
   if(state.sampleInventory||!state.shelf.some(p=>p.id===state.editingId))
     return notice('This product is no longer available to edit.',true);
   const original=state.shelf.find(p=>p.id===state.editingId);
   state.shelf=state.shelf.map(p=>p.id===original.id?{...p,name,step,tags,price}:p);
   state.undoShelf=null;finishShelfMutation(false);notice('Product details updated locally.');
   return;
 }
 if(!state.sampleInventory&&state.shelf.length>=SHELF_LIMIT)return notice('Your shelf is at the 60-item limit.',true);
 if(state.sampleInventory)state.shelf=[];
 state.shelf.push({id:crypto.randomUUID(),name,step,tags,price});
 state.sampleInventory=false;state.undoShelf=null;
 finishShelfMutation(true);
 notice('Product added to your local shelf. No data was sent to providers.');
});
async function loadStatus(){try{const response=await fetch('/api/status');const data=await response.json();state.providerConnection=typeof data.providerConnection==='string'?data.providerConnection:'disabled';state.liveEnabled=data.liveEnabled===true&&state.providerConnection==='authenticated';}catch{state.liveEnabled=false;state.providerConnection='failed';}render();}
loadStatus();
