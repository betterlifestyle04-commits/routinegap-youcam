import test from 'node:test';
import assert from 'node:assert/strict';
import {guestSource,makeGuestQuota,PUBLIC_GUEST_MAX_PER_DAY,PUBLIC_GUEST_MAX_PER_SOURCE_PER_DAY} from '../src/guest-quota.js';

test('public judge budget is deliberately tiny and distinct from the private owner quota',()=>{
 assert.equal(PUBLIC_GUEST_MAX_PER_DAY,3);
 assert.equal(PUBLIC_GUEST_MAX_PER_SOURCE_PER_DAY,1);
 const q=makeGuestQuota();
 assert.equal(q.inspect().remaining,3);
 assert.ok(Object.isFrozen(q));
});
test('first three different sources can start one trial each, a fourth is blocked',()=>{
 const q=makeGuestQuota({now:()=>Date.UTC(2026,10,1)});
 for(const source of ['198.51.100.1','198.51.100.2','198.51.100.3']){
  assert.equal(q.consume(source).allowed,true);
 }
 assert.equal(q.inspect().remaining,0);
 assert.deepEqual(q.consume('198.51.100.4'),{allowed:false,reason:'global',remaining:0});
});
test('second attempt per source is blocked even while global slots exist',()=>{
 const q=makeGuestQuota({now:()=>Date.UTC(2026,10,1)});
 assert.equal(q.consume('198.51.100.10').allowed,true);
 assert.deepEqual(q.consume('198.51.100.10'),{allowed:false,reason:'source',remaining:2});
 assert.equal(q.inspect().remaining,2);
});
test('bad source identifiers never consume the available global attempts',()=>{
 const q=makeGuestQuota();
 for(const v of ['',null,undefined,42,'x'.repeat(101)])assert.equal(q.consume(v).allowed,false);
 assert.equal(q.inspect().remaining,3);
});
test('UTC calendar rollover resets process-scoped guest allowances',()=>{
 let time=Date.UTC(2026,10,1,23,59,59);
 const q=makeGuestQuota({now:()=>time});
 q.consume('203.0.113.1');q.consume('203.0.113.2');
 assert.equal(q.inspect().remaining,1);
 time=Date.UTC(2026,10,2,0,0,0);
 assert.equal(q.inspect().remaining,3);
 assert.equal(q.consume('203.0.113.1').allowed,true);
});
test('independent quota instances do not share data, documented process-restart limitation',()=>{
 const a=makeGuestQuota(),b=makeGuestQuota();
 a.consume('192.0.2.1');
 assert.equal(a.inspect().remaining,2);
 assert.equal(b.inspect().remaining,3);
});
test('proxy forwarded address falls back to socket address and rejects invalid values',()=>{
 assert.equal(guestSource({headers:{'x-forwarded-for':'198.51.100.4, 10.0.0.5'},socket:{remoteAddress:'127.0.0.1'}}),'198.51.100.4');
 assert.equal(guestSource({headers:{'x-forwarded-for':'evil-ip'},socket:{remoteAddress:'127.0.0.1'}}),'127.0.0.1');
 assert.equal(guestSource({headers:{},socket:{remoteAddress:'::1'}}),'::1');
});
test('invalid caps are rejected rather than opening unlimited public scans',()=>{
 for(const dailyMax of [0,-1,1.5,Infinity])assert.throws(()=>makeGuestQuota({dailyMax}),TypeError);
 for(const perSourceMax of [0,-1,NaN])assert.throws(()=>makeGuestQuota({perSourceMax}),TypeError);
});
