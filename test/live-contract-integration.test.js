import test from 'node:test';
import assert from 'node:assert/strict';

// This test runs against the real local HTTP server and an explicitly mocked
// Perfect Corp/S3 transport. It NEVER contacts the real vendor or uses credits.
process.env.NODE_ENV='test';
const {server,refreshProviderConnection}=await import('../server.js');

const face=Buffer.alloc(2500);
Buffer.from([137,80,78,71,13,10,26,10]).copy(face);
Buffer.from('IHDR').copy(face,12);
face.writeUInt32BE(800,16);face.writeUInt32BE(800,20);
const sampleTask='grH0CvsgXuAIHLUzD0V1Ol34hoet3R1tvdbtiVHrDb6_UqCLKIejAIajwxrhOAfe';
const json=body=>new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
const api='https://yce-api-01.makeupar.com';

test('complete HTTP contract: auth → consented upload → signed S3 PUT → task → receipt polling → real-labeled normalized report',async()=>{
  const originalFetch=globalThis.fetch;
  const oldEnv=Object.fromEntries(['YOUCAM_API_KEY','DEMO_ACCESS_TOKEN','LIVE_SCANS_ENABLED','NODE_ENV'].map(k=>[k,process.env[k]]));
  process.env.NODE_ENV='test';process.env.YOUCAM_API_KEY='mock-api-key';
  process.env.DEMO_ACCESS_TOKEN='private-test-passcode-12345';process.env.LIVE_SCANS_ENABLED='true';
  const upstream=[];
  let statusCalls=0,base;
  try{
    globalThis.fetch=async(url,init={})=>{
      const address=String(url);
      if(base&&address.startsWith(base+'/'))return originalFetch(url,init);
      upstream.push({url:address,method:init.method||'GET',headers:init.headers,redirect:init.redirect,body:init.body});
      if(address===api+'/s2s/v1.0/client/credit')return json({status:200,results:[{type:'ApiFree',amount:20}]});
      if(address===api+'/s2s/v2.0/file'){
        assert.equal(init.headers.Authorization,'Bearer mock-api-key');
        assert.equal(JSON.parse(init.body).files[0].content_type,'image/png');
        return json({status:200,data:{files:[{file_id:'example-provider-file-id',requests:[{
          method:'PUT',url:'https://yce-us.s3-accelerate.amazonaws.com/demo/test?signature=fake',
          headers:{'Content-Length':String(face.length),'Content-Type':'image/png'}
        }]}]}});
      }
      if(address.startsWith('https://yce-us.s3-accelerate.amazonaws.com/')){
        assert.equal(init.method,'PUT');
        assert.equal(init.redirect,'error');
        assert.equal(init.headers['Content-Length'],String(face.length));
        assert.deepEqual(Buffer.from(init.body),face);
        assert.equal(init.headers.Authorization,undefined);
        return new Response('',{status:200});
      }
      if(address===api+'/s2s/v2.0/task/skin-analysis'){
        assert.equal(init.method,'POST');
        const data=JSON.parse(init.body);
        assert.equal(data.src_file_id,'example-provider-file-id');
        assert.equal(data.format,'json');
        assert.deepEqual(data.dst_actions,['moisture','oiliness','pore','texture','redness','skin_type']);
        return json({status:200,data:{task_id:sampleTask}});
      }
      if(address===api+'/s2s/v2.0/task/skin-analysis/'+encodeURIComponent(sampleTask)){
        statusCalls++;
        if(statusCalls===1)return json({status:200,data:{task_status:'running'}});
        return json({status:200,data:{task_status:'success',results:{output:{
          moisture:{raw_score:46,ui_score:71},
          redness:{raw_score:51,ui_score:68},
          skin_type:{whole:'Combination'}
        }}}});
      }
      throw new Error('Unexpected upstream URL: '+address);
    };
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    base='http://127.0.0.1:'+server.address().port;
    assert.equal(await refreshProviderConnection(),'authenticated');
    let res=await globalThis.fetch(base+'/api/status');
    assert.equal((await res.json()).providerConnection,'authenticated');
    // Missing demo access / photo consent must never call provider or spend scan quota.
    const count=upstream.length;
    res=await globalThis.fetch(base+'/api/scan',{method:'POST',headers:{'Content-Type':'image/png','X-Skin-Consent':'yes'},body:face});
    assert.equal(res.status,401);
    res=await globalThis.fetch(base+'/api/scan',{method:'POST',headers:{'Content-Type':'image/png','X-Demo-Access':process.env.DEMO_ACCESS_TOKEN},body:face});
    assert.equal(res.status,400);
    assert.equal(upstream.length,count);
    res=await globalThis.fetch(base+'/api/scan',{method:'POST',headers:{
      'Content-Type':'image/png','X-Demo-Access':process.env.DEMO_ACCESS_TOKEN,
      'X-Skin-Consent':'yes','X-Image-Filename':'consented-photo.png'
    },body:face});
    assert.equal(res.status,200);
    const submission=await res.json();
    assert.equal(submission.state,'running');
    assert.ok(submission.receipt.length>40);
    assert.equal(submission.taskId,undefined);
    assert.ok(!submission.receipt.includes(sampleTask));
    assert.ok(!JSON.stringify(submission).includes('mock-api-key'));

    async function poll(receipt){
      return globalThis.fetch(base+'/api/scan/status',{method:'POST',headers:{
        'Content-Type':'application/json','X-Demo-Access':process.env.DEMO_ACCESS_TOKEN
      },body:JSON.stringify({receipt})});
    }
    const first=await poll(submission.receipt);
    assert.equal(first.status,200);
    assert.equal((await first.json()).state,'running');
    const second=await poll(submission.receipt);
    assert.equal(second.status,200);
    const result=await second.json();
    assert.equal(result.state,'success');
    assert.deepEqual(result.signals.map(s=>[s.type,s.uiScore]),[['moisture',71],['redness',68],['skin_type',null]]);
    assert.equal(result.signals[2].regions.whole,'Combination');
    assert.equal(statusCalls,2);
    const tampered=submission.receipt+'invalid';
    const previousUpstream=upstream.length;
    const invalid=await poll(tampered);
    assert.equal(invalid.status,404);
    assert.equal(upstream.length,previousUpstream);
    assert.equal(upstream.filter(x=>x.method==='POST'&&x.url.endsWith('/task/skin-analysis')).length,1);
  }finally{
    if(server.listening)await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
    globalThis.fetch=originalFetch;
    for(const [k,value] of Object.entries(oldEnv)){if(value===undefined)delete process.env[k];else process.env[k]=value;}
  }
});
