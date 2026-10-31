import test from 'node:test';
import assert from 'node:assert/strict';
import {taskStatusResult} from '../src/scan-status.js';
const payload=(task_status,extra={})=>({status:200,data:{task_status,...extra}});
test('documents all actionable user-facing failure categories without raw provider text',()=>{
  const examples=[
    ['error_no_face','No face'],
    ['error_multiple_people','More than one'],
    ['error_insufficient_lighting','lighting'],
    ['error_face_angle_invalid','angle'],
    ['error_face_position_out_of_boundary','outside'],
    ['error_below_min_image_size','480 pixels'],
    ['error_decode_image','decode'],
    ['error_unsupport_ratio','aspect ratio'],
    ['error_upload','uploading the result']
  ];
  for(const [code,message] of examples){
    const result=taskStatusResult(payload('error',{failure_reason:code}));
    assert.equal(result.state,'error');assert.match(result.message,new RegExp(message,'i'));
    assert.ok(!result.message.includes('Unexpected vendor secret'));
  }
});
test('handles nested provider code while safely ignoring unknown or malicious error messages',()=>{
  const known=taskStatusResult(payload('error',{error:{code:'error_no_face'}}));
  assert.match(known.message,/No face/);
  const unknown=taskStatusResult(payload('error',{failure_reason:'AUTH TOKEN here: sk-confidential-token; call this link!'}));
  assert.equal(unknown.state,'error');
  assert.ok(!unknown.message.includes('sk-confidential-token'));
  assert.ok(!unknown.message.includes('AUTH TOKEN'));
  assert.equal(taskStatusResult(payload('failed',{error_code:'error_multiple_people'})).state,'error');
});
test('accepts documented processing statuses without inventing successful scans',()=>{
  for(const status of ['queued','running','processing','pending']){
    assert.deepEqual(taskStatusResult(payload(status)),{state:'running'});
  }
  assert.deepEqual(taskStatusResult(payload('success')),{state:'success'});
});
test('unexpected missing and unfamiliar statuses are NOT treated as endless processing',()=>{
  assert.throws(()=>taskStatusResult(payload('waiting-for-untrusted-action')),/unknown task status/);
  assert.throws(()=>taskStatusResult({status:200,data:{}}),/unknown task status/);
  assert.throws(()=>taskStatusResult(null),/unknown task status/);
});
