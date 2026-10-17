import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,GROUPS,addDays} from '../prototype/model.mjs';
import {summarizeDay,loggingStreak,averageDays} from '../prototype/scoring.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {dailyRecap} from '../prototype/recap.mjs';
const monday='2026-10-12',tuesday=addDays(monday,1);
function fresh(){const store=createStore({seed:false});store.setWeekTargets(monday,GROUPS.map(group=>({id:group.id,target:10})));return store;}
const summary=(store,date)=>summarizeDay(store.loadDay(date),store.loadTrainingDay(date),store.loadWeek(date));

test('strict weekly pace scores 10 Monday sets perfectly, then requires 20 by Tuesday',()=>{
  const store=fresh();store.addGymEntry(monday,'chest',10);
  assert.equal(store.trainingProgress(monday).score,10);
  store.setTrainingMode(tuesday,'unplanned-rest');
  assert.equal(store.trainingProgress(tuesday).score,5);
  store.addGymEntry(monday,'back',4);
  assert.equal(store.trainingProgress(tuesday).score,7);
  store.addGymEntry(monday,'back',6);
  assert.equal(store.trainingProgress(tuesday).score,10);
  assert.equal(summary(store,tuesday).sections[1].score,10);
});
test('extra sets stay logged but cannot replace unfinished muscle goals',()=>{
  const store=fresh();store.addGymEntry(monday,'chest',25);store.setTrainingMode(tuesday,'unplanned-rest');
  const progress=store.trainingProgress(tuesday);
  assert.equal(progress.actual,25);assert.equal(progress.credited,10);assert.equal(progress.score,5);
  assert.equal(store.loadWeek(tuesday).groups.find(group=>group.id==='chest').completed,25);
  assert.ok(!progress.suggestions.some(group=>group.id==='chest'));
  store.addGymEntry(monday,'legs',10);assert.equal(store.trainingProgress(tuesday).credited,10);
});
test('planned rest is excluded rather than boosting the daily average and still counts as a check-in',()=>{
  const store=fresh();store.updateRating(monday,6);store.addTask(monday,'Task');store.setTrainingMode(monday,'rest');
  for(const section of ['nutrition','training','checklists'])store.confirmSection(monday,section);
  const value=summary(store,monday);
  assert.equal(value.score,3);assert.equal(value.sections[1].score,null);assert.equal(value.sections[1].excluded,true);
  assert.equal(value.requiredLogged,3);assert.equal(value.provisional,false);
  assert.equal(loggingStreak(monday,date=>summary(store,date)).count,1);
  store.completeDay(monday);assert.ok(store.loadDay(monday).completedAt);
});
test('an unplanned day with no progress counts zero; unspecified rest remains unlogged',()=>{
  const store=fresh();store.setTrainingMode(monday,'rest-unclassified');
  assert.equal(store.trainingProgress(monday).logged,false);assert.throws(()=>store.confirmSection(monday,'training'));
  store.setTrainingMode(monday,'unplanned-rest');assert.equal(store.trainingProgress(monday).score,0);
  store.confirmSection(monday,'training');assert.equal(summary(store,monday).logged,1);
});
test('future logs cannot rewrite earlier scores; credit resets each Monday and caps at 10',()=>{
  const store=fresh();store.addGymEntry(monday,'chest',10);
  store.setTrainingMode(tuesday,'unplanned-rest');const before=summary(store,tuesday).score;
  for(const group of GROUPS)store.addGymEntry(addDays(monday,6),group.id,20);
  assert.equal(summary(store,tuesday).score,before);assert.equal(store.trainingProgress(addDays(monday,6)).score,10);
  store.setTrainingMode(addDays(monday,7),'unplanned-rest');assert.equal(store.trainingProgress(addDays(monday,7)).score,0);
});
test('rounding cannot award a perfect score before meeting the pace target',()=>{
  const snapshot=fresh().exportSnapshot();snapshot.targets[0][1].forEach(group=>group.target=100);
  const store=createStore({seed:false,snapshot});
  const sunday=addDays(monday,6);
  for(const group of GROUPS)store.addGymEntry(sunday,group.id,group.id==='chest'?99:100);
  assert.equal(store.trainingProgress(sunday).score,9.9);
  store.addGymEntry(sunday,'chest',1);assert.equal(store.trainingProgress(sunday).score,10);
});
test('targets carry forward until edited without changing earlier weeks or crossing later saved edits',()=>{
  const store=fresh();const targets=key=>store.loadWeek(key).groups.map(group=>group.target);
  assert.deepEqual(targets(addDays(monday,7)),Array(7).fill(10));
  store.setWeekTargets(addDays(monday,14),GROUPS.map(group=>({id:group.id,target:20})));
  store.setWeekTargets(addDays(monday,7),GROUPS.map(group=>({id:group.id,target:12})));
  assert.deepEqual(targets(monday),Array(7).fill(10));assert.deepEqual(targets(addDays(monday,7)),Array(7).fill(12));
  assert.deepEqual(targets(addDays(monday,14)),Array(7).fill(20));assert.deepEqual(targets(addDays(monday,21)),Array(7).fill(20));
  const restored=createStore({seed:false,snapshot:validateSnapshot(store.exportSnapshot())});
  assert.deepEqual(restored.loadWeek(addDays(monday,28)).groups.map(group=>group.target),Array(7).fill(20));
});
test('backdated logs reopen later gym reviews only when their scores change',()=>{
  const store=fresh();store.addGymEntry(monday,'chest',10);store.setTrainingMode(tuesday,'unplanned-rest');store.updateRating(tuesday,8);
  for(const section of ['nutrition','training','checklists'])store.confirmSection(tuesday,section);store.completeDay(tuesday);
  store.addGymEntry(addDays(monday,2),'back',10);assert.ok(store.loadDay(tuesday).completedAt);
  store.addGymEntry(monday,'back',10);assert.equal(store.loadDay(tuesday).completedAt,null);
  assert.deepEqual(store.loadDay(tuesday).reviewed,{nutrition:true,training:false,checklists:true});
});
test('target edits recalculate affected scores and reopen gym reviews while preserving planned rest',()=>{
  const store=fresh();store.addGymEntry(monday,'chest',10);store.confirmSection(monday,'training');
  store.setTrainingMode(tuesday,'rest');store.confirmSection(tuesday,'training');
  store.setWeekTargets(monday,GROUPS.map(group=>({id:group.id,target:20})));
  assert.equal(store.trainingProgress(monday).score,5);assert.equal(store.loadDay(monday).reviewed.training,false);
  assert.equal(store.loadDay(tuesday).reviewed.training,true);
});
test('rest decisions round-trip and invalid imports cannot pair no-lift days with sets',()=>{
  const store=fresh();store.setTrainingMode(monday,'unplanned-rest');store.confirmSection(monday,'training');
  const restored=createStore({seed:false,snapshot:store.exportSnapshot()});assert.equal(restored.loadDay(monday).trainingMode,'unplanned-rest');
  const bad=store.exportSnapshot();bad.entries=[{id:'gym-1',date:monday,groupId:'chest',sets:1}];bad.serial=1;assert.throws(()=>validateSnapshot(bad));
  const old=store.exportSnapshot();old.days[0].trainingMode='rest';assert.equal(validateSnapshot(old).days[0].trainingMode,'rest');
});
test('suggestions use least-filled targets through the selected date and recap/averages share the score',()=>{
  const store=fresh();store.addGymEntry(monday,'chest',10);store.addGymEntry(monday,'back',5);
  store.addGymEntry(addDays(monday,2),'quads',10);store.setTrainingMode(tuesday,'unplanned-rest');
  assert.ok(store.trainingProgress(tuesday).suggestions.every(group=>!['chest','back'].includes(group.id)));
  const recap=dailyRecap(store.loadDay(tuesday),store.loadTrainingDay(tuesday),store.loadWeek(tuesday));
  assert.equal(recap.training.unplanned,true);assert.equal(recap.training.score,7.5);
  assert.equal(averageDays([monday,tuesday],date=>summary(store,date)).score,8.8);
});
