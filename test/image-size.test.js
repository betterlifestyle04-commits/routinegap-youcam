import test from 'node:test';
import assert from 'node:assert/strict';
import {imageDimensions,validSkinAnalysisDimensions,skinDimensionMessage} from '../src/image-size.js';

const png=(width,height)=>{
  const b=Buffer.alloc(32);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(b);
  Buffer.from('IHDR').copy(b,12);
  b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);
  return b;
};
test('reads PNG dimensions and enforces official YouCam standard analysis limits',()=>{
  assert.deepEqual(imageDimensions(png(640,800),'image/png'),{width:640,height:800});
  assert.equal(validSkinAnalysisDimensions({width:640,height:800}),true);
  assert.equal(validSkinAnalysisDimensions({width:236,height:354}),false);
  assert.equal(validSkinAnalysisDimensions({width:480,height:2560}),true);
  assert.equal(validSkinAnalysisDimensions({width:480,height:2561}),false);
  assert.match(skinDimensionMessage({width:236,height:354}),/236 × 354/);
});
test('rejects broken PNG signature and header rather than trusting MIME label',()=>{
  assert.throws(()=>imageDimensions(Buffer.from('fake'),'image/png'),/Invalid PNG/);
  const bad=png(640,800);bad[13]=0;
  assert.throws(()=>imageDimensions(bad,'image/png'),/Invalid PNG/);
});
test('reads JPEG SOF dimensions even after metadata segments',()=>{
  const jpeg=Buffer.from([
    255,216,255,224,0,4,0,0,
    255,192,0,11,8,1,224,2,208,1,1,17,0,
    255,217,0,0
  ]);
  assert.deepEqual(imageDimensions(jpeg,'image/jpeg'),{width:720,height:480});
  assert.equal(validSkinAnalysisDimensions(imageDimensions(jpeg,'image/jpeg')),true);
});
test('rejects invalid JPEG files and unknown formats',()=>{
  assert.throws(()=>imageDimensions(Buffer.from('not jpeg at all'),'image/jpeg'),/Invalid JPEG/);
  assert.throws(()=>imageDimensions(png(640,800),'application/octet-stream'),/JPEG or PNG/);
});
