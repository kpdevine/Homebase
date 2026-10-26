import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays} from '../prototype/model.mjs';
import {newUserSettings} from '../prototype/customization.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {recordsSnapshot,snapshotRecords} from '../prototype/cloud-records.mjs';
import {dailyRecap} from '../prototype/recap.mjs';
import {summarizeDay} from '../prototype/scoring.mjs';
const monday='2026-10-19';
function setup({creatine=true,target=10,mode='gym'}={}){
  const settings=newUserSettings();settings.tabs.checklists=false;settings.tabs.training=true;
  Object.assign(settings.training,{creatine,flexDays:1,mode,groups:[{id:'chest',name:'Chest',target}]});
  return createStore({seed:false,today:monday,settings});
}
test('alternate workout earns exactly 5 plus the tracked creatine point, even with zero goals',()=>{
  for(const options of [{},{creatine:false},{target:0},{mode:'other'}]){
    const store=setup(options);store.setTrainingMode(monday,'rest');store.setAlternateWorkout(monday,'  30-minute bike ride  ');
    assert.equal(store.trainingProgress(monday).score,5);assert.equal(store.trainingProgress(monday).restCredits,1);
    store.setCreatine(monday,true);assert.equal(store.trainingProgress(monday).score,options.creatine===false?5:6);
    assert.equal(store.trainingProgress(monday).rest,false);assert.equal(store.trainingProgress(monday).restCreditUsed,false);
    assert.equal(store.dayProgress(monday).sections[0].ready,true);
    assert.equal(summarizeDay(store.loadDay(monday),[],store.loadWeek(monday)).sections[0].excluded,false);
    store.confirmSection(monday,'training');store.completeDay(monday);
    const recap=dailyRecap(store.loadDay(monday),[],store.loadWeek(monday));
    assert.equal(recap.training.alternateWorkout,'30-minute bike ride');assert.equal(recap.training.rest,false);
  }
});
test('replacing rest with an alternate workout returns its credit and reopens affected later reviews',()=>{
  const store=setup(),next=addDays(monday,1);
  for(const date of [monday,next]){store.setTrainingMode(date,'rest');store.confirmSection(date,'training');store.completeDay(date);}
  assert.equal(store.trainingProgress(next).score,0);
  store.setAlternateWorkout(monday,'Swimming');
  assert.equal(store.trainingProgress(next).score,9);assert.equal(store.loadDay(next).completedAt,null);
  assert.equal(store.loadDay(monday).completedAt,null);
  store.confirmSection(monday,'training');store.completeDay(monday);store.setAlternateWorkout(monday,'Long walk');
  assert.equal(store.loadDay(monday).completedAt,null,'description-only edits reopen the review');
  store.setTrainingMode(monday,'rest');assert.equal(store.trainingProgress(next).score,0);
  assert.equal(dailyRecap(store.loadDay(monday),[],store.loadWeek(monday)).training.alternateWorkout,null);
});
test('alternate workout and paused lifting entries survive cloud/backup restore and lifting restores IDs',()=>{
  const store=setup(),id=store.addGymEntry(monday,'chest',3);store.setTrainingMode(monday,'rest');
  store.setAlternateWorkout(monday,'<Bike ride> & stretching');
  assert.equal(store.loadTrainingDay(monday).length,0);assert.equal(store.loadWeek(monday).groups[0].completed,0);
  store.confirmSection(monday,'training');store.completeDay(monday);
  const restored=createStore({seed:false,snapshot:recordsSnapshot(snapshotRecords(validateSnapshot(store.exportSnapshot())))});
  assert.equal(restored.loadDay(monday).alternateWorkout,'<Bike ride> & stretching');assert.equal(restored.trainingProgress(monday).score,5);
  restored.setTrainingMode(monday,'training');assert.equal(restored.loadTrainingDay(monday)[0].id,id);
  assert.equal(restored.loadDay(monday).completedAt,null);assert.equal(restored.trainingProgress(monday).alternate,false);
  const privateText=[...snapshotRecords(store.exportSnapshot()).values()].some(value=>value.includes('Bike ride'));
  assert.equal(privateText,true);
});
test('invalid and archived alternate logs are rejected without changing existing records',()=>{
  const store=setup();store.setTrainingMode(monday,'rest');const before=store.exportSnapshot();
  for(const text of ['', '  ',null,5,'x'.repeat(1001)]){assert.throws(()=>store.setAlternateWorkout(monday,text));assert.deepEqual(store.exportSnapshot(),before);}
  store.setAlternateWorkout(monday,'x'.repeat(1000));assert.doesNotThrow(()=>validateSnapshot(store.exportSnapshot()));
  for(const text of ['', ' ',5,'x'.repeat(1001)]){const bad=store.exportSnapshot();bad.days[0].alternateWorkout=text;assert.throws(()=>validateSnapshot(bad),/alternate workout/);}
  const archived=createStore({seed:false,snapshot:store.exportSnapshot(),editableToday:()=>addDays(monday,8)});
  assert.throws(()=>archived.setAlternateWorkout(monday,'Walk'),/summary only/);assert.equal(archived.loadDay(monday).alternateWorkout.length,1000);
});
