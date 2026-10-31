import test from 'node:test';
import assert from 'node:assert/strict';
import {issueTaskReceipt,readTaskReceipt,TaskReceiptError,TASK_WINDOW_MS} from '../src/task-receipt.js';

const secret='hackathon-private-test-passcode-not-real';
const task='SaGaqpDgKwFrVBgMpQMA3HY0LeqdT9_13W5TOD8_u_GPi6NqQ3dhlmN-6ntFwhzT';
test('server can verify a signed scan receipt without an in-memory task map',()=>{
  const receipt=issueTaskReceipt(task,secret,100000);
  assert.equal(readTaskReceipt(receipt,secret,101000).taskId,task);
  assert.equal(readTaskReceipt(receipt,secret,101000).expiresAt,100000+TASK_WINDOW_MS);
  assert.ok(!receipt.includes(task));
  assert.ok(!receipt.includes(secret));
});
test('signed tasks survive process-style independent verification using the same secret',()=>{
  const issued=issueTaskReceipt(task,secret,2300000);
  const laterVerification=readTaskReceipt(issued,secret,2300000+3600000);
  assert.equal(laterVerification.taskId,task);
});
test('tampered receipts and incorrect demo secrets are rejected',()=>{
  const receipt=issueTaskReceipt(task,secret,100000);
  assert.throws(()=>readTaskReceipt(receipt.slice(0,-1)+(receipt.endsWith('a')?'b':'a'),secret,101000),TaskReceiptError);
  assert.throws(()=>readTaskReceipt(receipt,'different-secret-material',101000),TaskReceiptError);
  assert.throws(()=>readTaskReceipt(receipt+'abc',secret,101000),TaskReceiptError);
  assert.throws(()=>readTaskReceipt('garbage',secret,101000),TaskReceiptError);
});
test('receipts expire after 24 hours and reject future timestamps',()=>{
  const receipt=issueTaskReceipt(task,secret,100000);
  assert.equal(readTaskReceipt(receipt,secret,100000+TASK_WINDOW_MS).taskId,task);
  assert.throws(()=>readTaskReceipt(receipt,secret,100000+TASK_WINDOW_MS+1),TaskReceiptError);
  assert.throws(()=>readTaskReceipt(receipt,secret,0),TaskReceiptError);
});
test('malformed task IDs or weak missing secret cannot yield receipts',()=>{
  assert.throws(()=>issueTaskReceipt('../bad',secret,100000),TaskReceiptError);
  assert.throws(()=>issueTaskReceipt(task,'short',100000),TaskReceiptError);
  assert.throws(()=>issueTaskReceipt(task,secret,-1),TaskReceiptError);
});
