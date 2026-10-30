import assert from 'node:assert/strict'
import {createUserRefreshGate} from '../server/user-refresh-gate.js'
let now=1000,runs=0;const gate=createUserRefreshGate({ttlMs:100,maxEntries:3,now:()=>now})
await Promise.all(Array.from({length:8},()=>gate.run('one',async()=>{runs++})))
assert.equal(runs,1,'concurrent canonical synchronizations share one job')
await gate.run('one',()=>runs++);assert.equal(runs,1)
await gate.run('two',()=>runs++);assert.equal(runs,2,'accounts do not share synchronization state')
gate.invalidate('one');await gate.run('one',()=>runs++);assert.equal(runs,3,'writes invalidate immediately')
now+=101;await gate.run('one',()=>runs++);assert.equal(runs,4,'time limit refreshes outside this process mutations')
gate.invalidate('one');await assert.rejects(gate.run('one',()=>{throw Error('db')}));await gate.run('one',()=>runs++);assert.equal(runs,5,'failures are retried')
gate.invalidate('one');let release;const wait=new Promise(resolve=>{release=resolve});const inFlight=gate.run('one',()=>wait);gate.invalidate('one');release();await inFlight;await gate.run('one',()=>runs++);assert.equal(runs,6,'mutation during synchronization is not cached as fresh')
for(let i=0;i<20;i++)await gate.run('user'+i,()=>{})
assert.ok(gate.size<=3,'bounded user metadata')
console.log('PASS canonical synchronization coalescing, user scope, invalidation, concurrent writes, expiry, retry and bounded memory')
