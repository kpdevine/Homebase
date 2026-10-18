import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,GROUPS,addDays} from '../prototype/model.mjs';
import {summarizeDay,loggingStreak,averageDays} from '../prototype/scoring.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {dailyRecap} from '../prototype/recap.mjs';
const monday='2026-10-12',tuesday=addDays(monday,1);
const summary=(store,date)=>summarizeDay(store.loadDay(date),store.loadTrainingDay(date),store.loadWeek(date));
function fresh(){const store=createStore({seed:false});store.setWeekTargets(monday,GROUPS.map((group,index)=>({id:group.id,target:index<5?10:0})));return store;}
function rest(store,index){const date=addDays(monday,index);store.setTrainingMode(date,'rest');return store.trainingProgress(date);}

test('all six proposed useful/extra examples produce the specified daily scores',()=>{
  for(const [useful,extra,score] of [[10,0,10],[8,0,8],[5,10,7.5],[0,10,2.5],[0,20,5],[10,10,10]]){
    const store=fresh();store.addGymEntry(monday,'chest',10);
    if(useful)store.addGymEntry(tuesday,'back',useful);
    if(extra)store.addGymEntry(tuesday,'chest',extra);
    const value=store.trainingProgress(tuesday);
    assert.equal(value.dailyTarget,10);assert.equal(value.useful,useful);assert.equal(value.nonUseful,extra);assert.equal(value.score,score);
  }
});

test('a group crossing its weekly cap splits a log into useful and extra sets',()=>{
  const store=fresh();store.addGymEntry(monday,'chest',8);const id=store.addGymEntry(tuesday,'chest',6);
  const value=store.trainingProgress(tuesday),entry=value.classifications.find(item=>item.id===id);
  assert.equal(entry.useful,2);assert.equal(entry.nonUseful,4);assert.equal(value.weighted,3);assert.equal(value.score,3);
  assert.equal(value.credited,10);assert.equal(value.actual,14);assert.equal(store.loadWeek(tuesday).groups[0].completed,14);
});

test('daily target is fixed regardless of prior progress and later workouts cannot improve earlier scores',()=>{
  const store=fresh();store.addGymEntry(monday,'chest',2);store.addGymEntry(tuesday,'back',10);
  assert.equal(store.trainingProgress(monday).score,2);assert.equal(store.trainingProgress(tuesday).score,10);
  store.addGymEntry(addDays(monday,6),'chest',20);assert.equal(store.trainingProgress(monday).score,2);
  assert.equal(store.trainingProgress(tuesday).dailyTarget,10);
});

test('two flexible rest credits award ten, then rest scores zero; unanswered days consume nothing',()=>{
  const store=fresh();assert.equal(store.trainingProgress(monday).score,null);
  const first=rest(store,1),second=rest(store,3),third=rest(store,6);
  assert.equal(first.score,10);assert.equal(first.restCredits,1);assert.equal(second.score,10);assert.equal(second.restCredits,0);
  assert.equal(third.score,0);assert.equal(third.restCredits,0);assert.equal(third.logged,true);
  assert.equal(store.trainingProgress(addDays(monday,2)).restCredits,1);
  assert.equal(store.trainingProgress(monday).restCredits,2);
});

test('completed weekly goals make subsequent rest perfect without spending any more credits',()=>{
  const store=fresh();rest(store,0);rest(store,1);rest(store,2);
  for(const group of GROUPS.slice(0,5))store.addGymEntry(addDays(monday,3),group.id,10);
  const value=rest(store,4);assert.equal(value.score,10);assert.equal(value.restCredits,0);assert.equal(value.restCreditUsed,false);
  assert.equal(store.trainingProgress(addDays(monday,2)).score,0,'later completion does not upgrade the earlier third rest');
  const early=fresh();for(const group of GROUPS.slice(0,5))early.addGymEntry(monday,group.id,10);
  assert.equal(rest(early,1).restCredits,2);
});

test('a workout with only extra or untargeted sets earns quarter credit and uses no rest credit',()=>{
  const store=fresh();store.addGymEntry(monday,'chest',10);store.addGymEntry(tuesday,'chest',10);store.addGymEntry(tuesday,'legs',10);
  const value=store.trainingProgress(tuesday);assert.equal(value.score,5);assert.equal(value.nonUseful,20);assert.equal(value.useful,0);
  assert.equal(value.rest,false);assert.equal(value.restCredits,2);assert.equal(value.credited,10);
});

test('week tracking resets Monday without changing earlier goals or records',()=>{
  const store=fresh();rest(store,0);rest(store,1);rest(store,2);store.addGymEntry(addDays(monday,3),'chest',20);
  const next=addDays(monday,7);store.setTrainingMode(next,'rest');const value=store.trainingProgress(next);
  assert.equal(value.score,10);assert.equal(value.restCredits,1);assert.equal(value.actual,0);assert.equal(value.credited,0);
  assert.equal(store.trainingProgress(addDays(monday,2)).score,0);
});

test('targets carry forward until edited without changing earlier weeks or crossing later saved edits',()=>{
  const store=fresh();const targets=key=>store.loadWeek(key).groups.map(group=>group.target);
  assert.deepEqual(targets(addDays(monday,7)),[10,10,10,10,10,0,0]);
  store.setWeekTargets(addDays(monday,14),GROUPS.map(group=>({id:group.id,target:20})));
  store.setWeekTargets(addDays(monday,7),GROUPS.map(group=>({id:group.id,target:12})));
  assert.deepEqual(targets(monday),[10,10,10,10,10,0,0]);assert.deepEqual(targets(addDays(monday,7)),Array(7).fill(12));
  assert.deepEqual(targets(addDays(monday,14)),Array(7).fill(20));assert.deepEqual(targets(addDays(monday,21)),Array(7).fill(20));
  const restored=createStore({seed:false,snapshot:validateSnapshot(store.exportSnapshot())});
  assert.deepEqual(restored.loadWeek(addDays(monday,28)).groups.map(group=>group.target),Array(7).fill(20));
});

test('backdated set deletion reclassifies later sets and reopens affected reviews',()=>{
  const store=fresh(),id=store.addGymEntry(monday,'chest',10);store.addGymEntry(tuesday,'chest',10);
  store.updateRating(tuesday,8);for(const section of ['nutrition','training','checklists'])store.confirmSection(tuesday,section);store.completeDay(tuesday);
  assert.equal(store.trainingProgress(tuesday).score,2.5);
  store.removeGymEntry(id);assert.equal(store.trainingProgress(tuesday).score,10);assert.equal(store.loadDay(tuesday).completedAt,null);
  assert.deepEqual(store.loadDay(tuesday).reviewed,{nutrition:true,training:false,checklists:true});
  assert.equal(store.loadDay(monday).trainingMode,'rest');assert.equal(store.trainingProgress(tuesday).restCredits,1);
});

test('backdating rest reallocates credits, and replacing rest with lifting gives a later rest its credit back',()=>{
  const store=fresh();rest(store,1);rest(store,2);rest(store,3);store.confirmSection(addDays(monday,2),'training');
  rest(store,0);assert.equal(store.trainingProgress(addDays(monday,2)).score,0);assert.equal(store.loadDay(addDays(monday,2)).reviewed.training,false);
  store.addGymEntry(monday,'chest',1);assert.equal(store.trainingProgress(addDays(monday,2)).score,10);assert.equal(store.trainingProgress(monday).restCredits,2);
});

test('target edits change the fixed daily denominator and replay useful sets and completed-goal rests',()=>{
  const store=fresh();store.addGymEntry(monday,'chest',10);store.confirmSection(monday,'training');rest(store,1);
  store.setWeekTargets(monday,GROUPS.map(group=>({id:group.id,target:20})));
  assert.equal(store.trainingProgress(monday).dailyTarget,28);assert.equal(store.trainingProgress(monday).score,3.6);
  assert.equal(store.loadDay(monday).reviewed.training,false);assert.equal(store.trainingProgress(tuesday).score,10);
});

test('legacy planned/unplanned/unclassified rest becomes flexible rest without losing backup records',()=>{
  const store=fresh();for(const [index,mode] of ['rest','unplanned-rest','rest-unclassified'].entries())store.setTrainingMode(addDays(monday,index),mode);
  const restored=createStore({seed:false,snapshot:validateSnapshot(store.exportSnapshot())});
  assert.deepEqual([0,1,2].map(index=>restored.trainingProgress(addDays(monday,index)).score),[10,10,0]);
  restored.confirmSection(addDays(monday,2),'training');validateSnapshot(restored.exportSnapshot());
  const bad=store.exportSnapshot();bad.entries=[{id:'gym-1',date:monday,groupId:'chest',sets:1}];bad.serial=1;assert.throws(()=>validateSnapshot(bad));
});

test('rest scores are included in overview, recap, averages, and required check-ins',()=>{
  const store=fresh();store.updateRating(monday,6);store.addTask(monday,'Task');rest(store,0);
  for(const section of ['nutrition','training','checklists'])store.confirmSection(monday,section);
  assert.equal(summary(store,monday).score,5.3);assert.equal(summary(store,monday).sections[1].excluded,false);
  assert.equal(dailyRecap(store.loadDay(monday),[],store.loadWeek(monday)).training.score,10);
  assert.equal(averageDays([monday],date=>summary(store,date)).score,5.3);assert.equal(loggingStreak(monday,date=>summary(store,date)).count,1);
});

test('rounding never shows ten before the daily weighted target is met',()=>{
  const store=fresh(),snapshot=store.exportSnapshot();snapshot.targets[0][1][0].target=1000;snapshot.targets[0][1].slice(1).forEach(group=>group.target=0);
  const large=createStore({seed:false,snapshot});large.addGymEntry(monday,'chest',100);large.addGymEntry(monday,'chest',99);
  assert.equal(large.trainingProgress(monday).score,9.9);large.addGymEntry(monday,'chest',1);assert.equal(large.trainingProgress(monday).score,10);
});

test('suggestions use only needed muscle goals through the selected date, regardless of future sets',()=>{
  const store=fresh();store.addGymEntry(monday,'chest',10);store.addGymEntry(addDays(monday,2),'back',10);
  const value=store.trainingProgress(tuesday);assert.ok(!value.suggestions.some(group=>group.id==='chest'));assert.ok(value.suggestions.some(group=>group.id==='back'));
});

test('a workout entered later for an earlier date receives useful credit first',()=>{
  const store=fresh();store.addGymEntry(tuesday,'chest',10);assert.equal(store.trainingProgress(tuesday).score,10);
  store.addGymEntry(monday,'chest',8);assert.equal(store.trainingProgress(monday).score,8);
  assert.equal(store.trainingProgress(tuesday).useful,2);assert.equal(store.trainingProgress(tuesday).nonUseful,8);assert.equal(store.trainingProgress(tuesday).score,4);
});
