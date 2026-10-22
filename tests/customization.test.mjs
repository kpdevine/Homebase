import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays} from '../prototype/model.mjs';
import {normalizeSettings,nutritionScore} from '../prototype/customization.mjs';
import {summarizeDay} from '../prototype/scoring.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {snapshotRecords,recordsSnapshot} from '../prototype/cloud-records.mjs';
import {leaderboardSummary,username,rankLeaderboard} from '../prototype/social-model.mjs';
const monday='2026-10-19';
function configured(change=()=>{}){const store=createStore({seed:false,today:monday}),settings=normalizeSettings();change(settings);store.setSettings(settings,monday);return store;}
test('macro scoring rewards meeting both goals without punishing more protein or fewer calories',()=>{
  const store=configured(s=>{s.nutrition={mode:'macros',proteinGoal:100,calorieGoal:2000};});
  const score=()=>nutritionScore(store.loadDay(monday));assert.equal(score(),null);
  store.updateFood(monday,{protein:50});assert.equal(score(),null);assert.throws(()=>store.confirmSection(monday,'nutrition'));
  store.updateFood(monday,{calories:4000});assert.equal(score(),5);store.confirmSection(monday,'nutrition');
  store.updateFood(monday,{protein:150,calories:1800});assert.equal(score(),10);assert.equal(store.loadDay(monday).reviewed.nutrition,false);
  store.updateFood(monday,{protein:0,calories:0});assert.equal(score(),5);
  assert.throws(()=>store.updateFood(monday,{protein:-1}));
});
test('new training asks an explicit creatine answer and disabling it restores all ten training points',()=>{
  const store=configured();store.setTrainingMode(monday,'rest');assert.equal(store.loadDay(monday).creatine,null);assert.equal(store.dayProgress(monday).sections[1].ready,false);
  store.setCreatine(monday,false);assert.equal(store.trainingProgress(monday).score,9);store.confirmSection(monday,'training');
  const settings=store.getSettings();settings.training.creatine=false;store.setSettings(settings,monday);assert.equal(store.trainingProgress(monday).score,10);assert.equal(store.dayProgress(monday).sections[1].ready,true);
});
test('other training scores minutes linearly, caps the result, and replays configurable flex rest days',()=>{
  const store=configured(s=>{s.training.mode='other';s.training.activity='Cycling';s.training.minuteGoal=40;s.training.flexDays=3;s.training.creatine=false;});
  store.setTrainingMode(monday,'training');assert.equal(store.dayProgress(monday).sections[1].ready,false);store.updateTrainingMinutes(monday,20);assert.equal(store.trainingProgress(monday).score,5);
  store.updateTrainingMinutes(monday,90);assert.equal(store.trainingProgress(monday).score,10);
  for(let i=1;i<=4;i++){const date=addDays(monday,i);store.setTrainingMode(date,'rest');assert.equal(store.trainingProgress(date).score,i<=3?10:0);}
  const next=addDays(monday,7);store.setTrainingMode(next,'rest');assert.equal(store.trainingProgress(next).restCredits,2);
});
test('custom groups and settings survive cloud and backup round trips; earlier records retain their scoring',()=>{
  const store=createStore({seed:false,today:monday}),prior=addDays(monday,-1);store.updateRating(prior,8);store.setTrainingMode(prior,'rest');
  const before=summarizeDay(store.loadDay(prior),[],store.loadWeek(prior)).score;
  const settings=normalizeSettings();settings.training.groups=[{id:'custom-pull',name:'Pull',target:10}];settings.nutrition.mode='macros';store.setSettings(settings,monday);store.addGymEntry(monday,'custom-pull',4);
  assert.equal(summarizeDay(store.loadDay(prior),[],store.loadWeek(prior)).score,before);
  for(const snapshot of [validateSnapshot(store.exportSnapshot()),recordsSnapshot(snapshotRecords(store.exportSnapshot()))]){const restored=createStore({seed:false,snapshot});assert.equal(restored.getSettings().training.groups[0].name,'Pull');assert.equal(restored.trainingProgress(monday).useful,4);assert.deepEqual(restored.exportSnapshot(),store.exportSnapshot());}
});
test('required sentiments block review; notes-only sentiments never enter scoring',()=>{
  const store=configured(s=>s.sentiments.rating='required');assert.throws(()=>store.confirmSection(monday,'sentiments'));store.updateSentiments(monday,{rating:7});store.confirmSection(monday,'sentiments');
  const settings=store.getSettings();settings.sentiments.rating='hidden';store.setSettings(settings,monday);store.confirmSection(monday,'sentiments');assert.equal(summarizeDay(store.loadDay(monday),[],store.loadWeek(monday)).sections.some(s=>s.id==='sentiments'),false);
});
test('leaderboards count logged days alongside recorded averages and yesterday; incomplete days never inflate ranks',()=>{
  const store=configured(s=>s.training.creatine=false);
  store.updateRating(monday,8);store.setTrainingMode(monday,'rest');store.confirmSection(monday,'checklists');
  const tuesday=addDays(monday,1);store.updateRating(tuesday,10);
  const summary=leaderboardSummary(store,tuesday);assert.equal(summary.daysLogged,1);assert.equal(summary.totalDaysLogged,1);assert.equal(summary.yesterdayScore,9.3);assert.equal(summary.monthScore,9.3);
  assert.equal(JSON.stringify(summary).includes('nutrition'),false);
  assert.equal(username(' My_Planet '),'my_planet');assert.throws(()=>username('a'));assert.throws(()=>username('a/b'));
  assert.equal(rankLeaderboard([{username:'a',month:'2026-09',monthScore:10,daysLogged:30},{username:'b',month:'2026-10',monthScore:8,daysLogged:2}],'2026-10')[0].username,'b');
});
test('editing a group catalog preserves removed custom-group logs and current weekly target edits',()=>{
  const store=configured(s=>s.training.groups=[{id:'custom-pull',name:'Pull',target:10}]);store.addGymEntry(monday,'custom-pull',4);
  store.setWeekTargets(monday,[{id:'custom-pull',target:14}]);assert.equal(store.getSettings().training.groups[0].target,14);
  const settings=store.getSettings();settings.training.groups=[{id:'custom-push',name:'Push',target:12}];store.setSettings(settings,monday);
  const restored=createStore({seed:false,snapshot:recordsSnapshot(snapshotRecords(store.exportSnapshot()))});
  assert.equal(restored.loadTrainingDay(monday)[0].sets,4);assert.equal(restored.groupName(monday,'custom-pull'),'Pull');assert.equal(restored.trainingProgress(monday).nonUseful,4);
});
test('switching training style keeps earlier set records while allowing other-training rest and minutes',()=>{
  const store=configured(s=>s.training.creatine=false);store.addGymEntry(monday,'chest',3);
  const settings=store.getSettings();settings.training.mode='other';store.setSettings(settings,monday);store.setTrainingMode(monday,'rest');
  assert.equal(store.trainingProgress(monday).score,10);assert.doesNotThrow(()=>validateSnapshot(store.exportSnapshot()));assert.equal(store.loadTrainingDay(monday).length,1);
  store.setTrainingMode(monday,'training');store.updateTrainingMinutes(monday,15);assert.equal(store.trainingProgress(monday).score,5);
});
