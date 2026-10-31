import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HELP_ARTICLES,HELP_CATEGORIES,filterHelp,helpCategoryCounts,contextualHelp,validHelpTab} from '../public/help-center.js';
import {WORKSPACE_PAGES,workspaceHash,parseWorkspaceHash,searchWorkspace} from '../public/workspace-search.js';
import {MOBILE_MORE_TABS} from '../public/launchpad.js';

test('knowledge base has 33 genuine product-specific answers with unique allowlisted IDs',()=>{
 assert.equal(HELP_ARTICLES.length,33);
 assert.equal(HELP_CATEGORIES.length,6);
 assert.equal(WORKSPACE_PAGES.length,10);
 assert.equal(new Set(HELP_ARTICLES.map(x=>x.id)).size,HELP_ARTICLES.length);
 const categories=new Set(HELP_CATEGORIES.map(x=>x.id));
 for(const article of HELP_ARTICLES){
  assert.match(article.id,/^[a-z][a-z-]+$/);
  assert.ok(categories.has(article.category)&&article.category!=='all');
  assert.ok(article.question.length>=18,article.id);
  assert.ok(article.answer.length>=80,article.id);
  assert.ok(validHelpTab(article.tab),article.id);
  assert.ok(WORKSPACE_PAGES.some(x=>x.id===article.tab),article.id);
  assert.ok(article.keywords?.length>=3,article.id);
  assert.ok(!/<(script|iframe|img)/i.test(article.answer));
  assert.ok(Object.isFrozen(article));
 }
});
test('all category counts represent real entries, never invented usage metrics',()=>{
 const categories=helpCategoryCounts();
 assert.equal(categories[0].id,'all');
 assert.equal(categories[0].count,33);
 assert.equal(categories.slice(1).reduce((n,x)=>n+x.count,0),33);
 for(const item of categories.slice(1)){
  assert.ok(item.count>=3);
  assert.equal(item.count,filterHelp('',item.id).length);
 }
});
test('help is searchable locally by problem, synonym, question, and answer',()=>{
 const exact=filterHelp('How do I remove browser-local RoutineGap data?');
 assert.equal(exact[0].id,'erase');
 assert.ok(filterHelp('thumbnail').some(x=>x.id==='too-small'));
 assert.ok(filterHelp('SQUOOSH').some(x=>x.id==='too-large'));
 assert.ok(filterHelp('passcode').some(x=>x.id==='passcode'));
 assert.ok(filterHelp('480').some(x=>x.id==='specs'));
 assert.ok(filterHelp('nonexistent invented term zyxwvu').length===0);
 assert.equal(filterHelp('').length,HELP_ARTICLES.length);
});
test('category selection and result caps are bounded, case-insensitive and safe',()=>{
 const scans=filterHelp('photo','scan');
 assert.ok(scans.length>0);
 assert.ok(scans.every(x=>x.category==='scan'));
 assert.deepEqual(filterHelp('','invalid-category',{limit:500}).length,33);
 assert.equal(filterHelp('','all',{limit:3}).length,3);
 assert.equal(filterHelp('','all',{limit:-9}).length,1);
 assert.equal(filterHelp('','all',{limit:1.5}).length,33);
 assert.ok(filterHelp('x'.repeat(2000)).length===0);
});
test('dynamic help recommendations prioritize a pending paid scan over other conditions',()=>{
 const pending=contextualHelp({pending:true,photoStatus:'invalid',sampleInventory:true});
 assert.equal(pending.id,'pending');
 assert.equal(pending.tab,'scan');
 assert.match(pending.text,/Resume/);
 const invalid=contextualHelp({pending:false,photoStatus:'too-small',sampleInventory:false});
 assert.equal(invalid.id,'too-small');
 assert.equal(invalid.tab,'scan');
});
test('contextual recommendations never invent personal ownership or scan completion',()=>{
 assert.equal(contextualHelp({sampleInventory:true}).tab,'shelf');
 assert.equal(contextualHelp({sampleInventory:true}).id,'first-run');
 assert.equal(contextualHelp({sampleInventory:false,liveEnabled:false}).id,'api-error');
 assert.equal(contextualHelp({sampleInventory:false,liveEnabled:true}).tab,'trail');
 assert.equal(contextualHelp({sampleInventory:false,liveEnabled:false,hasRealReport:true}).tab,'trail');
});
test('global command search can find FAQs without injecting user-provided content into URLs',()=>{
 const entries=searchWorkspace('passcode',{helpArticles:HELP_ARTICLES,maxResults:20});
 assert.ok(entries.some(x=>x.type==='help'&&x.id==='passcode'));
 assert.ok(entries.filter(x=>x.type==='help').every(x=>x.tab==='help'&&x.detail.startsWith('Help article')));
 const privacy=searchWorkspace('delete data',{helpArticles:HELP_ARTICLES,maxResults:20});
 assert.ok(privacy.every(x=>!x.url&&!x.photo&&!x.passcode));
 assert.equal(workspaceHash('help'),'#/help');
 assert.equal(parseWorkspaceHash('#/help'),'help');
 assert.equal(parseWorkspaceHash('#/help?photo=private'),null);
});
test('mobile nav includes help; no unsupported destination is rendered as a link',()=>{
 assert.ok(MOBILE_MORE_TABS.some(x=>x.id==='help'));
 assert.equal(WORKSPACE_PAGES.filter(x=>x.id==='help').length,1);
 assert.equal(validHelpTab('help'),true);
 assert.equal(validHelpTab('__proto__'),false);
 assert.equal(validHelpTab('<script>'),false);
});
test('help page has an accessible keyboard/search experience, not an inert placeholder',async()=>{
 const [html,app,css,pkg]=await Promise.all([
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
  readFile(new URL('../package.json',import.meta.url),'utf8')
 ]);
 for(const required of ['id="view-help"','data-tab="help"','id="global-help"','data-mobile-tab="help"'])assert.ok(html.includes(required),required);
 for(const required of ['function renderHelp()','function renderHelpResults()','id="help-search"','id="help-results"','id="help-results-count"',
  'data-help-category','data-help-open','id="help-clear-search"','aria-controls="help-results"','aria-live="polite"'])
  assert.ok(app.includes(required),required);
 assert.ok(app.includes("help:'Help center'"));
 assert.ok(app.includes('helpArticles:HELP_ARTICLES'));
 assert.ok(app.includes("event.target.id==='help-search'"));
 assert.ok(css.includes('.help-hero')&&css.includes('.help-article')&&css.includes('@media(max-width:530px)'));
 assert.ok(pkg.includes('node --check public/help-center.js'));
});
test('help descriptions never claim live checkout, medical diagnosis or provider-side erasure',()=>{
 const byId=id=>HELP_ARTICLES.find(x=>x.id===id)?.answer||'';
 assert.match(byId('fake-products'),/fictional/);
 assert.match(byId('provider-delete'),/No/);
 assert.match(byId('key-state'),/Only a completed provider response/i);
 assert.match(byId('face-quality'),/self-reported/i);
 assert.match(byId('passcode'),/protects the paid YouCam route/i);
 assert.match(byId('erase'),/does not delete/i);
 assert.match(byId('scan-meaning'),/not a diagnosis/i);
});
