import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planLocalPhoto,PHOTO_UPLOAD_MAX_BYTES,PHOTO_SOURCE_MAX_BYTES} from '../public/photo-tools.js';

const evaluate=(width,height,size=2_000_000,type='image/jpeg')=>planLocalPhoto({width,height,size,type});

test('accepts ready-to-use original photo without resizing or AI modification',()=>{
  const p=evaluate(960,1280);
  assert.deepEqual({status:p.status,width:p.width,height:p.height},{status:'ready',width:960,height:1280});
  assert.equal(evaluate(480,2560).status,'ready');
});
test('computes proportional browser-only downsize of oversized clear photos',()=>{
  const p=evaluate(3000,4000,9_000_000);
  assert.deepEqual({status:p.status,width:p.width,height:p.height},{status:'prepare',width:1920,height:2560});
  assert.equal(evaluate(3000,4000).status,'prepare');
  const p2=evaluate(1500,2000,PHOTO_UPLOAD_MAX_BYTES+1);
  assert.deepEqual({status:p2.status,width:p2.width,height:p2.height},{status:'prepare',width:1500,height:2000});
});
test('rejects undersized originals rather than upscaling false skin detail',()=>{
  const p=evaluate(236,354);
  assert.equal(p.status,'too-small');
  assert.match(p.reason,/480 px/);
  assert.match(p.reason,/enlarging cannot recover/i);
});
test('rejects huge inputs and extreme aspect ratios that cannot satisfy both dimensions',()=>{
  assert.equal(evaluate(4000,5000,PHOTO_SOURCE_MAX_BYTES+1).status,'unsupported');
  assert.equal(evaluate(8000,8000,2_000_000).status,'unsupported');
  const skinny=evaluate(480,5000);
  assert.equal(skinny.status,'unsupported');
  assert.match(skinny.reason,/shorter side/);
});
test('blocks invalid photo metadata and non-photo formats',()=>{
  assert.equal(evaluate(0,500).status,'unsupported');
  assert.equal(evaluate(NaN,500).status,'unsupported');
  assert.equal(evaluate(1200,1600,1000).status,'unsupported');
  assert.equal(evaluate(1200,1600,200000,'image/webp').status,'unsupported');
});
test('scan interface offers local preparation but sends no photos without consent and explicit scan',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/preparePhotoLocally\(original\)/);
  assert.match(app,/id="prepare-photo"/);
  assert.match(app,/No photo is sent to RoutineGap or YouCam until you explicitly start a scan/);
  assert.match(app,/state\.canPrepare=plan\.status==='prepare'/);
  assert.match(app,/if\(!state\.consent\)return notice/);
  assert.match(app,/if\(!state\.file\)return notice/);
  const tool=await readFile(new URL('../public/photo-tools.js',import.meta.url),'utf8');
  assert.match(tool,/canvas\.toBlob/);
  assert.match(tool,/createImageBitmap\(source\)/);
  assert.doesNotMatch(tool,/(^|\W)fetch\s*\(/);
});
