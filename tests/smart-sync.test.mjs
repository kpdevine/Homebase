import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../prototype/model.mjs';
import {snapshotRecords,reconcileRecords,EMPTY_SNAPSHOT} from '../prototype/cloud-records.mjs';
import {createRecordEdits,packCloudPayload,unpackCloudPayload,matchesCloudVersion} from '../prototype/record-edits.mjs';
import {createCloudEngine} from '../prototype/cloud-engine.mjs';
const date='2026-10-18',id=`day_${date}`,now=Date.now();
function snapshot(rating){const store=createStore({seed:false});store.updateRating(date,rating);return store.exportSnapshot();}
const records=rating=>snapshotRecords(snapshot(rating));

test('only changed saved records get edit times; unchanged and legacy records are not stamped on startup',()=>{
  let saved;const before=records(7),ledger=createRecordEdits({records:before,save:value=>{saved=structuredClone(value);},now:()=>now});
  assert.equal(ledger.times(before).size,0);
  ledger.capture(records(8),now-1000);
  assert.deepEqual([...ledger.times(records(8))],[[id,now-1000]]);
  const restored=createRecordEdits({records:records(8),load:()=>saved,now:()=>now});
  assert.equal(restored.times(records(8)).get(id),now-1000);
  assert.equal(restored.times(records(9)).has(id),false);
  restored.capture(records(8),now);assert.equal(restored.times(records(8)).get(id),now-1000);
});
test('remote adoption preserves the original edit time without pretending receipt is a new local edit',()=>{
  let saved;const ledger=createRecordEdits({records:records(7),save:value=>{saved=value;},now:()=>now});
  ledger.adopt(records(9),new Map([[id,now-10000]]));ledger.capture(records(9),now);
  assert.equal(ledger.times(records(9)).get(id),now-10000);
  assert.equal(saved[id].at,now-10000);
});
test('corrupt, future-dated and unavailable metadata remain safe and do not prevent local editing',()=>{
  const ledger=createRecordEdits({records:records(7),load:()=>{throw Error('bad json');},save:()=>{throw Error('quota');},now:()=>now});
  ledger.capture(records(8),now+100000);assert.equal(ledger.times(records(8)).size,0);
  ledger.capture(records(8),now);assert.equal(ledger.times(records(8)).get(id),now);
});
test('cloud payload edit metadata round-trips without changing records or legacy payloads',()=>{
  const payload=records(7).get(id),packed=packCloudPayload(payload,now);
  assert.deepEqual(unpackCloudPayload(packed),{payload,editedAt:now});
  assert.deepEqual(unpackCloudPayload(payload),{payload,editedAt:null});
  assert.equal(unpackCloudPayload(packCloudPayload(payload,now+100000)).editedAt,null);
});
test('transactions reject an unseen newer saved version even when its payload matches the old baseline',()=>{
  const before=records(7).get(id),change={before,after:records(8).get(id),beforeEditedAt:now-1000};
  assert.equal(matchesCloudVersion({payload:before,editedAt:now-1000},change),true);
  assert.equal(matchesCloudVersion({payload:before,editedAt:now},change),false);
  assert.equal(matchesCloudVersion({payload:records(9).get(id),editedAt:now-1000},change),false);
  assert.equal(matchesCloudVersion(null,{before:null,beforeEditedAt:null}),true);
});
test('newer local and newer cloud records win automatically, independently per record',()=>{
  const base=records(7),local=records(8),remote=records(9);
  for(const [mine,theirs,winner] of [[now,now-1000,local],[now-1000,now,remote]]){
    const result=reconcileRecords(base,local,remote,'newest',{local:new Map([[id,mine]]),remote:new Map([[id,theirs]])});
    assert.deepEqual(result.conflicts,[]);assert.equal(result.merged.get(id),winner.get(id));
  }
});
test('mixed newer local and cloud days merge without choosing one whole workspace',()=>{
  const make=rating=>{const store=createStore({seed:false});store.updateRating(date,rating);store.updateRating('2026-10-17',rating);return snapshotRecords(store.exportSnapshot());};
  const other='day_2026-10-17',base=make(7),local=make(8),remote=make(9);
  const result=reconcileRecords(base,local,remote,'newest',{local:new Map([[id,now],[other,now-1000]]),remote:new Map([[id,now-1000],[other,now]])});
  assert.deepEqual(result.conflicts,[]);assert.equal(result.merged.get(id),local.get(id));assert.equal(result.merged.get(other),remote.get(other));
});
test('unknown, equal or suspicious times and delete-versus-edit conflicts still require a choice',()=>{
  for(const [mine,theirs] of [[null,now],[now,null],[now,now],[now+100000,now]]){
    const result=reconcileRecords(records(7),records(8),records(9),'newest',{local:new Map([[id,mine]]),remote:new Map([[id,theirs]])});
    assert.deepEqual(result.conflicts,[id]);
  }
  const deleted=reconcileRecords(records(7),snapshotRecords(EMPTY_SNAPSHOT),records(9),'newest',{local:new Map([[id,now]]),remote:new Map([[id,now-1000]])});
  assert.deepEqual(deleted.conflicts,[id]);
});
function engineHarness(localAt,remoteAt){
  let local=snapshot(8),receive,state,committed=[];
  const localLedger=createRecordEdits({records:records(7)});localLedger.capture(records(8),localAt);
  const engine=createCloudEngine({readLocal:()=>local,applyLocal:value=>{local=value;},localEditTimes:value=>localLedger.times(value),adoptEditTimes:(value,times)=>localLedger.adopt(value,times),loadBase:()=>[...records(7)],onState:value=>{state=value;},delay:1000000,
    transport:{subscribe:callback=>{receive=callback;return()=>{};},commit:async changes=>{committed=changes;const remote=records(9),times=new Map([[id,remoteAt]]);for(const change of changes){assert.equal(change.before,remote.get(change.id)??null);remote.set(change.id,change.after);times.set(change.id,change.editedAt);}receive(remote,times);}}});
  engine.enable();receive(records(9),new Map([[id,remoteAt]]));
  return {engine,get state(){return state;},get local(){return local;},get committed(){return committed;},ledger:localLedger};
}
test('engine uploads the newer local save over the older cloud value and confirms it without a conflict prompt',async()=>{
  const h=engineHarness(now,now-1000);assert.equal(h.state.status,'pending');await h.engine.flush();
  assert.equal(h.committed.length,1);assert.equal(h.committed[0].editedAt,now);assert.equal(h.local.days[0].nutrition,8);assert.equal(h.state.status,'synced');h.engine.close();
});
test('engine adopts a newer cloud record and its edit time without uploading stale local content',async()=>{
  const h=engineHarness(now-1000,now);await h.engine.flush();
  assert.equal(h.local.days[0].nutrition,9);assert.equal(h.committed.length,0);assert.equal(h.state.status,'synced');assert.equal(h.ledger.times(records(9)).get(id),now);h.engine.close();
});
test('an explicit local conflict resolution is a fresh decision, rather than replaying the old edit time',async()=>{
  const h=engineHarness(now,now);assert.equal(h.state.status,'conflict');h.engine.resolve('local');await h.engine.flush();
  assert.ok(h.committed[0].editedAt>=now);assert.equal(h.local.days[0].nutrition,8);assert.equal(h.state.status,'synced');h.engine.close();
});
