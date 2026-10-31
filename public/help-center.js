/**
 * RoutineGap self-service knowledge base. Static product facts only.
 * No user uploads, LLM calls, tracking, cookies, tickets or support impersonation.
 * All routed destinations are real, allowlisted workspace pages.
 */
export const HELP_CATEGORIES=Object.freeze([
 {id:'all',label:'All topics',symbol:'✦'},
 {id:'start',label:'Getting started',symbol:'◫'},
 {id:'scan',label:'Skin analysis',symbol:'◎'},
 {id:'shop',label:'Shopping & routines',symbol:'◇'},
 {id:'data',label:'Privacy & data',symbol:'♧'},
 {id:'fix',label:'Troubleshooting',symbol:'⌁'}
]);
const faq=(id,category,question,answer,tab,keywords='')=>Object.freeze({id,category,question,answer,tab,keywords});
export const HELP_ARTICLES=Object.freeze([
 faq('first-run','start','Where should I start?','Begin with My Shelf and add products you actually own. Then review routine coverage and browse sample concepts if helpful. A skin scan is entirely optional.','shelf','onboarding first time new user'),
 faq('without-scan','start','Can I use RoutineGap without a selfie or scan?','Yes. Your inventory, planner, budget comparisons, illustrative concept catalog, decision explanations and privacy controls are available without sending a face image.','overview','no account image optional privacy'),
 faq('live-v-demo','start','What is the difference between a demo and a real scan?','A demo uses explicitly illustrative observations and does not call YouCam. A real scan processes an eligible consented photo through Perfect Corp and only counts as real after supported provider results are returned. An authenticated key alone is not a completed scan.','scan','fake real sample provider'),
 faq('guidance','start','Can someone guide me through all the features?','Use Guided Tour from the top bar or the homepage. It visits six real workspaces using non-persistent tour progress and can display a clearly labeled example without calling the provider.','overview','walkthrough tour step by step'),
 faq('accounts','start','Do I need to register an account?','No account is required to use the present prototype. Everyday product and preference information is stored in this browser, so using another device or clearing browser storage does not automatically sync it.','privacy','login sign up cross device'),
 faq('mobile','start','Where are the features on my phone?','On smaller screens use the bottom navigation for Home, My Shelf, Skin Scan and Explore. Select More for planner, insights, comparisons, decision trail, privacy and help.','overview','navigation small screen'),
 faq('specs','scan','What photo format, dimensions and file size do I need?','RoutineGap accepts JPG and PNG. The shorter side must be at least 480 pixels and the longer side no more than 2,560 pixels for the final scan image. The final scan file must not exceed 8 MiB. Larger originals up to 24 MiB may be prepared privately first.','scan','image resolution 480px 2560px upload'),
 faq('too-small','scan','My photo is too small. Can I enlarge it?','Use the original full-resolution photo or retake a well-lit frontal selfie. Enlarging a small screenshot or thumbnail cannot restore genuine skin texture. Avoid AI beautification or invented pixel details.','scan','pixels low resolution tiny'),
 faq('too-large','scan','My photo is too large. How can I fix it?','Use Prepare photo on this device for supported oversized originals. It proportionally resizes and compresses locally without uploading. You can alternatively use Squoosh or Photopea to downsize a genuine high-quality original.','scan','resize compress squoosh photopea 8mb'),
 faq('face-quality','scan','Does the readiness dashboard verify lighting or facial visibility?','No. Automatic checks cover file metadata and dimensions. Lighting, sharpness, coverage, straight-on framing and filters are self-reported checks. Passing local thresholds does not guarantee Perfect Corp will accept the image.','scan','lighting face angle blur'),
 faq('consent','scan','When is my face photo uploaded?','Only when you explicitly start a real YouCam scan after selecting a technically eligible photo and giving photo-processing consent. Checking dimensions, using the example, and preparing an image locally do not upload it.','scan','privacy upload face'),
 faq('passcode','scan','Why does live analysis ask for a passcode?','The project owner protects the paid YouCam route against uncontrolled public API usage. A valid passcode and photo consent are required for real analysis; you can explore sample mode without them. RoutineGap does not disclose or generate the private passcode in Help.','scan','password secret authentication paid'),
 faq('key-state','scan','Does an authenticated YouCam key mean a scan was tested?','No. API-key authentication can be checked without uploading an image or completing an analysis. Only a completed provider response with valid cosmetic observations can demonstrate a real scan.','scan','credentials authenticated verified'),
 faq('pending','scan','My real scan is still processing. Should I upload again?','No. Use Resume existing scan when a saved task reference is present. Re-uploading may start another chargeable provider job. Discarding the local reference does not cancel the task that may already exist at Perfect Corp.','scan','pending resume delay timeout'),
 faq('scan-meaning','scan','Is the skin analysis a medical diagnosis?','No. Skin observations are for cosmetic presentation, not a diagnosis, clinical severity estimate, treatment prescription or evidence of a product\'s effectiveness. See a qualified health professional for medical concerns.','scan','health clinical disease'),
 faq('why-shelf','shop','Why does RoutineGap ask about products I already own?','It uses your recorded routine categories to flag potentially redundant example ideas before you browse. It does not verify product ingredients, usage, purchases or clinical compatibility.','shelf','duplicates spending'),
 faq('fake-products','shop','Are the catalog products available for purchase?','No. All 25 concept products, names, illustrated packaging, example prices and product tags are fictional educational data. There is no real merchant availability, payment or checkout.','shop','real products fake prices shop'),
 faq('saved','shop','How do saved ideas and comparisons work?','Saved concepts and up to three compared examples are local browsing tools. They are not receipts, purchased products, medical recommendations or merchant offers.','compare','favorites cart'),
 faq('pricing','shop','What currency and prices am I seeing?','Catalog concept prices are illustrative USD amounts. The recorded price for a product you own is whatever you entered in the local shelf, not a live retailer quote or a verified historical purchase.','shop','currency money usd budget price'),
 faq('budget','shop','Can I plan around a budget?','Yes. Choose a demo budget to compare example ideas and optional categories. The budget model uses illustrative prices only, and actual retailer prices or availability have not been checked.','insights','cash savings spend'),
 faq('routine','shop','What does the daily routine planner track?','It shows ordinary morning and evening cosmetic steps based on products you actually enter. You can check steps yourself in this browser. Those ticks do not prove adherence or treatment efficacy.','routine','checklist'),
 faq('focus','shop','Does a YouCam score automatically prescribe my next product?','No. You choose your cosmetic shopping focus. The decision model uses your chosen preference, example catalog tags, recorded product categories and budget. It does not infer diseases or guarantee efficacy.','trail','recommendation transparency'),
 faq('backup','data','How do I export my product shelf?','Open My Shelf or Privacy & Data and choose the local JSON export. It contains your entered products and supported preferences, not selfies, stored scan observations, API credentials or private passcodes.','privacy','download json backup'),
 faq('import','data','Can I transfer my shelf to another browser?','You can export the validated JSON backup and import it manually in My Shelf on the other device. There is currently no automatic account sync or cloud backup.','shelf','restore transfer'),
 faq('erase','data','How do I remove browser-local RoutineGap data?','Privacy & Data shows six known groups. Delete selected groups or all RoutineGap browser keys with confirmation. This does not delete unrelated browser data, exported files or information already transmitted to Perfect Corp.','privacy','delete forget clear local storage'),
 faq('provider-delete','data','Does deleting local scan references delete data at Perfect Corp?','No. Browser-local erasure cannot cancel an already submitted provider task or retract an uploaded photo. For provider-held data you must follow the applicable provider privacy and deletion process.','privacy','remote records retention'),
 faq('private-photo','data','Does RoutineGap save my selfie in the shelf backup?','No. Image selection and local preparation use browser memory. Product-inventory backup does not contain photos, provider payloads, scan references, passwords or keys. A real scan still transmits the selected image to Perfect Corp after consent.','privacy','photos backup'),
 faq('not-saving','fix','My products or checks disappear after refresh. Why?','Confirm your browser allows local storage, you are not in a private session with data being cleared, and you are using the same browser profile and device. Export shelf JSON before clearing your browser data.','privacy','storage blocked private tab'),
 faq('image-decode','fix','The image cannot be decoded. What should I do?','Try an original JPG or PNG exported directly from your photo library. Re-export a damaged or unsupported file to JPG using a trusted local editor; do not add beauty filters or invented texture.','scan','format corrupted webp heic'),
 faq('api-error','fix','The YouCam API says unavailable or authentication failed.','Use the clearly marked example flow while the owner checks provider credentials and server status. Do not repeatedly send photos or share the protected demo passcode. Authentication alone does not prove live image analysis works.','scan','failed connection 503'),
 faq('no-report','fix','My scan finished without a useful report.','Use the existing receipt to resume first if still pending. If the provider explicitly returned an error, review the photo capture guide and contact the project owner about the failed provider task before initiating another paid run.','scan','results missing error'),
 faq('no-results','fix','No shopping concepts match my filters.','Try another category or a shorter search, or clear the example catalog filters. Your actual shelf and saved concept IDs are not changed by clearing search filters.','shop','search empty filter'),
 faq('unsupported-browser','fix','My device cannot prepare the photo locally.','Try an updated desktop Chrome, Edge or Safari browser, or resize a high-quality original with Squoosh or Photopea. Never upscale a low-resolution photo to invent skin details.','scan','canvas bitmap browser')
]);
const categoryIds=new Set(HELP_CATEGORIES.map(x=>x.id));
const allowedTabs=new Set(['overview','scan','shelf','routine','insights','shop','compare','trail','privacy','help']);
export function filterHelp(query='',category='all',{limit=50}={}){
 const selected=categoryIds.has(category)?category:'all';
 const q=String(query??'').trim().toLocaleLowerCase('en').slice(0,100);
 const max=Number.isInteger(limit)?Math.max(1,Math.min(HELP_ARTICLES.length,limit)):HELP_ARTICLES.length;
 const results=HELP_ARTICLES.filter(a=>selected==='all'||a.category===selected).map(article=>{
  const title=article.question.toLocaleLowerCase('en');
  const haystack=(article.answer+' '+article.keywords).toLocaleLowerCase('en');
  const score=!q?1:title===q?10:title.startsWith(q)?7:title.includes(q)?5:haystack.includes(q)?1:0;
  return {...article,score};
 }).filter(x=>x.score>0);
 if(q)results.sort((a,b)=>b.score-a.score||a.question.localeCompare(b.question,'en'));
 return results.slice(0,max);
}
export function helpCategoryCounts(){
 return HELP_CATEGORIES.map(cat=>({...cat,count:cat.id==='all'?HELP_ARTICLES.length:HELP_ARTICLES.filter(a=>a.category===cat.id).length}));
}
export function contextualHelp({pending=false,photoStatus='empty',sampleInventory=true,liveEnabled=false,hasRealReport=false}={}){
 if(pending)return {id:'pending',headline:'A scan is already in progress',text:'Resume the existing task before considering another live scan.',tab:'scan',action:'Resume from Skin Analysis'};
 if(photoStatus==='too-small'||photoStatus==='unsupported'||photoStatus==='invalid')return {id:'too-small',headline:'Your photo needs attention',text:'Check photo size and framing before requesting a paid scan.',tab:'scan',action:'Open photo readiness'};
 if(sampleInventory)return {id:'first-run',headline:'Start with your actual shelf',text:'Example starter products are not your personal inventory.',tab:'shelf',action:'Set up My Shelf'};
 if(!liveEnabled&&!hasRealReport)return {id:'api-error',headline:'Sample mode is still available',text:'You can explore the workflow without a connected live scan.',tab:'scan',action:'Explore sample mode'};
 return {id:'focus',headline:'Understand your shopping decisions',text:'See which inputs lead to each example recommendation label.',tab:'trail',action:'Open Decision Trail'};
}
export function validHelpTab(tab){return allowedTabs.has(tab);}
