import {catalog,goals,stepLabels,sampleShelf,sampleScan,normalizeShelf,evaluateShop} from '/recommendations.js';
const $=selector=>document.querySelector(selector);
const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=v=>'$'+Number(v||0).toFixed(0);
const PENDING_SCAN_KEY='routinegap_pending_scan_v1';
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
const state={tab:'overview',shelf:sampleShelf.map(x=>({...x})),budget:60,goal:'moisture',fragranceFree:false,sampleInventory:true,scan:null,scanSource:null,cartIds:[],file:null,preview:null,imageReady:false,imageDimensions:null,consent:false,code:'',liveEnabled:false,providerConnection:'disabled',pending:readPendingScan(),busy:false,feedback:'',isError:false};
try{const saved=JSON.parse(localStorage.getItem('routinegap_state')||'null');if(saved&&typeof saved==='object'){
  state.shelf=normalizeShelf(saved.shelf);state.budget=Number.isFinite(saved.budget)?Math.max(0,Math.min(1000,saved.budget)):60;state.goal=goals.some(g=>g.id===saved.goal)?saved.goal:'moisture';state.fragranceFree=saved.fragranceFree===true;state.sampleInventory=saved.sampleInventory===true;
}}catch{}
function persist(){try{localStorage.setItem('routinegap_state',JSON.stringify({shelf:state.shelf,budget:state.budget,goal:state.goal,fragranceFree:state.fragranceFree,sampleInventory:state.sampleInventory}));}catch{}}
const decide=()=>evaluateShop({shelf:state.shelf,budget:state.budget,goal:state.goal,fragranceFree:state.fragranceFree});
function notice(msg,error=false){state.feedback=msg;state.isError=error;drawMessage();}
function drawMessage(){const html=state.feedback?`<div class="notice ${state.isError?'error':''}" role="status">${escape(state.feedback)}</div>`:'';const el=$('#message');if(el)el.innerHTML=html;const local=$('#scan-status');if(local)local.innerHTML=state.tab==='scan'?html:'';}
const markMode=()=>state.scanSource==='live'?'<span class="label-pill">REAL YOUCAM RESULT</span>':state.scanSource==='sample'?'<span class="label-pill peach">ILLUSTRATIVE SAMPLE • NOT YOUCAM</span>':'<span class="label-pill peach">NO SCAN YET</span>';
function navigate(tab){if(!['overview','scan','shelf','shop','trail'].includes(tab))return;state.tab=tab;render();window.scrollTo({top:0,behavior:'smooth'});$('#main')?.focus({preventScroll:true});}
function render(){document.querySelectorAll('.view').forEach(el=>el.classList.toggle('hidden',el.id!==`view-${state.tab}`));document.querySelectorAll('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.tab===state.tab));$('#crumb-page').textContent=({overview:'Overview',scan:'Skin analysis',shelf:'My shelf',shop:'Shopping studio',trail:'Decision trail'})[state.tab];
  const d=decide();const titles={overview:renderOverview,scan:renderScan,shelf:renderShelf,shop:renderShop,trail:renderTrail};titles[state.tab](d);drawMessage();$('#provider-chip').textContent=state.liveEnabled?'● YouCam API key authenticated':state.providerConnection==='failed'?'● YouCam authentication failed':state.providerConnection==='checking'?'● Checking YouCam credentials':'● Sample mode available';
}
const title=(eyebrow,h1,subtitle)=>`<div class="page-heading"><div class="eyebrow">${eyebrow}</div><h1>${h1}</h1><p>${subtitle}</p></div>`;
function renderOverview(d){$('#view-overview').innerHTML=`<div class="hero"><div class="page-kicker"><span class="dot"></span><span class="eyebrow" style="color:#d9e9ca">THE SMARTER SKINCARE EDIT</span></div><h1>Your shelf first.<br><em>Shop smarter.</em></h1><p>Your next best skincare purchase might be one you don't need. Understand your cosmetic skin signals, see what you already have, and spend with intention.</p><button class="primary" data-go="scan">Start my skin-aware session →</button><div class="hero-art" aria-hidden="true"></div><div class="hero-orbit" aria-hidden="true"></div></div>
<div class="stats"><div class="stat"><span>Products on your shelf</span><strong>${d.owned.length}</strong><small>${state.sampleInventory?'Illustrative sample inventory':'Your saved local inventory'}</small></div><div class="stat"><span>Suggested cart</span><strong>${money(d.cartTotal)}</strong><small>Within ${money(d.budget)} budget</small></div><div class="stat"><span>Duplicate purchases avoided</span><strong>${d.skippedRedundant}</strong><small>Illustrative catalog options screened</small></div></div>
<div class="section-title"><h2>Today's smart decisions</h2><button class="tiny-btn" data-go="shop">Open shopping studio ↗</button></div><div class="two-col"><div class="panel"><div class="eyebrow">SHELF AUDIT</div><h3 style="margin-top:9px">${d.missingSteps.length?'Room for a smarter routine':'Your essentials are covered'}</h3><p class="muted">${escape(d.message)} We start with what you own, before recommending anything to buy.</p>${['cleanser','moisturizer','spf'].map(s=>`<div class="list-row"><span>${escape(stepLabels[s])}</span><span class="label-pill ${d.owned.some(x=>x.step===s)?'':'peach'}">${d.owned.some(x=>x.step===s)?'IN YOUR SHELF':'POTENTIAL GAP'}</span></div>`).join('')}<div class="panel-actions"><button class="secondary" data-go="shelf">Review my shelf →</button></div></div><div class="panel"><div class="eyebrow">WHY IT MATTERS</div><h3 style="margin-top:9px">Clarity before checkout</h3><p class="muted">Connect a real YouCam Skin Analysis session to review cosmetic observations, or preview the workflow with clearly labeled example data.</p><div class="list-row"><span>Skin analysis</span>${markMode()}</div><div class="list-row"><span>Live provider configuration</span><span class="label-pill ${state.liveEnabled?'':'peach'}">${state.liveEnabled?'KEY AUTHENTICATED':state.providerConnection==='failed'?'AUTHENTICATION FAILED':state.providerConnection==='checking'?'CHECKING API KEY':'NOT CONNECTED'}</span></div><div class="list-row"><span>Recommendation logic</span><span class="label-pill">TRANSPARENT RULES</span></div><div class="panel-actions"><button class="secondary" data-go="scan">View skin studio →</button></div></div></div>`;}
function renderScan(){const reports=state.scan||[];$('#view-scan').innerHTML=`${title('SKIN SIGNALS','The skin intelligence studio','Begin with a clear front-facing selfie for live Perfect Corp YouCam Skin Analysis, or explore an unmistakably illustrative sample. Cosmetic signals are not medical diagnoses.')}
<div class="two-col"><div class="panel"><div class="eyebrow">STEP 01 • YOUR IMAGE</div><h3 style="margin-top:9px">Start a skin-aware session</h3><div class="scan-input" id="upload-area"><div style="font-size:36px;margin-bottom:8px">◎</div><strong>${state.file?escape(state.file.name):'Choose a clear JPG or PNG selfie'}</strong><p class="muted small">JPG / PNG · 480 px minimum short side · 2,560 px maximum long side · Max 8 MB</p><label for="photo-file" class="photo-select-button">Choose photo</label><input id="photo-file" type="file" accept="image/jpeg,image/png" class="sr-only" aria-label="Choose selfie for YouCam analysis"><div class="photo-selected-preview">${state.preview?`<img class="photo-preview" src="${escape(state.preview)}" alt="Preview of your selected image. Nothing has been uploaded yet.">`:''}<span class="muted small">${state.file?((state.imageDimensions?state.imageDimensions.width+' × '+state.imageDimensions.height+' pixels • ':'')+(state.imageReady?'Ready for analysis':'Checking dimensions / not suitable for analysis')+' — not uploaded.'):'No photo selected yet.'}</span></div></div><div class="consent-box" style="margin-top:14px"><label><input type="checkbox" id="consent" ${state.consent?'checked':''}><span>I understand my photo will be transferred to Perfect Corp for YouCam analysis. I have consent from the photographed person. Photos are not saved to RoutineGap's permanent database. This is a cosmetic assessment, not medical advice.</span></label></div><div class="field" style="margin-top:14px"><label for="demo-passcode">Live demo passcode (provided by project owner)</label><input id="demo-passcode" type="password" autocomplete="off" placeholder="Required only for real API calls" value="${escape(state.code)}"></div><p class="muted small">${state.liveEnabled?'YouCam API key authenticated with a free balance check. A real skin scan still needs to be tested.':state.providerConnection==='failed'?'The YouCam API key was rejected. The project owner must replace the key securely in Render before real scans can run.':state.providerConnection==='checking'?'YouCam API key verification is in progress. Reload after it finishes.':'The server is not yet connected to a YouCam API key. Sample mode works without a key.'} Real runs consume YouCam API units. The live route is intentionally protected against public credit abuse.</p><div class="panel-actions"><button id="live-scan" class="primary" ${state.busy||!state.liveEnabled||!state.imageReady||!!state.pending?'disabled':''}>${state.busy?'Working with YouCam…':state.pending?'Scan already started — resume below':'Analyze with YouCam →'}</button><button class="ghost" id="sample-report" ${state.busy?'disabled':''}>Explore example instead</button></div>
${state.pending?`<div class="scan-resume-panel" role="group" aria-label="Resume an existing YouCam analysis"><strong>Your earlier analysis may still be running</strong><p class="muted small">Resume this session without uploading the photo again or starting another paid task. The scan receipt is saved in this browser tab for up to 24 hours; your photo is not stored by RoutineGap.</p><div class="panel-actions"><button type="button" id="resume-scan" class="secondary" ${state.busy||!state.liveEnabled?'disabled':''}>Resume existing scan →</button><button type="button" id="forget-scan" class="ghost" ${state.busy?'disabled':''}>Discard saved session</button></div></div>`:''}
<div class="scan-feedback" id="scan-status" role="status" aria-live="polite">${state.feedback?`<div class="notice ${state.isError?'error':''}">${escape(state.feedback)}</div>`:''}</div></div>
<div class="panel"><div class="eyebrow">STEP 02 • COSMETIC INSIGHTS</div><h3 style="margin-top:9px">Your scan report</h3>${markMode()}<div style="margin-top:18px">${reports.length?reports.map(x=>`<div class="report-card"><div><strong>${escape(x.type.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase()))}</strong><div class="muted small">${state.scanSource==='sample'?'Illustrative example only':'YouCam reported cosmetic metric'}</div></div><span class="signal-score">${Number.isFinite(x.uiScore)?escape(x.uiScore):x.type==='skin_type'&&typeof x.regions?.whole==='string'?escape(x.regions.whole):'—'}</span></div>`).join(''):`<div class="empty"><div style="font-size:34px;margin-bottom:8px">✧</div><strong>No skin report yet</strong><p>Explore the sample or connect YouCam for real results.</p></div>`}</div><p class="muted small">YouCam's UI scores are cosmetic presentation scores, not clinical risk estimates, diagnostic certainty or product-effectiveness predictions. Your shopping decisions below depend on your stated goals and owned shelf—not inferred disease.</p>${reports.length?'<div class="panel-actions"><button class="secondary" data-go="shop">Continue to shopping studio →</button></div>':''}</div></div>
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
function renderShelf(d){$('#view-shelf').innerHTML=`${title('YOUR PRODUCTS','Make the most of what you have','Add products you already use. We flag redundant shopping steps before suggesting anything new. Your shelf and budget are stored in this browser only.')}
<div class="two-col" style="grid-template-columns:1fr 1.4fr"><div class="panel"><div class="eyebrow">ADD TO YOUR SHELF</div><h3 style="margin:9px 0 18px">Record a product you own</h3><form id="add-product"><div class="field"><label for="owned-name">Product name</label><input id="owned-name" required maxlength="90" placeholder="e.g. My gentle face wash"></div><div class="forms" style="margin-top:14px"><div class="field"><label for="owned-step">Routine step</label><select id="owned-step">${Object.entries(stepLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><div class="field"><label for="owned-price">Purchase price (USD)</label><input id="owned-price" type="number" min="0" max="10000" value="15"></div></div><div class="field" style="margin-top:14px"><label for="owned-tags">Tags (comma-separated, optional)</label><input id="owned-tags" maxlength="140" placeholder="hydrating, fragrance-free"></div><button class="primary" style="margin-top:16px" type="submit">Add to shelf +</button></form><div class="separator"></div><button class="tiny-btn" id="reset-shelf">Load illustrative starter shelf</button><button class="tiny-btn" id="clear-shelf" style="margin-left:6px">Clear shelf</button></div><div class="panel"><div class="eyebrow">YOUR INVENTORY</div><h3 style="margin:9px 0 12px">${d.owned.length} products on file ${state.sampleInventory?'<span class="label-pill peach">SAMPLE INVENTORY</span>':''}</h3>${d.owned.length?d.owned.map(x=>`<div class="list-row"><div><strong>${escape(x.name)}</strong><div class="muted small">${escape(stepLabels[x.step])} · ${escape(x.tags.join(' · '))}</div></div><button class="tiny-btn" data-remove="${escape(x.id)}" aria-label="Remove ${escape(x.name)}">Remove</button></div>`).join(''):'<div class="empty">Your shelf is empty. Start with a product you already own.</div>'}<div class="panel-actions"><button class="secondary" data-go="shop">Compare with catalog →</button></div></div></div>`;}
function renderShop(d){const active=state.cartIds.length?state.cartIds:[];const cartProducts=d.rows.filter(x=>active.includes(x.id));const cartTotal=cartProducts.reduce((n,p)=>n+p.price,0);$('#view-shop').innerHTML=`${title('SHOP WITH INTENTION','Shopping studio','A small illustrative catalog and explainable rules show what to use, what to consider, and what to skip—before spending money. No real checkout is implemented.')}
<div class="two-col" style="grid-template-columns:1.6fr .8fr"><div><div class="panel" style="margin-bottom:17px"><div class="eyebrow">PERSONALIZE YOUR PLAN</div><div class="forms" style="margin-top:13px"><div class="field"><label for="budget">Your budget (USD)</label><input id="budget" type="number" min="0" max="1000" value="${d.budget}"></div><div class="field"><label for="goal">Your cosmetic goal</label><select id="goal">${goals.map(g=>`<option value="${g.id}" ${state.goal===g.id?'selected':''}>${escape(g.name)}</option>`).join('')}</select></div></div><label class="checkbox-line" style="margin-top:15px"><input id="fragrance" type="checkbox" ${state.fragranceFree?'checked':''}> Show fragrance-free tagged concepts only</label><p class="muted small">Recommendations respond to your preferences and shelf. A YouCam scan adds observable context but does not automatically prescribe products or determine allergies.</p></div><div class="product-grid">${d.rows.map(p=>{const inCart=active.includes(p.id);return `<article class="product-card"><div class="product-art art-${p.step}" aria-hidden="true"></div><div class="eyebrow">${escape(stepLabels[p.step])}</div><h3>${escape(p.name)}</h3><p class="muted small">${escape(p.description)}</p><div class="product-meta"><span class="product-price">${money(p.price)}</span><span class="label-pill ${p.decision==='skip'?'peach':''}">${p.decision==='skip'?'USE YOUR SHELF':p.decision==='optional'?'OPTIONAL':'CONSIDER'}</span></div><p class="muted small">${escape(p.reason)}</p><div class="product-actions"><button class="tiny-btn" data-cart="${p.id}" ${p.decision==='skip'?'disabled':''}>${inCart?'Remove from cart':p.decision==='skip'?'Redundant':'Add to demo cart +'}</button></div></article>`}).join('')}</div></div><div><div class="spend-box"><div class="eyebrow" style="color:#d7e7c4">YOUR SPENDING GUARDRAIL</div><strong>${money(cartTotal)} / ${money(d.budget)}</strong><p style="font-size:12px;color:#d5e4d8">${cartTotal>d.budget?'Your selection exceeds your budget.':'Within your selected budget.'}</p><button class="primary" style="background:#dbea9d;color:#233c30;border:0;width:100%" id="cart-auto">Build essentials-first demo cart</button></div><div class="panel"><div class="eyebrow">REVIEWABLE CART</div><h3 style="margin-top:8px">Your considered additions</h3>${cartProducts.length?cartProducts.map(x=>`<div class="cart-line"><span>${escape(x.name)}</span><strong>${money(x.price)}</strong></div>`).join(''):'<p class="muted">Nothing added. Browse concepts or generate a budget-aware suggestion.</p>'}<div class="cart-line"><strong>Demo total</strong><strong>${money(cartTotal)}</strong></div><p class="muted small">Illustrative products and prices. No checkout, store links, shipping, real customer reviews or product-performance guarantees.</p><button class="secondary" data-go="trail" style="width:100%">See why these products →</button></div></div></div>`;}
function renderTrail(d){const rows=[{n:'01',title:'Cosmetic observation',body:state.scanSource==='live'?'Real YouCam Skin Analysis observations were returned. These vendor scores are not diagnoses.':state.scanSource==='sample'?'You selected a labeled illustrative scan. None of these scores came from the live API.':'No scan result yet. Your choices rely solely on your own stated preferences.'},{n:'02',title:'Your stated preference',body:`You chose “${goals.find(g=>g.id===state.goal)?.name||'Simple routine'}” as a shopping goal. This preference is entered by you, not automatically inferred as a medical condition.`},{n:'03',title:'What you already own',body:`You have ${d.owned.length} products recorded. Routine steps in your shelf: ${[...new Set(d.owned.map(x=>stepLabels[x.step]))].join(', ')||'none yet'}.`},{n:'04',title:'Budget & exclusions',body:`We use your ${money(d.budget)} spending limit and ${state.fragranceFree?'restrict the illustrative catalog to products tagged fragrance-free':'do not apply a fragrance-free catalog filter'}.`},{n:'05',title:'Why we skip duplicates',body:`${d.skippedRedundant} catalog options match steps you already own. Our conservative heuristic says “Use your shelf” for those steps.`},{n:'06',title:'Human decision',body:'Any cart selections are yours. Neither the YouCam scores nor RoutineGap can establish treatment efficacy, allergy safety or what is medically appropriate.'}];$('#view-trail').innerHTML=`${title('EXPLAINABILITY','The decision trail','A full breakdown of where each shopping suggestion comes from. We separate provider-generated observations from human preferences and product-matching rules.')}
<div class="two-col"><div class="panel"><div class="eyebrow">THE LOGIC, STEP BY STEP</div><div style="margin-top:22px">${rows.map(x=>`<div class="trail-step"><span class="num">${x.n}</span><div class="timeline-card"><strong>${escape(x.title)}</strong><p class="muted small">${escape(x.body)}</p></div></div>`).join('')}</div></div><div><div class="panel"><div class="eyebrow">TRANSPARENCY LABELS</div><div class="list-row"><span>YouCam cosmetic scores</span><span class="label-pill">VENDOR OUTPUT, IF LIVE</span></div><div class="list-row"><span>Shopping priorities</span><span class="label-pill peach">USER PREFERENCES</span></div><div class="list-row"><span>Duplicate detection</span><span class="label-pill">DETERMINISTIC HEURISTIC</span></div><div class="list-row"><span>Catalog prices</span><span class="label-pill peach">ILLUSTRATIVE</span></div><div class="separator"></div><p class="muted small">The provider describes UI scores as cosmetically adjusted presentation scores. We show them as received and do not present them as probability, clinical severity, or causal evidence that a product will work.</p><button class="secondary" data-go="shop">Back to shopping →</button></div><div class="panel" style="margin-top:18px"><h3>Privacy by design</h3><p class="muted small">Skin photos remain in browser memory until you explicitly request live analysis. On live analysis the photo is sent to Perfect Corp using its documented file upload flow. We do not store photo files in our application's database. For privacy, do not use another person's photo without consent. Remove browser-owned inventory from My Shelf at any time.</p><p class="muted small">YouCam API documentation: <a target="_blank" rel="noopener noreferrer" href="https://docs.perfectcorp.com/reference/ai_skin_analysis">Skin Analysis reference ↗</a></p></div></div></div>`;}
function updatePrefs(){const x=$('#budget'),y=$('#goal'),z=$('#fragrance');if(!x||!y||!z)return;state.budget=Math.max(0,Math.min(1000,Number(x.value)||0));state.goal=y.value;state.fragranceFree=z.checked;state.cartIds=[];persist();renderShop(decide());}
let imageSelection=0;
function storeFile(file){
  const generation=++imageSelection;
  if(state.preview){URL.revokeObjectURL(state.preview);state.preview=null;}
  state.file=null;state.imageReady=false;state.imageDimensions=null;
  if(!file){renderScan();notice('No photo selected.');return;}
  if(!['image/jpeg','image/png'].includes(file.type)||file.size>8*1024*1024||file.size<1500){
    renderScan();notice('Choose a valid JPG or PNG between 1.5 KB and 8 MB.',true);return;
  }
  state.file=file;state.preview=URL.createObjectURL(file);renderScan();
  notice('Checking photo resolution locally. Nothing has been uploaded.');
  const probe=new Image();
  probe.onload=()=>{
    if(generation!==imageSelection)return;
    const w=probe.naturalWidth,h=probe.naturalHeight;
    state.imageDimensions={width:w,height:h};
    state.imageReady=Math.min(w,h)>=480&&Math.max(w,h)<=2560;
    renderScan();
    notice(state.imageReady
      ?'Photo ready ('+w+' × '+h+' px). Nothing has been uploaded. Select Analyze with YouCam to start.'
      :'Photo is '+w+' × '+h+' px. YouCam SD analysis requires the shorter side to be at least 480 px and the longer side no more than 2560 px. Please use a higher-resolution original photo; enlarging a small image does not restore detail.',!state.imageReady);
  };
  probe.onerror=()=>{if(generation!==imageSelection)return;state.imageReady=false;renderScan();notice('Unable to decode this photo. Please choose another JPEG or PNG.',true);};
  probe.src=state.preview;
}
function setSample(){
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
  if(!state.file)return notice('Select a JPG or PNG selfie first.',true);
  if(!state.imageReady)return notice('The selected photo must satisfy the YouCam resolution requirements before uploading.',true);
  if(!state.consent)return notice('Photo-processing consent is required before sending your image.',true);
  if(!state.code)return notice('Enter the protected live demo passcode.',true);
  state.busy=true;state.scan=null;state.scanSource=null;renderScan();
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
    notice('The task started. Your private recovery receipt is saved for this tab. No second upload is needed.');
  }catch(error){notice(error?.message||'The scan could not start. No sample result was substituted.',true);}
  finally{state.busy=false;renderScan();drawMessage();}
  if(state.pending)await resumePendingScan();
}

document.addEventListener('click',event=>{const tab=event.target.closest('[data-tab]');if(tab)return navigate(tab.dataset.tab);const nav=event.target.closest('[data-go]');if(nav)return navigate(nav.dataset.go);const remove=event.target.closest('[data-remove]');if(remove){state.shelf=state.shelf.filter(x=>x.id!==remove.dataset.remove);state.sampleInventory=false;persist();renderShelf(decide());return;}
 if(event.target.closest('#sample-report'))return setSample();if(event.target.closest('#live-scan'))return void scanLive();if(event.target.closest('#resume-scan'))return void resumePendingScan();if(event.target.closest('#forget-scan')){if(state.busy)return;savePendingScan(null);renderScan();notice('Saved scan reference discarded. This does not cancel a task already running at Perfect Corp.');return;}if(event.target.closest('#reset-shelf')){state.shelf=sampleShelf.map(x=>({...x}));state.sampleInventory=true;persist();renderShelf(decide());return;}
 if(event.target.closest('#clear-shelf')){state.shelf=[];state.sampleInventory=false;persist();renderShelf(decide());return;}
 const cart=event.target.closest('[data-cart]');if(cart){state.cartIds=state.cartIds.includes(cart.dataset.cart)?state.cartIds.filter(x=>x!==cart.dataset.cart):[...state.cartIds,cart.dataset.cart];renderShop(decide());return;}
 if(event.target.closest('#cart-auto')){state.cartIds=decide().cartIds;renderShop(decide());return;}
});
document.addEventListener('change',event=>{if(event.target.id==='photo-file'){storeFile(event.target.files?.[0]);return;}if(event.target.id==='consent'){state.consent=event.target.checked;return;}if(['budget','goal','fragrance'].includes(event.target.id)){updatePrefs();}});
document.addEventListener('input',event=>{if(event.target.id==='demo-passcode')state.code=event.target.value.slice(0,120);});
document.addEventListener('submit',event=>{if(event.target.id!=='add-product')return;event.preventDefault();const name=$('#owned-name').value.trim(),step=$('#owned-step').value,price=Number($('#owned-price').value);const tags=$('#owned-tags').value.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean).slice(0,8);if(!name||!stepLabels[step]||!Number.isFinite(price)||price<0)return notice('Enter a valid product name, step and non-negative price.',true);state.shelf.push({id:crypto.randomUUID(),name:name.slice(0,90),step,tags,price});state.sampleInventory=false;persist();renderShelf(decide());notice('Added to your local shelf. No data was sent to providers.');});
async function loadStatus(){try{const response=await fetch('/api/status');const data=await response.json();state.providerConnection=typeof data.providerConnection==='string'?data.providerConnection:'disabled';state.liveEnabled=data.liveEnabled===true&&state.providerConnection==='authenticated';}catch{state.liveEnabled=false;state.providerConnection='failed';}render();}
loadStatus();
