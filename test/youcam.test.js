import test from 'node:test';import assert from 'node:assert/strict';
import {startYouCamScan,getYouCamScan,verifyYouCamAccess,YouCamError} from '../src/youcam.js';
const examplePng=Buffer.alloc(2500);Buffer.from([137,80,78,71,13,10,26,10]).copy(examplePng);
test('rejects invalid MIME/signature without spending credits',async()=>{let n=0;const old=globalThis.fetch;globalThis.fetch=async()=>{n++;throw Error('should not call');};try{await assert.rejects(()=>startYouCamScan({bytes:examplePng,mime:'image/jpeg',fileName:'a.jpg'}),err=>err instanceof YouCamError&&err.status===400);assert.equal(n,0);}finally{globalThis.fetch=old;}});
test('the live upload flow calls File API, presigned PUT and actual Skin Analysis task',async()=>{const old=globalThis.fetch,key=process.env.YOUCAM_API_KEY;process.env.YOUCAM_API_KEY='unit-test-only';const calls=[];globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});if(String(url).endsWith('/file'))return new Response(JSON.stringify({data:{files:[{file_id:'provider-file-id',requests:[{method:'PUT',url:'https://yce-us.s3-accelerate.amazonaws.com/upload?signature=abc'}]}]}}),{status:200});if(String(url).includes('amazonaws.com'))return new Response('',{status:200});if(String(url).endsWith('/skin-analysis'))return new Response(JSON.stringify({data:{task_id:'abcdef01234567890'}}),{status:200});throw Error('unexpected');};try{const x=await startYouCamScan({bytes:examplePng,mime:'image/png',fileName:'face.png'});assert.equal(x.taskId,'abcdef01234567890');assert.equal(calls.length,3);assert.equal(calls[0].init.headers.Authorization,'Bearer unit-test-only');assert.equal(calls[1].init.method,'PUT');assert.ok(!calls[1].init.headers.Authorization);assert.deepEqual(JSON.parse(calls[2].init.body).dst_actions,['moisture','oiliness','pore','texture','redness','skin_type']);}finally{globalThis.fetch=old;if(key===undefined)delete process.env.YOUCAM_API_KEY;else process.env.YOUCAM_API_KEY=key;}});
test('rejects unapproved signed upload host before transferring a selfie',async()=>{const old=globalThis.fetch,key=process.env.YOUCAM_API_KEY;process.env.YOUCAM_API_KEY='unit-test-only';let calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({data:{files:[{file_id:'id',requests:[{method:'PUT',url:'https://steal.example.com/upload'}]}]}}),{status:200});};try{await assert.rejects(()=>startYouCamScan({bytes:examplePng,mime:'image/png',fileName:'a.png'}),/Unexpected provider file upload destination/);assert.equal(calls,1);}finally{globalThis.fetch=old;if(key===undefined)delete process.env.YOUCAM_API_KEY;else process.env.YOUCAM_API_KEY=key;}});
test('polling normalizes live response without synthesizing medical confidence',async()=>{const old=globalThis.fetch,key=process.env.YOUCAM_API_KEY;process.env.YOUCAM_API_KEY='unit-test-only';globalThis.fetch=async()=>new Response(JSON.stringify({data:{task_status:'success',results:{output:[{type:'moisture',ui_score:69,raw_score:44}]}}}),{status:200});try{const x=await getYouCamScan('abcdef01234567890');assert.equal(x.state,'success');assert.deepEqual(x.signals.map(s=>[s.type,s.uiScore,s.rawScore]),[['moisture',69,44]]);}finally{globalThis.fetch=old;if(key===undefined)delete process.env.YOUCAM_API_KEY;else process.env.YOUCAM_API_KEY=key;}});
test('invalid task IDs never reach provider',async()=>{await assert.rejects(()=>getYouCamScan('../unsafe'),err=>err.status===400);});

test('free YouCam provider preflight authenticates without creating a scan or spending credits',async()=>{
  const old=globalThis.fetch,key=process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY='unit-test-key';
  let calls=0;
  globalThis.fetch=async(url,init)=>{
    calls++;
    assert.equal(String(url),'https://yce-api-01.makeupar.com/s2s/v1.0/client/credit');
    assert.equal(init.method,'GET');
    assert.equal(init.headers.Authorization,'Bearer unit-test-key');
    assert.equal(init.body,undefined);
    return new Response(JSON.stringify({results:[{type:'ApiFree',amount:1000}]}),{status:200});
  };
  try{assert.deepEqual(await verifyYouCamAccess(),{authenticated:true});assert.equal(calls,1);}
  finally{globalThis.fetch=old;if(key===undefined)delete process.env.YOUCAM_API_KEY;else process.env.YOUCAM_API_KEY=key;}
});
test('preflight rejects invalid keys without leaking the token or claiming authentication',async()=>{
  const old=globalThis.fetch,key=process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY='my-secret-invalid-token';
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'InvalidAccessToken'}),{status:401});
  try{await assert.rejects(()=>verifyYouCamAccess(),error=>
    error instanceof YouCamError&&error.status===503&&!error.message.includes('my-secret-invalid-token'));}
  finally{globalThis.fetch=old;if(key===undefined)delete process.env.YOUCAM_API_KEY;else process.env.YOUCAM_API_KEY=key;}
});
test('preflight refuses malformed provider balance response as verified authentication',async()=>{
  const old=globalThis.fetch,key=process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY='unit-test-key';
  globalThis.fetch=async()=>new Response(JSON.stringify({status:'unknown'}),{status:200});
  try{await assert.rejects(()=>verifyYouCamAccess(),/unexpected response/);}
  finally{globalThis.fetch=old;if(key===undefined)delete process.env.YOUCAM_API_KEY;else process.env.YOUCAM_API_KEY=key;}
});
