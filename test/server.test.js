import test from 'node:test';import assert from 'node:assert/strict';
import {server} from '../server.js';
test('serves functioning homepage and does not pretend YouCam is configured',async()=>{
  const old=[process.env.LIVE_SCANS_ENABLED,process.env.YOUCAM_API_KEY,process.env.DEMO_ACCESS_TOKEN];delete process.env.YOUCAM_API_KEY;delete process.env.DEMO_ACCESS_TOKEN;process.env.LIVE_SCANS_ENABLED='false';
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{const base='http://127.0.0.1:'+server.address().port;const home=await fetch(base+'/');assert.equal(home.status,200);assert.match(await home.text(),/Your shelf first/);const status=await fetch(base+'/api/status');assert.deepEqual((await status.json()).liveEnabled,false);const blocked=await fetch(base+'/api/scan',{method:'POST',headers:{'Content-Type':'image/png'},body:Buffer.from('fake')});assert.equal(blocked.status,503);const script=await fetch(base+'/app.js');assert.equal(script.status,200);const engine=await fetch(base+'/recommendations.js');assert.equal(engine.status,200);}finally{await new Promise(r=>server.close(r));const keys=['LIVE_SCANS_ENABLED','YOUCAM_API_KEY','DEMO_ACCESS_TOKEN'];keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}
});
