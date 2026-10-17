import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, GROUPS } from '../prototype/model.mjs';
import { muscleName } from '../prototype/muscles.mjs';
import { validateSnapshot } from '../prototype/persistence.mjs';

test('the seven requested muscle groups log independently and survive a backup round trip',()=>{
  assert.deepEqual(GROUPS.map(group=>group.id),['chest','back','triceps','biceps','shoulders','quads','hamstrings']);
  const store=createStore({seed:false}),date='2026-10-17';
  for(const [index,group] of GROUPS.entries())store.addGymEntry(date,group.id,index+1);
  store.setWeekTargets(date,GROUPS.map(group=>({id:group.id,target:9})));
  const restored=createStore({seed:false,snapshot:validateSnapshot(store.exportSnapshot())});
  assert.deepEqual(restored.loadTrainingDay(date).map(entry=>[entry.groupId,entry.sets]),GROUPS.map((group,index)=>[group.id,index+1]));
  assert.equal(restored.loadTrainingDay('2026-10-16').length,0);
  assert.equal(restored.loadWeek(date).groups.length,7);
});

test('old combined Legs logs and targets remain intact when the active targets change',()=>{
  const original=createStore({seed:false}),date='2026-10-17';
  original.addGymEntry(date,'legs',5);
  const snapshot=original.exportSnapshot();
  snapshot.targets=[['2026-10-12',[{id:'legs',name:'Legs',target:17},{id:'chest',name:'Chest',target:12}]]];
  const restored=createStore({seed:false,snapshot});
  restored.setWeekTargets(date,GROUPS.map(group=>({id:group.id,target:10})));
  const legacy=restored.loadWeek(date).groups.find(group=>group.id==='legs');
  assert.deepEqual(legacy,{id:'legs',name:'Legs',target:17,completed:5});
  assert.equal(muscleName('legs'),'Legs');
  assert.equal(restored.loadTrainingDay(date)[0].groupId,'legs');
  assert.deepEqual(validateSnapshot(restored.exportSnapshot()).entries,snapshot.entries);
});

test('new demo training contains valid set counts for every active muscle',()=>{
  const store=createStore();
  assert.doesNotThrow(()=>validateSnapshot(store.exportSnapshot()));
  assert.equal(new Set(store.loadWeek('2026-10-15').entries.map(entry=>entry.groupId)).size,7);
});
