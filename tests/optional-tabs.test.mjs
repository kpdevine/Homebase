import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays} from '../prototype/model.mjs';
import {normalizeSettings,newUserSettings,timeScore,enabledSections} from '../prototype/customization.mjs';
import {summarizeDay,taskScoreRange,fullyLogged} from '../prototype/scoring.mjs';
import {leaderboardSummary,sharedDays} from '../prototype/social-model.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {recordsSnapshot,snapshotRecords} from '../prototype/cloud-records.mjs';
const date='2026-10-19';
function timed(){const config=newUserSettings();config.tabs.sleep=config.tabs.prayer=true;config.sleep.goalMinutes=480;config.prayer.goalMinutes=20;return createStore({seed:false,today:date,settings:config});}
const summary=(store,key=date)=>summarizeDay(store.loadDay(key),store.loadTrainingDay(key),store.loadWeek(key));

test('new users start with only To-do; existing settings keep the original four sections',()=>{
  assert.deepEqual(Object.entries(newUserSettings().tabs).filter(([,on])=>on).map(([id])=>id),['checklists']);
  assert.deepEqual(enabledSections(createStore({seed:false}).loadDay(date)).map(s=>s.id),['nutrition','training','checklists','sentiments']);
});
test('Sleep and Prayer score recorded minutes linearly with an exact cap and an honest zero',()=>{
  const store=timed();assert.equal(timeScore(store.loadDay(date),'sleep'),null);
  store.updateTime(date,'sleep',360);store.updateTime(date,'prayer',5);
  assert.equal(timeScore(store.loadDay(date),'sleep'),7.5);assert.equal(timeScore(store.loadDay(date),'prayer'),2.5);
  store.updateTime(date,'sleep',600);store.updateTime(date,'prayer',0);
  assert.equal(timeScore(store.loadDay(date),'sleep'),10);assert.equal(timeScore(store.loadDay(date),'prayer'),0);
  store.updateTime(date,'sleep',null);assert.equal(timeScore(store.loadDay(date),'sleep'),null);
});
test('only enabled tabs enter the average and the required review sequence',()=>{
  const store=timed();store.updateTime(date,'sleep',360);store.updateTime(date,'prayer',10);
  assert.deepEqual(store.dayProgress(date).sections.map(s=>s.id),['checklists','sleep','prayer']);
  assert.throws(()=>store.confirmSection(date,'nutrition'));
  for(const id of ['checklists','sleep','prayer'])store.confirmSection(date,id);
  assert.equal(summary(store).score,7.5);assert.equal(summary(store).requiredCount,3);assert.equal(fullyLogged(summary(store)),true);
  store.completeDay(date);assert.ok(store.loadDay(date).completedAt);
  store.updateTime(date,'sleep',300);assert.equal(store.loadDay(date).completedAt,null);assert.equal(store.loadDay(date).reviewed.prayer,true);
});
test('disabling tabs retains their saved content and freezes earlier scores and review requirements',()=>{
  const store=timed();store.updateTime(date,'sleep',360);store.updateTime(date,'prayer',10);for(const id of ['checklists','sleep','prayer'])store.confirmSection(date,id);store.completeDay(date);
  const next=addDays(date,1),before=summary(store),config=store.getSettings();config.tabs.sleep=false;config.prayer.goalMinutes=60;store.setSettings(config,next);
  assert.deepEqual(summary(store),before);assert.ok(store.dayProgress(date).canComplete);assert.equal(store.loadDay(date).sleep.minutes,360);
  store.updateTime(next,'sleep',480);assert.equal(summary(store,next).sections.some(section=>section.id==='sleep'),false);assert.equal(store.loadDay(next).sleep.minutes,480);
  assert.doesNotThrow(()=>validateSnapshot(store.exportSnapshot()));
});
test('time logs, disabled sections, goals and review flags survive backup and cloud round trips',()=>{
  const store=timed();store.updateTime(date,'sleep',421);store.updateTime(date,'prayer',17);store.confirmSection(date,'sleep');
  const original=store.exportSnapshot();
  for(const copy of [validateSnapshot(original),recordsSnapshot(snapshotRecords(original))])assert.deepEqual(createStore({seed:false,snapshot:copy}).exportSnapshot(),original);
});
test('turning off To-do removes its projection and does not inflate a leaderboard',()=>{
  const store=timed(),config=store.getSettings();config.tabs.checklists=false;store.setSettings(config,date);store.addTask(date,'Still preserved');
  store.updateTime(date,'sleep',360);store.updateTime(date,'prayer',10);
  assert.deepEqual(taskScoreRange(summary(store)),{score:6.3,low:6.3,projected:false});
  assert.equal(leaderboardSummary(store,addDays(date,1)).daysLogged,1);
  assert.deepEqual(sharedDays(store,addDays(date,1)),[{date,score:6.3,reviewComplete:false}]);
});
test('Overview alone creates neither a fabricated score nor a completable empty review',()=>{
  const config=newUserSettings();config.tabs.checklists=false;const store=createStore({seed:false,today:date,settings:config});
  assert.equal(summary(store).score,null);assert.equal(fullyLogged(summary(store)),false);assert.equal(store.dayProgress(date).canComplete,false);assert.throws(()=>store.completeDay(date));
});
test('time entry validation and archive protection apply to both new categories',()=>{
  const store=createStore({seed:false,today:date,editableToday:()=>date});
  for(const value of [-1,1441,1.5,NaN])assert.throws(()=>store.updateTime(date,'sleep',value));
  assert.throws(()=>store.updateTime(date,'unknown',30));assert.throws(()=>store.updateTime(addDays(date,-8),'prayer',5));
  const config=normalizeSettings();config.sleep.goalMinutes=0;assert.throws(()=>normalizeSettings(config));
});
test('saving the opening tab choice without scoring changes preserves a completed day',()=>{
  const store=timed();store.updateTime(date,'sleep',480);store.updateTime(date,'prayer',20);for(const id of ['checklists','sleep','prayer'])store.confirmSection(date,id);store.completeDay(date);
  const completedAt=store.loadDay(date).completedAt,config=store.getSettings();config.tabsChosen=true;store.setSettings(config,date);
  assert.equal(store.loadDay(date).completedAt,completedAt);assert.equal(store.getSettings().tabsChosen,true);
});
test('an enabled required sentiment rating keeps an otherwise logged day provisional',()=>{
  const config=newUserSettings();config.tabs.sentiments=true;config.sentiments.rating='required';const store=createStore({seed:false,today:date,settings:config});store.confirmSection(date,'checklists');
  assert.equal(summary(store).requiredCount,2);assert.equal(summary(store).provisional,true);assert.equal(fullyLogged(summary(store)),false);
  store.updateSentiments(date,{rating:8});assert.equal(fullyLogged(summary(store)),true);assert.equal(summary(store).score,9);
});
