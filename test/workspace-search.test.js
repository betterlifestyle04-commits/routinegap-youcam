import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalog,sampleShelf} from '../src/recommendations.js';
import {WORKSPACE_PAGES,parseWorkspaceHash,workspaceHash,searchWorkspace} from '../public/workspace-search.js';

const real=[{id:'user-a',name:'My gentle moisturiser',step:'moisturizer',price:21,tags:['hydrating']},
 {id:'user-b',name:'My sunscreen',step:'spf',price:12,tags:['lightweight']}];

test('all 10 workspaces have stable, safe shareable routes',()=>{
 assert.equal(WORKSPACE_PAGES.length,10);
 assert.equal(new Set(WORKSPACE_PAGES.map(p=>p.id)).size,10);
 for(const page of WORKSPACE_PAGES){assert.equal(parseWorkspaceHash(workspaceHash(page.id)),page.id);}
 assert.equal(workspaceHash('anything-else'),'#/overview');
});
test('navigation ignores malformed, private, unsupported and injected hash fragments',()=>{
 for(const hash of ['', '#main','#/shelf?scan=private','#/shelf#private','#/fake','#/shelf%00',
 '#/shelf/../scan','#//shop','#/SHOP','#/shop?photo=face.jpg','#/<img>','https://a.tld/#/shop',null]){
  assert.equal(parseWorkspaceHash(hash),null,String(hash));
 }
 assert.equal(parseWorkspaceHash('#/shop/'),'shop');
 assert.equal(parseWorkspaceHash('#/compare'),'compare');
});
test('empty search gives useful, navigable quick links without fabricated products',()=>{
 const items=searchWorkspace('',{catalog,shelf:real,sampleInventory:false});
 assert.equal(items.length,10);
 assert.ok(items.every(p=>p.type==='page'));
 assert.equal(items[0].title,'Overview');
});
test('search page titles, aliases and descriptions with predictable ranking',()=>{
 const a=searchWorkspace('compare',{catalog,shelf:real,sampleInventory:false});
 assert.equal(a[0].id,'compare');
 assert.equal(a[0].tab,'compare');
 assert.equal(a[0].type,'page');
 assert.ok(searchWorkspace('dashboard',{catalog})?.some(x=>x.id==='overview'));
 assert.ok(searchWorkspace('routine',{catalog})?.some(x=>x.id==='routine'));
});
test('catalog results always label fictional merchandise accurately',()=>{
 const result=searchWorkspace('mineral',{catalog,shelf:[],maxResults:20});
 assert.ok(result.some(x=>x.type==='concept'&&x.id==='mineral-spf'));
 assert.ok(result.filter(x=>x.type==='concept').every(x=>x.detail.includes('Fictional concept')));
 assert.ok(result.every(x=>!Object.hasOwn(x,'image')&&!Object.hasOwn(x,'providerData')));
});
test('user-owned shelf search works only for real user entries, never illustrative sample items',()=>{
 const sample=searchWorkspace('starter',{catalog,shelf:sampleShelf,sampleInventory:true});
 assert.ok(sample.every(x=>x.type!=='owned'));
 const result=searchWorkspace('gentle moisturiser',{catalog,shelf:real,sampleInventory:false});
 assert.ok(result.some(x=>x.type==='owned'&&x.id==='user-a'));
 assert.ok(searchWorkspace('user-b',{catalog,shelf:real,sampleInventory:true}).every(x=>x.type!=='owned'));
});
test('local search is case insensitive, bounded and returns no email/sensitive endpoint fields',()=>{
 const results=searchWorkspace('spf',{catalog,shelf:real,sampleInventory:false,maxResults:500});
 assert.ok(results.length<=20);
 assert.ok(results.every(x=>['page','concept','owned'].includes(x.type)));
 assert.ok(results.every(x=>typeof x.tab==='string'&&!x.url&&!x.photo&&!x.passcode));
 assert.deepEqual(searchWorkspace('x'.repeat(800),{catalog,shelf:real}),[]);
 assert.ok(searchWorkspace('SPF',{catalog}).length>0);
});
test('command overlay and browser routing are wired to real UI with appropriate focus semantics',async()=>{
 const [html,js,css,pkg]=await Promise.all([
   readFile(new URL('../public/index.html',import.meta.url),'utf8'),
   readFile(new URL('../public/app.js',import.meta.url),'utf8'),
   readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
   readFile(new URL('../package.json',import.meta.url),'utf8')
 ]);
 for(const s of ['id="open-workspace-search"','role="dialog"','aria-modal="true"','id="command-search-input"','id="command-results"','hidden','aria-keyshortcuts']) assert.ok(html.includes(s),s);
 for(const s of ['parseWorkspaceHash(window.location.hash)','window.history.pushState','addEventListener(\'popstate\'','addEventListener(\'hashchange\'','function openWorkspaceSearch()','function closeWorkspaceSearch','function activateCommandResult','event.key===\'Escape\'','event.key===\'Tab\'',"state.sampleInventory"]) assert.ok(js.includes(s),s);
 assert.ok(js.includes("state.catalogQuery=selected.name")&&js.includes("state.shelfQuery=selected.name"));
 assert.ok(js.includes("window.location.hash===''"));
 assert.ok(css.includes('.command-overlay[hidden]')&&css.includes('.command-dialog')&&css.includes('@media(max-width:450px)'));
 assert.ok(pkg.includes('node --check public/workspace-search.js'));
});
