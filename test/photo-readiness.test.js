import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planLocalPhoto} from '../public/photo-tools.js';
import {SELF_CHECKS,SELF_CHECK_IDS,normalizeSelfChecks,toggleSelfCheck,photoReadiness} from '../public/photo-readiness.js';

const original=(size=500_000,type='image/jpeg')=>({name:'face.jpg',size,type});
const scenario=(width=960,height=1280,size=500_000,type='image/jpeg')=>{
 const sourceFile=original(size,type);
 const plan=planLocalPhoto({width,height,size,type});
 return {sourceFile,preparedFile:plan.status==='ready'?sourceFile:null,dimensions:{width,height},plan};
};
test('photo dashboard separates validated bytes and pixel limits from manual face quality',()=>{
 const r=photoReadiness({...scenario(),consent:true,passcodeReady:true,providerReady:true});
 assert.equal(r.status,'ready');
 assert.equal(r.technicalReady,true);
 assert.equal(r.canRequestScan,true);
 assert.equal(r.manualCount,0);
 assert.equal(r.manualTotal,4);
 assert.ok(r.diagnostics.every(x=>x.status==='pass'));
 assert.match(r.truth,/not automatically verified/);
 assert.match(r.next,/YouCam/);
});
test('unsupported or tiny images never become technically ready',()=>{
 const small=photoReadiness({...scenario(236,354)});
 assert.equal(small.status,'invalid');
 assert.equal(small.technicalReady,false);
 assert.equal(small.diagnostics.find(x=>x.id==='minPixels').status,'fail');
 assert.equal(small.canRequestScan,false);
 assert.match(small.next,/480/);
 const unknown=photoReadiness({...scenario(960,1280,500000,'image/webp')});
 assert.equal(unknown.status,'invalid');
 assert.equal(unknown.diagnostics.find(x=>x.id==='format').status,'fail');
});
test('oversized valid originals explicitly request local preparation',()=>{
 const file=scenario(3000,4000,7_000_000);
 const r=photoReadiness(file);
 assert.equal(r.status,'prepare');
 assert.equal(r.needsPreparation,true);
 assert.equal(r.technicalReady,false);
 assert.equal(r.diagnostics.find(x=>x.id==='maxPixels').status,'fix');
 assert.match(r.next,/Prepare/);
});
test('files above 8 MB but below 24 MB require safe reduction; over 24 MB reject',()=>{
 const large=photoReadiness(scenario(960,1280,10_000_000));
 assert.equal(large.status,'prepare');
 assert.equal(large.diagnostics.find(x=>x.id==='uploadSize').status,'fix');
 const tooBig=photoReadiness(scenario(3000,4000,27_000_000));
 assert.equal(tooBig.status,'invalid');
 assert.equal(tooBig.diagnostics.find(x=>x.id==='sourceSize').status,'fail');
});
test('successful local preparation is shown as ready using final dimensions and file bytes',()=>{
 const first=scenario(3000,4000,10_000_000);
 const prepared=original(900_000,'image/jpeg');
 const check=photoReadiness({...first,sourceFile:prepared,preparedFile:prepared,dimensions:{width:1920,height:2560},plan:{status:'ready'}});
 assert.equal(check.status,'ready');
 assert.equal(check.technicalReady,true);
 assert.equal(check.diagnostics.find(x=>x.id==='maxPixels').status,'pass');
 assert.equal(check.diagnostics.find(x=>x.id==='uploadSize').status,'pass');
});
test('pending scans and busy state prevent duplicate paid calls',()=>{
 const root={...scenario(),consent:true,passcodeReady:true,providerReady:true};
 assert.equal(photoReadiness({...root,pending:true}).canRequestScan,false);
 assert.match(photoReadiness({...root,pending:true}).next,/Resume/);
 assert.equal(photoReadiness({...root,busy:true}).canRequestScan,false);
 assert.equal(photoReadiness({...root,preparing:true}).canRequestScan,false);
});
test('consent, private passcode and server readiness remain independent gates',()=>{
 const root={...scenario()};
 assert.equal(photoReadiness(root).canRequestScan,false);
 assert.match(photoReadiness(root).next,/consent/);
 assert.match(photoReadiness({...root,consent:true}).next,/passcode/);
 assert.equal(photoReadiness({...root,consent:true,passcodeReady:true}).canRequestScan,false);
 assert.match(photoReadiness({...root,consent:true,passcodeReady:true}).next,/not available/);
 assert.equal(photoReadiness({...root,consent:true,passcodeReady:true,providerReady:true}).canRequestScan,true);
});
test('self-checks are explicit, allowlisted and never treated as machine verification',()=>{
 assert.equal(SELF_CHECKS.length,4);
 assert.deepEqual(SELF_CHECK_IDS,['front','lighting','uncovered','unfiltered']);
 assert.deepEqual(normalizeSelfChecks({front:true,lighting:false,hack:true}),{front:true});
 let selected=toggleSelfCheck({hack:true},'front',true);
 selected=toggleSelfCheck(selected,'lighting',true);
 assert.deepEqual(selected,{front:true,lighting:true});
 selected=toggleSelfCheck(selected,'lighting',false);
 assert.deepEqual(selected,{front:true});
 const bad=toggleSelfCheck(selected,'payload',true);
 assert.deepEqual(bad,{front:true});
 const r=photoReadiness({...scenario(),checks:{front:true,lighting:true,uncovered:true,unfiltered:true}});
 assert.equal(r.manualCount,4);
 assert.equal(r.technicalReady,true);
 assert.equal(r.canRequestScan,false);
});
test('empty selection is transparent and does not imply photo is processed',()=>{
 const r=photoReadiness({});
 assert.equal(r.status,'empty');
 assert.equal(r.technicalReady,false);
 assert.equal(r.selected,false);
 assert.equal(r.dimensions,null);
 assert.equal(r.manualCount,0);
 assert.equal(r.canRequestScan,false);
 assert.ok(r.diagnostics.every(x=>x.status==='pending'));
 assert.match(r.next,/Choose/);
});
test('UI wired to genuine scan journey, drag-drop and local-only events',async()=>{
 const [app,css,pkg]=await Promise.all([
   readFile(new URL('../public/app.js',import.meta.url),'utf8'),
   readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
   readFile(new URL('../package.json',import.meta.url),'utf8')
 ]);
 for(const marker of ['function renderPhotoReadiness()','id="photo-readiness-panel"','data-photo-selfcheck','photoReadiness({',
  'toggleSelfCheck(','photo-drop-zone','document.addEventListener(\'drop\'','document.addEventListener(\'dragover\'',
  'state.consent=false;state.photoSelfChecks={};','storeFile(files[0])','role="region"','renderPhotoReadiness();'])
   assert.ok(app.includes(marker),marker);
 assert.ok(css.includes('.readiness-diagnostic')&&css.includes('.readiness-selfcheck')&&css.includes('.photo-drop-zone.is-dragover'));
 assert.ok(pkg.includes('node --check public/photo-readiness.js'));
 assert.ok(!app.includes('fetch(\'/api/photo/readiness\''));
});
