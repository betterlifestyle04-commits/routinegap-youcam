import test from 'node:test';
import assert from 'node:assert/strict';
import {startYouCamScan,YouCamError} from '../src/youcam.js';

const png=Buffer.alloc(2500);
Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
Buffer.from('IHDR').copy(png,12);
png.writeUInt32BE(800,16);png.writeUInt32BE(800,20);

async function mockUpload(instructions,body=png,mime='image/png'){
  const old=globalThis.fetch,key=process.env.YOUCAM_API_KEY,calls=[];
  process.env.YOUCAM_API_KEY='unit-test-only';
  globalThis.fetch=async(url,init)=>{
    calls.push({url:String(url),init});
    if(String(url).endsWith('/file'))return new Response(JSON.stringify({data:{files:[{file_id:'test-file-id',requests:[instructions]}]}}),{status:200});
    if(String(url).includes('amazonaws.com'))return new Response('',{status:200});
    if(String(url).endsWith('/skin-analysis'))return new Response(JSON.stringify({data:{task_id:'valid0123456789task'}}),{status:200});
    throw Error('Unexpected provider request');
  };
  try{return {result:await startYouCamScan({bytes:body,mime,fileName:'face.png'}),calls};}
  finally{globalThis.fetch=old;if(key===undefined)delete process.env.YOUCAM_API_KEY;else process.env.YOUCAM_API_KEY=key;}
}
const url='https://yce-us.s3-accelerate.amazonaws.com/demo/upload?X-Amz-Signature=unit-test';

test('uses exact Perfect Corp signed PUT headers and forbids redirects',async()=>{
  const {result,calls}=await mockUpload({
    method:'PUT',url,headers:{'Content-Type':'image/png','Content-Length':String(png.length)}
  });
  assert.equal(result.taskId,'valid0123456789task');
  assert.equal(calls.length,3);
  assert.equal(calls[1].init.method,'PUT');
  assert.equal(calls[1].init.headers['Content-Type'],'image/png');
  assert.equal(calls[1].init.headers['Content-Length'],String(png.length));
  assert.equal(calls[1].init.redirect,'error');
  assert.ok(!calls[1].init.headers.Authorization);
});
test('forwards documented image/jpg alias for actual image/jpeg payload',async()=>{
  const jpg=Buffer.alloc(2500);
  Buffer.from([255,216,255,192,0,11,8,1,224,2,208,1,1,17,0,255,217]).copy(jpg);
  const {calls}=await mockUpload({method:'PUT',url,headers:{'Content-Type':'image/jpg','Content-Length':String(jpg.length)}},jpg,'image/jpeg');
  assert.equal(calls[1].init.headers['Content-Type'],'image/jpg');
});
test('rejects incorrect signed upload length before sending a single image byte',async()=>{
  const old=globalThis.fetch,key=process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY='unit-test-only';
  let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({data:{files:[{file_id:'test-file-id',requests:[{method:'PUT',url,headers:{'Content-Type':'image/png','Content-Length':'999'}}]}]}}),{status:200});};
  try{await assert.rejects(()=>startYouCamScan({bytes:png,mime:'image/png'}),error=>error instanceof YouCamError&&/did not match/.test(error.message));assert.equal(calls,1);}
  finally{globalThis.fetch=old;if(key===undefined)delete process.env.YOUCAM_API_KEY;else process.env.YOUCAM_API_KEY=key;}
});
test('rejects unexpected upload Authorization headers instead of forwarding secrets',async()=>{
  const old=globalThis.fetch,key=process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY='unit-test-only';
  let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({data:{files:[{file_id:'test-file-id',requests:[{method:'PUT',url,headers:{Authorization:'Bearer do-not-forward'}}]}]}}),{status:200});};
  try{await assert.rejects(()=>startYouCamScan({bytes:png,mime:'image/png'}),/unexpected upload headers/);assert.equal(calls,1);}
  finally{globalThis.fetch=old;if(key===undefined)delete process.env.YOUCAM_API_KEY;else process.env.YOUCAM_API_KEY=key;}
});
test('rejects S3 lookalike and non-HTTPS upload destinations before transferring photo',async()=>{
  for(const bad of ['https://s3.amazonaws.com.evil.test/upload','http://s3.amazonaws.com/upload','https://user:pass@s3.amazonaws.com/upload','https://s3.amazonaws.com:8443/upload']){
    const old=globalThis.fetch,key=process.env.YOUCAM_API_KEY;process.env.YOUCAM_API_KEY='unit-test-only';
    let calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({data:{files:[{file_id:'f',requests:[{method:'PUT',url:bad}]}]}}),{status:200});};
    try{await assert.rejects(()=>startYouCamScan({bytes:png,mime:'image/png'}),/Unexpected provider file upload destination/);assert.equal(calls,1);}
    finally{globalThis.fetch=old;if(key===undefined)delete process.env.YOUCAM_API_KEY;else process.env.YOUCAM_API_KEY=key;}
  }
});
