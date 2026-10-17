import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../prototype/model.mjs';
import { STORAGE_KEY, readLocal, resetLocal } from '../prototype/persistence.mjs';

function memory(values={}) {
  const data=new Map(Object.entries(values));
  return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
}

test('hard reset clears the current space and preferences while preserving other spaces and apps',()=>{
  const store=createStore();store.updateDayComment('2026-10-17','A comment');
  const raw=JSON.stringify(store.exportSnapshot());
  const storage=memory({[STORAGE_KEY+'.preview']:raw,[STORAGE_KEY]:'personal records','homebase.preferences.v1.preview':'{"name":"Example","motion":"full"}','homebase.preferences.v1':'personal preferences','other-app':'keep'});
  const result=resetLocal(storage,{suffix:'.preview',expectedRaw:raw});
  assert.equal(result.snapshot.days.length,0);assert.equal(result.snapshot.entries.length,0);
  assert.equal(result.snapshot.targets.length,0);assert.equal(result.snapshot.templates.length,0);assert.equal(result.snapshot.serial,0);
  assert.equal(storage.getItem('homebase.preferences.v1.preview'),null);
  assert.equal(storage.getItem(STORAGE_KEY),'personal records');
  assert.equal(storage.getItem('homebase.preferences.v1'),'personal preferences');
  assert.equal(storage.getItem('other-app'),'keep');
  const reloaded=readLocal({getItem:key=>storage.getItem(key+'.preview')});
  const restarted=createStore({seed:true,snapshot:reloaded.snapshot});
  assert.equal(restarted.exportSnapshot().days.length,0);
  assert.equal(restarted.exportSnapshot().entries.length,0);
});

test('a stale tab cannot hard reset another tab’s newer records',()=>{
  const storage=memory({[STORAGE_KEY]:'new records','homebase.preferences.v1':'keep'});
  assert.throws(()=>resetLocal(storage,{expectedRaw:'old records'}),/Another tab/);
  assert.equal(storage.getItem(STORAGE_KEY),'new records');assert.equal(storage.getItem('homebase.preferences.v1'),'keep');
});

test('failed reset writes leave existing records and preferences intact',()=>{
  const storage=memory({[STORAGE_KEY]:'records','homebase.preferences.v1':'preferences'});
  storage.setItem=()=>{throw new Error('Storage unavailable');};
  assert.throws(()=>resetLocal(storage,{expectedRaw:'records'}),/Storage unavailable/);
  assert.equal(storage.getItem(STORAGE_KEY),'records');assert.equal(storage.getItem('homebase.preferences.v1'),'preferences');
});

test('explicit reset can recover corrupt data and rolls back when preferences cannot be cleared',()=>{
  const storage=memory({[STORAGE_KEY]:'corrupt','homebase.preferences.v1':'preferences'});
  const remove=storage.removeItem;storage.removeItem=()=>{throw new Error('Removal unavailable');};
  assert.throws(()=>resetLocal(storage,{expectedRaw:'corrupt'}),/Removal unavailable/);
  assert.equal(storage.getItem(STORAGE_KEY),'corrupt');assert.equal(storage.getItem('homebase.preferences.v1'),'preferences');
  storage.removeItem=remove;resetLocal(storage,{expectedRaw:'corrupt'});
  assert.equal(readLocal(storage).error,null);assert.equal(readLocal(storage).snapshot.days.length,0);
});
