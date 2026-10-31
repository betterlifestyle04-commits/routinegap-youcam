/**
 * Offline workspace navigation and global command search.
 * Only the tab is shareable. Searches, shelf products, photos and scan
 * observations never become query strings or URL fragments.
 */
export const WORKSPACE_PAGES=Object.freeze([
  {id:'overview',title:'Overview',description:'Your skincare workspace and guided journey',aliases:['home','dashboard','start']},
  {id:'scan',title:'Skin analysis',description:'Prepare a photo or explore a clearly labeled sample',aliases:['youcam','photo','ai','results']},
  {id:'shelf',title:'My shelf',description:'Manage products you actually own',aliases:['inventory','owned','products']},
  {id:'routine',title:'Routine planner',description:'Your private morning and evening checklist',aliases:['morning','evening','daily','schedule']},
  {id:'insights',title:'My insights',description:'Coverage, recorded costs and budget what-ifs',aliases:['analytics','budget','spending','stats']},
  {id:'shop',title:'Shopping studio',description:'Explore 25 fictional concept products',aliases:['catalog','discover','browse','buy']},
  {id:'compare',title:'Compare lab',description:'Compare up to three illustrated concept products',aliases:['comparison','side by side']},
  {id:'trail',title:'Decision trail',description:'Inspect reasoning and export a private report',aliases:['evidence','explain','report','transparency']},
  {id:'privacy',title:'Privacy & data',description:'View, export or delete information stored in this browser',aliases:['settings','data','erase','delete','export','consent']},
  {id:'help',title:'Help center',description:'Search guidance and troubleshooting for scans, products and privacy',aliases:['support','faq','help','troubleshooting','questions']}
]);
const allowed=new Set(WORKSPACE_PAGES.map(p=>p.id));
export function parseWorkspaceHash(hash){
 if(typeof hash!=='string')return null;
 const matched=/^#\/([a-z]+)\/?$/.exec(hash);
 return matched&&allowed.has(matched[1])?matched[1]:null;
}
export function workspaceHash(tab){
 return allowed.has(tab)?'#/'+tab:'#/overview';
}
function relevance(needle,values){
 let best=0;
 for(const value of values){
   const text=String(value??'').toLocaleLowerCase('en');
   if(text===needle)best=Math.max(best,4);
   else if(text.startsWith(needle))best=Math.max(best,3);
   else if(text.includes(needle))best=Math.max(best,1);
 }
 return best;
}
export function searchWorkspace(query,{catalog=[],shelf=[],sampleInventory=true,maxResults=10}={}){
 const q=String(query??'').trim().slice(0,80).toLocaleLowerCase('en');
 const cap=Number.isInteger(maxResults)?Math.max(1,Math.min(20,maxResults)):10;
 const results=[];
 for(const page of WORKSPACE_PAGES){
   const score=q?relevance(q,[page.title,page.description,...page.aliases]):1;
   if(score)results.push({type:'page',id:page.id,title:page.title,
      detail:page.description,tab:page.id,score:score+1});
 }
 if(q.length>=2){
   if(Array.isArray(catalog)){
     for(const product of catalog){
       if(!product||typeof product.id!=='string'||typeof product.name!=='string')continue;
       const score=relevance(q,[product.name,product.step,product.description,product.brand,...(Array.isArray(product.tags)?product.tags:[])]);
       if(score)results.push({type:'concept',id:product.id,title:product.name,
         detail:'Fictional concept · '+product.step+' · demo price $'+Number(product.price||0).toFixed(0),tab:'shop',score});
     }
   }
   if(!sampleInventory&&Array.isArray(shelf)){
     for(const p of shelf){
       if(!p||typeof p.id!=='string'||typeof p.name!=='string')continue;
       const score=relevance(q,[p.name,p.step,...(Array.isArray(p.tags)?p.tags:[])]);
       if(score)results.push({type:'owned',id:p.id,title:p.name,
         detail:'Your locally recorded shelf · '+p.step,tab:'shelf',score:score+1});
     }
   }
 }
 if(!q)return results.slice(0,cap);
 const rank={page:0,owned:1,concept:2};
 results.sort((a,b)=>b.score-a.score||rank[a.type]-rank[b.type]||a.title.localeCompare(b.title,'en'));
 return results.slice(0,cap);
}
