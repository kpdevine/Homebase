import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,GROUPS,addDays} from '../prototype/model.mjs';
import {summarizeDay,taskScoreRange} from '../prototype/scoring.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {snapshotRecords,recordsSnapshot} from '../prototype/cloud-records.mjs';
const monday='2026-10-19';
function fresh(){const store=createStore({seed:false});store.setWeekTargets(monday,GROUPS.map(group=>({id:group.id,target:group.id==='chest'?20:group.id==='back'?20:group.id==='core'?10:0})));return store;}
test('creatine is exactly one point on workout days; gym effort supplies the other nine',()=>{
 for(const [sets,gymScore] of [[0,4],[5,7],[10,10],[20,10]]){
  const store=fresh();store.setTrainingMode(monday,'training');if(sets)store.addGymEntry(monday,'chest',sets);
  assert.equal(store.trainingProgress(monday).gymScore,gymScore);
  const missed=store.trainingProgress(monday).score;assert.equal(missed,Math.round(gymScore*.9*10)/10);
  store.setCreatine(monday,true);assert.equal(store.trainingProgress(monday).score,Math.round((gymScore*.9+1)*10)/10);
  store.setCreatine(monday,false);assert.equal(store.trainingProgress(monday).score,missed);
 }
});
test('creatine contributes on covered, uncovered and goal-complete rest without spending credits',()=>{
 const store=fresh();
 for(let i=0;i<3;i++){
  const date=addDays(monday,i);store.setTrainingMode(date,'rest');const before=store.trainingProgress(date);
  assert.equal(before.score,i<2?9:0);store.setCreatine(date,true);
  assert.equal(store.trainingProgress(date).score,i<2?10:1);assert.equal(store.trainingProgress(date).restCredits,before.restCredits);
 }
 for(const group of store.loadWeek(monday).groups.filter(group=>group.target))store.addGymEntry(addDays(monday,3),group.id,group.target);
 const rest=addDays(monday,4);store.setTrainingMode(rest,'rest');assert.equal(store.trainingProgress(rest).score,9);store.setCreatine(rest,true);assert.equal(store.trainingProgress(rest).score,10);
});
test('creatine alone does not invent attendance, and missing a dose does not block honest review',()=>{
 const store=fresh();store.setCreatine(monday,true);assert.equal(store.trainingProgress(monday).score,null);assert.equal(store.dayProgress(monday).sections[1].ready,false);
 store.setCreatine(monday,false);store.setTrainingMode(monday,'rest');store.confirmSection(monday,'training');assert.equal(store.loadDay(monday).reviewed.training,true);
 store.setCreatine(monday,true);assert.equal(store.loadDay(monday).reviewed.training,false);
 assert.throws(()=>store.setCreatine(monday,'true'));assert.throws(()=>store.setCreatine(monday,null));
});
test('creatine survives local and cloud round trips; invalid values are rejected',()=>{
 const store=fresh();store.setTrainingMode(monday,'rest');store.setCreatine(monday,true);
 for(const snapshot of [validateSnapshot(store.exportSnapshot()),recordsSnapshot(snapshotRecords(store.exportSnapshot()))]){
  const restored=createStore({seed:false,snapshot});assert.equal(restored.loadDay(monday).creatine,true);assert.equal(restored.trainingProgress(monday).score,10);
 }
 const bad=store.exportSnapshot();bad.days[0].creatine=1;assert.throws(()=>validateSnapshot(bad),/creatine/);
});
test('legacy records retain their score and serialized shape until training is explicitly edited',()=>{
 const source=fresh();source.setTrainingMode(monday,'rest');const snapshot=source.exportSnapshot();delete snapshot.days[0].creatine;
 const store=createStore({seed:false,snapshot}),before=store.exportSnapshot();assert.equal(store.trainingProgress(monday).score,10);assert.deepEqual(store.exportSnapshot(),before);
 store.updateNotes(monday,'nutrition','No training edit');assert.equal(store.trainingProgress(monday).score,10);
 store.confirmSection(monday,'training');store.setTrainingMode(monday,'rest');assert.equal(store.trainingProgress(monday).score,9);assert.equal(store.loadDay(monday).reviewed.training,false);
});
test('zero muscle goals leave only the single creatine point available',()=>{
 const store=fresh();store.setWeekTargets(monday,GROUPS.map(group=>({id:group.id,target:0})));store.setTrainingMode(monday,'rest');assert.equal(store.trainingProgress(monday).score,0);store.setCreatine(monday,true);assert.equal(store.trainingProgress(monday).score,1);assert.equal(store.trainingProgress(monday).restCredits,2);
});
test('projection begins before any logging and never invents nutrition or gym ratings',()=>{
 const store=fresh();store.addTask(monday,'One task');const summarize=()=>summarizeDay(store.loadDay(monday),[],store.loadWeek(monday));
 assert.equal(summarize().score,0);assert.deepEqual(taskScoreRange(summarize()),{score:10,low:0,projected:true});
 store.updateRating(monday,8);assert.deepEqual(taskScoreRange(summarize()),{score:9,low:4,projected:true});assert.equal(summarize().score,4);
 store.setTrainingMode(monday,'rest');assert.deepEqual(taskScoreRange(summarize()),{score:9,low:5.7,projected:true});
});
