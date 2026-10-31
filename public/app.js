import {catalog,goals,stepLabels,sampleShelf,sampleScan,normalizeShelf,evaluateShop} from '/recommendations.js';
import {ROUTINE_LOG_KEY,localRoutineDate,buildRoutinePlan,readRoutineLog,toggleRoutineStep,routineProgress} from '/routine-planner.js';
import {SAVED_CONCEPTS_KEY,MAX_SAVED_CONCEPTS,FILTER_STEPS,FILTER_DECISIONS,SORT_OPTIONS,normalizeSavedConcepts,toggleSavedConcept,discoverConcepts} from '/catalog-discovery.js';
import {makeShelfBackup,readShelfBackup,SHELF_BACKUP_MAX_BYTES,SHELF_LIMIT,shelfSummary} from '/shelf-transfer.js';
import {planLocalPhoto,preparePhotoLocally,PHOTO_SOURCE_MAX_BYTES} from '/photo-tools.js';
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
const state={tab:'overview',shelfQuery:'',editingId:null,undoShelf:null,savedIds:(()=>{try{return normalizeSavedConcepts(localStorage.getItem(SAVED_CONCEPTS_KEY),catalog);}catch{return [];}})(),catalogQuery:'',catalogStep:'all',catalogDecision:'all',catalogSort:'recommended',savedOnly:false,affordableOnly:false,routineLog:(()=>{try{return localStorage.getItem(ROUTINE_LOG_KEY);}catch{return null;}})(),shelf:sampleShelf.map(x=>({...x})),budget:60,goal:'moisture',fragranceFree:false,sampleInventory:true,scan:savedLiveReport?.signals||null,scanSource:savedLiveReport?'live':null,savedLiveReport:!!savedLiveReport,cartIds:[],file:null,sourceFile:null,preview:null,imageReady:false,imageDimensions:null,canPrepare:false,preparing:false,photoPlan:null,consent:false,code:'',liveEnabled:false,providerConnection:'disabled',pending:readPendingScan(),busy:false,feedback:'',isError:false,goalFromScan:null};
try{const saved=JSON.parse(localStorage.getItem('routinegap_state')||'null');if(saved&&typeof saved==='object'){
  state.shelf=normalizeShelf(saved.shelf);state.budget=Number.isFinite(saved.budget)?Math.max(0,Math.min(1000,saved.budget)):60;state.goal=goals.some(g=>g.id===saved.goal)?saved.goal:'moisture';state.fragranceFree=saved.fragranceFree===true;state.sampleInventory=saved.sampleInventory===true;
}}catch{}
function persist(){try{localStorage.setItem('routinegap_state',JSON.stringify({shelf:state.shelf,budget:state.budget,goal:state.goal,fragranceFree:state.fragranceFree,sampleInventory:state.sampleInventory}));}catch{}}
const decide=()=>evaluateShop({shelf:state.shelf,budget:state.budget,goal:state.goal,fragranceFree:state.fragranceFree});
function notice(msg,error=false){state.feedback=msg;state.isError=error;drawMessage();}
function drawMessage(){const html=state.feedback?`<div class="notice ${state.isError?'error':''}" role="status">${escape(state.feedback)}</div>`:'';const el=$('#message');if(el)el.innerHTML=html;const local=$('#scan-status');if(local)local.innerHTML=state.tab==='scan'?html:'';}
const markMode=()=>state.scanSource==='live'?'<span class="label-pill">REAL YOUCAM RESULT</span>':state.scanSource==='sample'?'<span class="label-pill peach">ILLUSTRATIVE SAMPLE • NOT YOUCAM</span>':'<span class="label-pill peach">NO SCAN YET</span>';
function navigate(tab){if(!['overview','scan','shelf','routine','shop','trail'].includes(tab))return;state.tab=tab;render();window.scrollTo({top:0,behavior:'smooth'});$('#main')?.focus({preventScroll:true});}
function render(){document.querySelectorAll('.view').forEach(el=>el.classList.toggle('hidden',el.id!==`view-${state.tab}`));document.querySelectorAll('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.tab===state.tab));$('#crumb-page').textContent=({overview:'Overview',scan:'Skin analysis',shelf:'My shelf',routine:'Routine planner',shop:'Shopping studio',trail:'Decision trail'})[state.tab];
  const d=decide();const titles={overview:renderOverview,scan:renderScan,shelf:renderShelf,routine:renderRoutine,shop:renderShop,trail:renderTrail};titles[state.tab](d);drawMessage();$('#provider-chip').textContent=state.liveEnabled?'● YouCam API key authenticated':state.providerConnection==='failed'?'● YouCam authentication failed':state.providerConnection==='checking'?'● Checking YouCam credentials':'● Sample mode available';
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
function renderScan(){const reports=state.scan||[];$('#view-scan').innerHTML=`${title('SKIN SIGNALS','The skin intelligence studio','Begin with a clear front-facing selfie for live Perfect Corp YouCam Skin Analysis, or explore an unmistakably illustrative sample. Cosmetic signals are not medical diagnoses.')}
<div class="two-col"><div class="panel"><div class="eyebrow">STEP 01 • YOUR IMAGE</div><h3 style="margin-top:9px">Start a skin-aware session</h3><div class="scan-input" id="upload-area"><div style="font-size:36px;margin-bottom:8px">◎</div><strong>${state.sourceFile?escape(state.file?.name||state.sourceFile.name):'Choose a clear JPG or PNG selfie'}</strong><p class="muted small">JPG / PNG · 480 px minimum short side · 2,560 px maximum long side · Max 8 MB for scanning · larger originals up to 24 MB can be prepared privately</p><label for="photo-file" class="photo-select-button">Choose photo</label><input id="photo-file" type="file" accept="image/jpeg,image/png" class="sr-only" aria-label="Choose selfie for YouCam analysis"><div class="photo-selected-preview">${state.preview?`<img class="photo-preview" src="${escape(state.preview)}" alt="Preview of your selected image. Nothing has been uploaded yet.">`:''}<span class="muted small">${state.sourceFile?((state.imageDimensions?state.imageDimensions.width+' × '+state.imageDimensions.height+' pixels • ':'')+(state.imageReady?'Ready for analysis':state.canPrepare?'Can be prepared privately':'Checking dimensions / not suitable for analysis')+' — not uploaded.'):'No photo selected yet.'}</span></div>${state.canPrepare?`<div class="local-prep-action"><button type="button" id="prepare-photo" class="secondary" ${state.preparing?"disabled":""}>${state.preparing?"Preparing locally…":"Prepare photo on this device →"}</button><p class="muted small">This runs entirely in your browser. It creates a smaller JPEG copy without filters or AI upscaling. No photo is sent to RoutineGap or YouCam until you explicitly start a scan.</p></div>`:""}</div><div class="consent-box" style="margin-top:14px"><label><input type="checkbox" id="consent" ${state.consent?'checked':''}><span>I understand my photo will be transferred to Perfect Corp for YouCam analysis. I have consent from the photographed person. Photos are not saved to RoutineGap's permanent database. This is a cosmetic assessment, not medical advice.</span></label></div><div class="field" style="margin-top:14px"><label for="demo-passcode">Live demo passcode (provided by project owner)</label><input id="demo-passcode" type="password" autocomplete="off" placeholder="Required only for real API calls" value="${escape(state.code)}"></div><p class="muted small">${state.liveEnabled?'YouCam API key authenticated with a free balance check. A real skin scan still needs to be tested.':state.providerConnection==='failed'?'The YouCam API key was rejected. The project owner must replace the key securely in Render before real scans can run.':state.providerConnection==='checking'?'YouCam API key verification is in progress. Reload after it finishes.':'The server is not yet connected to a YouCam API key. Sample mode works without a key.'} Real runs consume YouCam API units. The live route is intentionally protected against public credit abuse.</p><div class="panel-actions"><button id="live-scan" class="primary" ${state.busy||!state.liveEnabled||!state.imageReady||!!state.pending?'disabled':''}>${state.busy?'Working with YouCam…':state.pending?'Scan already started — resume below':'Analyze with YouCam →'}</button><button class="ghost" id="sample-report" ${state.busy?'disabled':''}>Explore example instead</button></div>
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
</section>`;}
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
      <div class="concept-actions"><button class="tiny-btn" type="button" data-cart="${escape(p.id)}" ${unavailable?'disabled title="Already have this step on your shelf"':''}>${cart?'✓ Remove from demo cart':unavailable?'Already covered':'Add to demo cart +'}</button>
      <details class="concept-detail"><summary>Why this label?</summary><p>${escape(p.reason)}</p></details></div></div>
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
      <p class="muted small">Save up to ${MAX_SAVED_CONCEPTS} ideas for comparison in this browser. Saving is not adding to cart.</p>
      ${saved.length?`<div class="catalog-saved-list">${saved.map(p=>{
        const evaluated=d.rows.find(x=>x.id===p.id);
        return `<div class="catalog-saved-item"><div><strong>${escape(p.name)}</strong><span>${escape(stepLabels[p.step])} · ${money(p.price)}</span><small>${evaluated?.decision==='skip'?'Shelf already covers this step':evaluated?.decision==='optional'?'Optional step':evaluated?'Gap to consider':'Outside current catalog filter'}</small></div><button class="concept-remove" type="button" data-save="${escape(p.id)}" aria-label="${escape('Unsave '+p.name)}">×</button></div>`;
      }).join('')}</div><button class="tiny-btn" id="clear-saved" type="button">Clear saved ideas</button>`:
      '<div class="catalog-saved-empty">♡ <span>Save an idea to compare its type and example price here.</span></div>'}
      <p class="muted small">No sign-in, external tracking or purchases. Only saved concept IDs are stored locally.</p></div>
    </aside>
  </div>`;
  renderCatalogResults(d);
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
document.addEventListener('click',event=>{const tab=event.target.closest('[data-tab]');if(tab)return navigate(tab.dataset.tab);const nav=event.target.closest('[data-go]');if(nav)return navigate(nav.dataset.go);const remove=event.target.closest('[data-remove]');if(remove){state.shelf=state.shelf.filter(x=>x.id!==remove.dataset.remove);state.sampleInventory=state.sampleInventory&&state.shelf.length>0;persist();renderShelf(decide());return;}
 const focus=event.target.closest('[data-scan-goal]');if(focus){
   const goal=focus.dataset.scanGoal;
   if(state.busy||!state.scan||!state.scan.some(s=>s.type===goal)||!goals.some(g=>g.id===goal))return;
   state.goal=goal;state.goalFromScan=state.scanSource;state.cartIds=[];persist();navigate('shop');
   notice('You chose the cosmetic focus yourself. Recommendations now use your selected preference, budget and owned products—not automated diagnosis or a promise that a product works.');
   return;
 }
 const save=event.target.closest('[data-save]');if(save){const result=toggleSavedConcept(state.savedIds,save.dataset.save,catalog);if(result.limitReached)return notice('The saved board holds up to '+MAX_SAVED_CONCEPTS+' ideas. Remove one before adding another.',true);state.savedIds=result.saved;try{localStorage.setItem(SAVED_CONCEPTS_KEY,JSON.stringify(state.savedIds));}catch{notice('Your browser could not save this board persistently.',true);}renderShop(decide());return;}
 if(event.target.closest('#clear-saved')){state.savedIds=[];try{localStorage.removeItem(SAVED_CONCEPTS_KEY);}catch{}renderShop(decide());notice('Saved concept board cleared on this device.');return;}
 if(event.target.closest('#cart-clear')){state.cartIds=[];renderShop(decide());notice('Demo cart emptied. No transaction was made.');return;}
 if(event.target.closest('#reset-catalog')||event.target.closest('#reset-empty-catalog')){state.catalogQuery='';state.catalogStep='all';state.catalogDecision='all';state.catalogSort='recommended';state.savedOnly=false;state.affordableOnly=false;renderShop(decide());return;}
 if(event.target.closest('#clear-routine')){state.routineLog=null;try{localStorage.removeItem(ROUTINE_LOG_KEY);}catch{}renderRoutine(decide());notice('Today’s checklist cleared on this device.');return;}
 if(event.target.closest('#save-live-report'))return saveLiveReportInTab();if(event.target.closest('#forget-live-report'))return forgetLiveReportInTab();if(event.target.closest('#guided-demo')||event.target.closest('#demo-step-scan'))return setSample();if(event.target.closest('#export-decision'))return downloadDecisionBrief();if(event.target.closest('#prepare-photo'))return void prepareSelectedPhoto();if(event.target.closest('#sample-report'))return setSample();if(event.target.closest('#live-scan'))return void scanLive();if(event.target.closest('#resume-scan'))return void resumePendingScan();if(event.target.closest('#forget-scan')){if(state.busy)return;savePendingScan(null);renderScan();notice('Saved scan reference discarded. This does not cancel a task already running at Perfect Corp.');return;}if(event.target.closest('#reset-shelf')){state.shelf=sampleShelf.map(x=>({...x}));state.sampleInventory=true;persist();renderShelf(decide());return;}
 if(event.target.closest('#clear-shelf')){state.shelf=[];state.sampleInventory=false;persist();renderShelf(decide());return;}
 const cart=event.target.closest('[data-cart]');if(cart){state.cartIds=state.cartIds.includes(cart.dataset.cart)?state.cartIds.filter(x=>x!==cart.dataset.cart):[...state.cartIds,cart.dataset.cart];renderShop(decide());return;}
 if(event.target.closest('#cart-auto')){state.cartIds=decide().cartIds;renderShop(decide());return;}
});
document.addEventListener('change',event=>{if(event.target.id==='catalog-step'){state.catalogStep=event.target.value;renderCatalogResults(decide());return;}if(event.target.id==='catalog-decision'){state.catalogDecision=event.target.value;renderCatalogResults(decide());return;}if(event.target.id==='catalog-sort'){state.catalogSort=event.target.value;renderCatalogResults(decide());return;}if(event.target.id==='catalog-saved-only'){state.savedOnly=event.target.checked;renderCatalogResults(decide());return;}if(event.target.id==='catalog-affordable-only'){state.affordableOnly=event.target.checked;renderCatalogResults(decide());return;}if(event.target.matches('[data-routine-key]')){if(state.sampleInventory){notice('Illustrative items cannot count as actual activity.',true);renderRoutine(decide());return;}const plan=buildRoutinePlan(decide().owned),day=localRoutineDate();const log=toggleRoutineStep(state.routineLog,day,plan,event.target.dataset.routineKey,event.target.checked);state.routineLog=log;try{localStorage.setItem(ROUTINE_LOG_KEY,JSON.stringify(log));}catch{notice('Browser storage is unavailable; checks may disappear when you leave.',true);}renderRoutine(decide());return;}if(event.target.id==='photo-file'){storeFile(event.target.files?.[0]);return;}if(event.target.id==='consent'){state.consent=event.target.checked;return;}if(['budget','goal','fragrance'].includes(event.target.id)){updatePrefs();}});
document.addEventListener('input',event=>{if(event.target.id==='catalog-search'){state.catalogQuery=event.target.value.slice(0,80);renderCatalogResults(decide());return;}if(event.target.id==='demo-passcode')state.code=event.target.value.slice(0,120);});
document.addEventListener('submit',event=>{if(event.target.id!=='add-product')return;event.preventDefault();const name=$('#owned-name').value.trim(),step=$('#owned-step').value,price=Number($('#owned-price').value);const tags=$('#owned-tags').value.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean).slice(0,8);if(!name||!stepLabels[step]||!Number.isFinite(price)||price<0)return notice('Enter a valid product name, step and non-negative price.',true);if(state.sampleInventory)state.shelf=[];state.shelf.push({id:crypto.randomUUID(),name:name.slice(0,90),step,tags,price});state.sampleInventory=false;persist();renderShelf(decide());notice('Added to your local shelf. No data was sent to providers.');});
async function loadStatus(){try{const response=await fetch('/api/status');const data=await response.json();state.providerConnection=typeof data.providerConnection==='string'?data.providerConnection:'disabled';state.liveEnabled=data.liveEnabled===true&&state.providerConnection==='authenticated';}catch{state.liveEnabled=false;state.providerConnection='failed';}render();}
loadStatus();
