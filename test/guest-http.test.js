import test from 'node:test';
import assert from 'node:assert/strict';
import {server,refreshProviderConnection} from '../server.js';

const validPNG=Buffer.alloc(2500);
Buffer.from([137,80,78,71,13,10,26,10]).copy(validPNG);
Buffer.from('IHDR').copy(validPNG,12);
validPNG.writeUInt32BE(800,16);validPNG.writeUInt32BE(800,20);

test('judges can complete a simulated real provider receipt and report WITHOUT passcode, with hard quota and consent',async()=>{
 const names=['LIVE_SCANS_ENABLED','PUBLIC_JUDGE_SCANS_ENABLED','DEMO_ACCESS_TOKEN','YOUCAM_API_KEY','PUBLIC_ORIGIN'];
 const prev=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 const orig=globalThis.fetch;
 Object.assign(process.env,{LIVE_SCANS_ENABLED:'true',PUBLIC_JUDGE_SCANS_ENABLED:'true',DEMO_ACCESS_TOKEN:'unit-test-signing-secret-12345',YOUCAM_API_KEY:'unit-test-not-real',PUBLIC_ORIGIN:''});
 let providerStarts=0,uploads=0,statusChecks=0;
 globalThis.fetch=async(input,init)=>{
  const url=String(input);
  if(url.startsWith('http://127.0.0.1:'))return orig(input,init);
  if(url.endsWith('/s2s/v1.0/client/credit'))return new Response(JSON.stringify({results:[{type:'ApiFree',amount:100}]}),{status:200});
  if(url.endsWith('/s2s/v2.0/file'))return new Response(JSON.stringify({data:{files:[{file_id:'mock-private-file',requests:[{method:'PUT',url:'https://yce-us.s3-accelerate.amazonaws.com/mock?signature=not-real'}]}]}}),{status:200});
  if(url.includes('amazonaws.com')){uploads++;return new Response('',{status:200});}
  if(url.endsWith('/s2s/v2.0/task/skin-analysis')){providerStarts++;return new Response(JSON.stringify({data:{task_id:'abcdef01234567890'}}),{status:200});}
  if(url.endsWith('/s2s/v2.0/task/skin-analysis/abcdef01234567890')){statusChecks++;return new Response(JSON.stringify({data:{task_status:'success',results:{output:[{type:'moisture',ui_score:74,raw_score:50}]}}}),{status:200});}
  throw new Error('Unexpected outbound request '+url);
 };
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal(await refreshProviderConnection(),'authenticated');
  const stat=await (await orig(base+'/api/status')).json();
  assert.equal(stat.liveEnabled,true);
  assert.equal(stat.guestEnabled,true);
  assert.equal(stat.guestRemaining,3);
  const headers={'Content-Type':'image/png','X-Skin-Consent':'yes','X-Image-Filename':'synthetic-pattern.png','X-Forwarded-For':'198.51.100.1'};
  const noConsent=await orig(base+'/api/scan',{method:'POST',headers:{...headers,'X-Skin-Consent':'no'},body:validPNG});
  assert.equal(noConsent.status,400);
  const invalid=Buffer.from(validPNG);invalid.writeUInt32BE(250,16);invalid.writeUInt32BE(350,20);
  const tooSmall=await orig(base+'/api/scan',{method:'POST',headers,body:invalid});
  assert.equal(tooSmall.status,400);
  assert.equal((await (await orig(base+'/api/status')).json()).guestRemaining,3,'Invalid images never burn public paid slots');
  const response=await orig(base+'/api/scan',{method:'POST',headers,body:validPNG});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.state,'running');
  assert.ok(result.receipt?.length>40);
  assert.equal(providerStarts,1);
  assert.equal(uploads,1);
  assert.equal((await (await orig(base+'/api/status')).json()).guestRemaining,2);
  const poll=await orig(base+'/api/scan/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receipt:result.receipt})});
  assert.equal(poll.status,200);
  assert.deepEqual((await poll.json()).signals.map(s=>s.uiScore),[74]);
  assert.equal(statusChecks,1);
  const duplicate=await orig(base+'/api/scan',{method:'POST',headers,body:validPNG});
  assert.equal(duplicate.status,429);
  assert.match((await duplicate.json()).error,/one no-passcode/i);
  const forged=await orig(base+'/api/scan/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receipt:'forged'})});
  assert.equal(forged.status,404);
  const badOwner=await orig(base+'/api/scan',{method:'POST',headers:{...headers,'X-Demo-Access':'wrong-secret'},body:validPNG});
  assert.equal(badOwner.status,401);
  assert.equal(providerStarts,1,'No other test path started a provider task');
 }finally{
  globalThis.fetch=orig;
  await new Promise(resolve=>server.close(resolve));
  for(const k of names){if(prev[k]===undefined)delete process.env[k];else process.env[k]=prev[k];}
 }
});
