import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays,GROUPS} from '../prototype/model.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {snapshotRecords,recordsSnapshot} from '../prototype/cloud-records.mjs';

const monday='2026-10-19';
const targets=values=>GROUPS.map(group=>({id:group.id,target:values[group.id]||0}));
function setup(){const store=createStore({seed:false});store.setWeekTargets(monday,targets({chest:20,back:10,core:20}));return store;}

test('starting a workout freezes its plan before sets and keeps it through logging, removal, and target edits',()=>{
  const store=setup(),plan=store.idealWorkout(monday);
  assert.equal(plan.sets,10);assert.equal(store.loadDay(monday).workoutPlan,undefined);
  store.setTrainingMode(monday,'training');
  const saved=store.loadDay(monday).workoutPlan;
  for(const group of plan.groups)store.addGymEntry(monday,group.id,group.sets);
  assert.equal(store.trainingProgress(monday).gymScore,10);
  assert.deepEqual(store.idealWorkout(monday),plan);
  for(const entry of store.loadTrainingDay(monday))store.removeGymEntry(entry.id);
  store.setTrainingMode(monday,'rest');store.setTrainingMode(monday,'training');
  store.setWeekTargets(monday,targets({chest:5}));
  assert.deepEqual(store.idealWorkout(monday),plan);
  assert.deepEqual(store.loadDay(monday).workoutPlan,saved);
});

test('logging the first sets directly freezes the pre-workout plan; following days use remaining weekly goals',()=>{
  const store=setup(),plan=store.idealWorkout(monday);
  store.addGymEntry(monday,'chest',20);
  assert.deepEqual(store.idealWorkout(monday),plan);
  const tuesday=addDays(monday,1),next=store.idealWorkout(tuesday);
  assert.equal(next.sets,10);assert.ok(next.groups.every(group=>group.id!=='chest'));
  store.setTrainingMode(tuesday,'training');
  store.addGymEntry(monday,'back',10);
  assert.deepEqual(store.idealWorkout(tuesday),next);
  assert.deepEqual(store.idealWorkout(monday),plan);
});

test('frozen plans survive backup and cloud round trips without modifying legacy records on read',()=>{
  const store=setup(),plan=store.idealWorkout(monday);
  store.addGymEntry(monday,'chest',10);
  for(const snapshot of [validateSnapshot(store.exportSnapshot()),recordsSnapshot(snapshotRecords(store.exportSnapshot()))]) {
    assert.deepEqual(createStore({seed:false,snapshot}).idealWorkout(monday),plan);
  }
  const old=store.exportSnapshot();delete old.days[0].workoutPlan;
  const restored=createStore({seed:false,snapshot:old}),before=restored.exportSnapshot();
  assert.deepEqual(restored.idealWorkout(monday),plan);
  assert.deepEqual(restored.exportSnapshot(),before);
  restored.addGymEntry(monday,'back',2);
  assert.deepEqual(restored.idealWorkout(monday),plan);
});

test('invalid saved workout plans cannot enter backups or cloud records',()=>{
  const store=setup();store.setTrainingMode(monday,'training');
  for(const plan of [null,{sets:-1,groups:[],targetMet:false,goalsMet:false},
    {sets:1,groups:[{id:'unknown',sets:1}],targetMet:false,goalsMet:false},
    {sets:2,groups:[{id:'chest',sets:1},{id:'chest',sets:1}],targetMet:false,goalsMet:false},
    {sets:10,groups:[{id:'chest',sets:5}],targetMet:false,goalsMet:false}]) {
    const snapshot=store.exportSnapshot();snapshot.days[0].workoutPlan=plan;
    assert.throws(()=>validateSnapshot(snapshot),/workout plan/);
  }
});
