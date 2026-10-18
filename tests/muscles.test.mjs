import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, GROUPS } from '../prototype/model.mjs';
import { muscleName } from '../prototype/muscles.mjs';
import { validateSnapshot } from '../prototype/persistence.mjs';

test('the eight requested muscle groups log independently and survive a backup round trip',()=>{
  assert.deepEqual(GROUPS.map(group=>group.id),['chest','back','triceps','biceps','shoulders','quads','hamstrings','core']);
  const store=createStore({seed:false}),date='2026-10-17';
  for(const [index,group] of GROUPS.entries())store.addGymEntry(date,group.id,index+1);
  store.setWeekTargets(date,GROUPS.map(group=>({id:group.id,target:9})));
  const restored=createStore({seed:false,snapshot:validateSnapshot(store.exportSnapshot())});
  assert.deepEqual(restored.loadTrainingDay(date).map(entry=>[entry.groupId,entry.sets]),GROUPS.map((group,index)=>[group.id,index+1]));
  assert.equal(restored.loadTrainingDay('2026-10-16').length,0);
  assert.equal(restored.loadWeek(date).groups.length,8);
});

test('old combined Legs logs and targets remain intact when the active targets change',()=>{
  const original=createStore({seed:false}),date='2026-10-17';
  original.addGymEntry(date,'legs',5);
  const snapshot=original.exportSnapshot();
  snapshot.targets=[['2026-10-12',[{id:'legs',name:'Legs',target:17},{id:'chest',name:'Chest',target:12}]]];
  const restored=createStore({seed:false,snapshot});
  restored.setWeekTargets(date,GROUPS.map(group=>({id:group.id,target:10})));
  assert.equal(restored.loadWeek(date).groups.some(group=>group.id==='legs'),false);
  assert.equal(restored.trainingProgress(date).nonUseful,5);
  assert.equal(muscleName('legs'),'Legs');
  assert.equal(restored.loadTrainingDay(date)[0].groupId,'legs');
  assert.deepEqual(validateSnapshot(restored.exportSnapshot()).entries,snapshot.entries);
});

test('new demo training contains valid set counts for every active muscle',()=>{
  const store=createStore();
  assert.doesNotThrow(()=>validateSnapshot(store.exportSnapshot()));
  assert.equal(new Set(store.loadWeek('2026-10-15').entries.map(entry=>entry.groupId)).size,8);
});

test('saved older targets gain Core at zero and retire Legs without mutating stored history',()=>{
 const store=createStore({seed:false});const snapshot=store.exportSnapshot();snapshot.targets=[['2026-10-12',[{id:'legs',name:'Legs',target:16},{id:'chest',name:'Chest',target:12}]]];
 const restored=createStore({seed:false,snapshot}),before=restored.exportSnapshot();
 const week=restored.loadWeek('2026-10-17');assert.equal(week.groups.find(group=>group.id==='core').target,0);assert.equal(week.groups.some(group=>group.id==='legs'),false);
 assert.equal(restored.trainingProgress('2026-10-17').target,12);assert.deepEqual(restored.exportSnapshot(),before);
});
