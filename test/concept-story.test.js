import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalog,sampleShelf,evaluateShop} from '../src/recommendations.js';
import {CATEGORY_GUIDES,TAG_GLOSSARY,buildConceptStory} from '../public/concept-story.js';

const owned=[{id:'real-c',name:'My existing cleanser',step:'cleanser',price:14,tags:['gentle']},
 {id:'real-spf',name:'My labeled sunscreen',step:'spf',price:19,tags:[]}];
const scenario={shelf:owned,budget:60,goal:'moisture',fragranceFree:false};
function story(id,overrides={}){
 const {shelf=owned,budget=60,goal='moisture',fragranceFree=false,sampleInventory=false}=overrides;
 const d=evaluateShop({shelf,budget,goal,fragranceFree});
 return buildConceptStory({id,catalog,decisionRows:d.rows,owned:d.owned,sampleInventory,budget,goal,fragranceFree});
}
test('all 25 fictional concepts have valid transparent category guides and full tag descriptions',()=>{
 assert.equal(catalog.length,25);
 assert.deepEqual(Object.keys(CATEGORY_GUIDES).sort(),['cleanser','moisturizer','serum','spf']);
 for(const item of catalog){
  const d=story(item.id,{shelf:[]});
  assert.ok(d,item.id);
  assert.equal(d.id,item.id);
  assert.equal(d.name,item.name);
  assert.equal(d.price,item.price);
  assert.equal(d.tags.length,item.tags.length);
  assert.ok(d.tags.every(x=>x.meaning.length>12));
  assert.ok(d.related.every(x=>x.id!==item.id&&x.step===item.step));
  assert.ok(d.related.length>=2);
  assert.match(d.disclosure,/Fictional educational catalog/);
  assert.ok(d.category.caution.length>25);
 }
 for(const tag of new Set(catalog.flatMap(p=>p.tags)))assert.ok(TAG_GLOSSARY[tag],tag);
});
test('rejects unknown product IDs and mismatched identifier types',()=>{
 for(const id of ['nope','<script>','__proto__',null,undefined,23])assert.equal(story(id),null);
});
test('only actual owned category can produce a shelf overlap notice',()=>{
 const d=story('mist-cleanser');
 assert.equal(d.duplicate,true);
 assert.deepEqual(d.existing,['My existing cleanser']);
 assert.equal(d.storyLabel,'ALREADY COVERED');
 assert.ok(d.reason.length>10);
 const spf=story('mineral-spf');
 assert.equal(spf.duplicate,true);
 assert.deepEqual(spf.existing,['My labeled sunscreen']);
 const no=story('daily-gel');
 assert.equal(no.duplicate,false);
 assert.deepEqual(no.existing,[]);
});
test('sample starter shelf can never be misrepresented as genuinely owned',()=>{
 const d=story('mist-cleanser',{shelf:sampleShelf,sampleInventory:true});
 assert.equal(d.duplicate,false);
 assert.deepEqual(d.existing,[]);
 assert.equal(d.sampleInventory,true);
 assert.equal(d.demoCovered,true);
 assert.equal(d.storyLabel,'SAMPLE SCENARIO OVERLAP');
 assert.match(d.reason,/NOT evidence of ownership/);
});
test('demo budget is strictly bounded and individually evaluated, never a real offer',()=>{
 const low=story('mineral-spf',{shelf:[],budget:10});
 assert.equal(low.demoBudget,10);
 assert.equal(low.individuallyAffordable,false);
 const high=story('mineral-spf',{shelf:[],budget:999999});
 assert.equal(high.demoBudget,1000);
 assert.equal(high.individuallyAffordable,true);
 const invalid=story('mineral-spf',{shelf:[],budget:NaN});
 assert.equal(invalid.demoBudget,0);
});
test('fragrance and goal are concept tags, not verified suitability or clinical efficacy',()=>{
 const a=story('barrier-cream',{shelf:[],goal:'moisture',fragranceFree:true});
 assert.equal(a.fragranceTagged,true);
 assert.equal(a.goalTagged,true);
 assert.equal(a.fragranceFilter,true);
 assert.match(TAG_GLOSSARY['fragrance-free'],/not ingredient-label verification/);
 const b=story('clear-spf',{shelf:[],goal:'moisture',fragranceFree:true});
 assert.equal(b.fragranceTagged,false);
 assert.equal(b.goalTagged,false);
 assert.match(CATEGORY_GUIDES.spf.caution,/not tested or certified/);
});
test('related examples are distinct same-category alternatives sorted by price proximity',()=>{
 const item=story('mineral-spf',{shelf:[]});
 const source=catalog.find(p=>p.id===item.id);
 const gaps=item.related.map(x=>Math.abs(x.price-source.price));
 assert.deepEqual(gaps,[...gaps].sort((a,b)=>a-b));
 assert.equal(new Set(item.related.map(x=>x.id)).size,item.related.length);
});
test('model reads input without mutating catalog, actual shelf or decision rows',()=>{
 const rows=evaluateShop(scenario).rows;
 const before=JSON.stringify({catalog,owned,rows});
 const s=buildConceptStory({id:'mist-cleanser',catalog,decisionRows:rows,owned,budget:60,goal:'moisture'});
 s.related[0].name='Modified in copy';
 assert.equal(JSON.stringify({catalog,owned,rows}),before);
});
test('detail overlay is accessible and integrated with search, saved board, cart and comparison',async()=>{
 const [app,html,css,pkg]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
  readFile(new URL('../package.json',import.meta.url),'utf8')
 ]);
 for(const part of ['id="concept-story-overlay"','id="concept-story-content"','role="dialog"','aria-modal="true"','id="close-concept-story"'])assert.ok(html.includes(part),part);
 for(const part of ['function renderConceptStory()','function openConceptStory(id)','function closeConceptStory(','data-open-story','data-cart','data-save','data-compare','aria-pressed','storyId','buildConceptStory(','openConceptStory(entry.id)'])assert.ok(app.includes(part),part);
 assert.ok(app.includes("if(state.storyId&&tab!=='shop')closeConceptStory"));
 assert.ok(css.includes('.story-overlay[hidden]')&&css.includes('.story-layout')&&css.includes('@media(max-width:710px)'));
 assert.ok(pkg.includes('node --check public/concept-story.js'));
});
