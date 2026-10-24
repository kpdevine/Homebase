import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays} from '../prototype/model.mjs';
import {newUserSettings,normalizeSettings,orderedModules,DEFAULT_MODULE_ORDER} from '../prototype/customization.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {recordsSnapshot,snapshotRecords} from '../prototype/cloud-records.mjs';
const monday='2026-10-19';
function setup(){const settings=newUserSettings();settings.tabs.checklists=false;settings.tabs.training=true;settings.training.creatine=false;settings.training.flexDays=0;settings.training.groups=[{id:'chest',name:'Chest',target:10}];return createStore({seed:false,today:monday,settings});}

test('editing set counts preserves entry identity and replays later rest scores and reviews',()=>{
  const store=setup(),id=store.addGymEntry(monday,'chest',10),next=addDays(monday,1);
  store.confirmSection(monday,'training');store.completeDay(monday);store.setTrainingMode(next,'rest');store.confirmSection(next,'training');store.completeDay(next);
  assert.equal(store.trainingProgress(next).score,10);const plan=store.idealWorkout(monday);
  store.updateGymEntry(id,4);
  assert.deepEqual(store.loadTrainingDay(monday),[{id,date:monday,groupId:'chest',sets:4}]);
  assert.equal(store.trainingProgress(next).score,0);
  for(const date of [monday,next]){assert.equal(store.loadDay(date).reviewed.training,false);assert.equal(store.loadDay(date).completedAt,null);}
  assert.deepEqual(store.idealWorkout(monday),plan);
  for(const sets of [0,101,1.5,NaN])assert.throws(()=>store.updateGymEntry(id,sets));
  assert.throws(()=>store.updateGymEntry('missing',3));assert.equal(store.loadTrainingDay(monday)[0].sets,4);
  const restored=createStore({seed:false,snapshot:recordsSnapshot(snapshotRecords(validateSnapshot(store.exportSnapshot())))});assert.equal(restored.loadTrainingDay(monday)[0].sets,4);
  const archived=createStore({seed:false,snapshot:store.exportSnapshot(),editableToday:()=>addDays(monday,8)});assert.throws(()=>archived.updateGymEntry(id,7),/summary only/);assert.equal(archived.loadTrainingDay(monday)[0].sets,4);
});

test('module order round trips, defaults for legacy settings, and does not reopen reviewed days',()=>{
  const store=setup();store.setTrainingMode(monday,'rest');store.confirmSection(monday,'training');store.completeDay(monday);const completed=store.loadDay(monday).completedAt;
  const settings=store.getSettings();settings.moduleOrder=['training','sleep','checklists','prayer','nutrition','sentiments'];store.setSettings(settings,monday);
  assert.equal(store.loadDay(monday).completedAt,completed);assert.equal(store.loadDay(monday).reviewed.training,true);
  assert.deepEqual(orderedModules(store.getSettings()).map(section=>section.id),settings.moduleOrder);
  const restored=createStore({seed:false,snapshot:recordsSnapshot(snapshotRecords(validateSnapshot(store.exportSnapshot())))});assert.deepEqual(restored.getSettings().moduleOrder,settings.moduleOrder);
  const legacy={...settings};delete legacy.moduleOrder;assert.deepEqual(normalizeSettings(legacy).moduleOrder,DEFAULT_MODULE_ORDER);
  for(const moduleOrder of [[],['training'],Array(6).fill('training'),[...DEFAULT_MODULE_ORDER.slice(0,-1),'unknown']])assert.throws(()=>normalizeSettings({...settings,moduleOrder}));
});

test('unchecked creatine records no dose without fabricating lifting attendance',()=>{
  const settings=newUserSettings();settings.tabs.training=true;const store=createStore({seed:false,today:monday,settings});
  assert.equal(store.loadDay(monday).creatine,false);assert.equal(store.trainingProgress(monday).score,null);
  store.setTrainingMode(monday,'rest');assert.equal(store.trainingProgress(monday).score,9);assert.equal(store.dayProgress(monday).sections.find(section=>section.id==='training').ready,true);
  store.setCreatine(monday,true);assert.equal(store.trainingProgress(monday).score,10);store.setCreatine(monday,false);assert.equal(store.trainingProgress(monday).score,9);
});

test('switching a logged lift to No pauses sets across cloud restore, and Yes restores their IDs',()=>{
  const store=setup(),id=store.addGymEntry(monday,'chest',10);store.confirmSection(monday,'training');store.completeDay(monday);
  store.setTrainingMode(monday,'rest');assert.equal(store.loadDay(monday).trainingMode,'rest');assert.equal(store.loadTrainingDay(monday).length,0);assert.equal(store.loadWeek(monday).entries.length,0);assert.equal(store.loadWeek(monday).groups[0].completed,0);assert.equal(store.trainingProgress(monday).score,0);
  assert.deepEqual(store.loadDay(monday).draftTrainingEntries,[{id,date:monday,groupId:'chest',sets:10}]);
  store.confirmSection(monday,'training');store.completeDay(monday);
  const restored=createStore({seed:false,snapshot:recordsSnapshot(snapshotRecords(store.exportSnapshot()))});assert.equal(restored.loadTrainingDay(monday).length,0);
  restored.setTrainingMode(monday,'training');assert.deepEqual(restored.loadTrainingDay(monday),[{id,date:monday,groupId:'chest',sets:10}]);assert.equal(restored.loadDay(monday).draftTrainingEntries,undefined);assert.equal(restored.loadDay(monday).completedAt,null);assert.equal(restored.trainingProgress(monday).score,10);
  restored.setTrainingMode(monday,'rest');const second=restored.addGymEntry(monday,'chest',2);assert.notEqual(second,id);assert.equal(restored.loadTrainingDay(monday).length,2);
  const bad=store.exportSnapshot();bad.days[0].draftTrainingEntries[0].date=addDays(monday,1);assert.throws(()=>validateSnapshot(bad),/paused set entry/);
});
