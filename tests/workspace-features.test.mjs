import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,isEditableDay,addDays} from '../prototype/model.mjs';
import {orderedTasks} from '../prototype/tasks.mjs';
import {summarizeDay,taskScoreRange,categorySummary,averageDays} from '../prototype/scoring.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {snapshotRecords,recordsSnapshot} from '../prototype/cloud-records.mjs';
import {dailyRecap} from '../prototype/recap.mjs';
import {idealWorkout} from '../prototype/training.mjs';
const today='2026-10-18',fresh=()=>createStore({seed:false});
const summary=store=>summarizeDay(store.loadDay(today),store.loadTrainingDay(today),store.loadWeek(today));

test('the previous seven calendar days remain editable, older logs are protected without changing summaries',()=>{
  assert.ok(isEditableDay(addDays(today,-7),today));assert.ok(!isEditableDay(addDays(today,-8),today));
  const old=addDays(today,-8),source=fresh();source.updateRating(old,8);const task=source.addTask(old,'Old task'),gym=source.addGymEntry(old,'chest',3);
  const store=createStore({seed:false,snapshot:source.exportSnapshot(),editableToday:()=>today}),before=store.exportSnapshot();
  const edits=[()=>store.updateRating(old,7),()=>store.updateNotes(old,'nutrition','changed'),()=>store.updateSentiments(old,{rating:9}),()=>store.updateBodyWeight(old,{value:180,unit:'lb'}),()=>store.addTask(old,'New task'),()=>store.toggleTask(old,task),()=>store.removeTask(old,task),()=>store.setTrainingMode(old,'training'),()=>store.addGymEntry(old,'chest',1),()=>store.removeGymEntry(gym),()=>store.confirmSection(old,'nutrition'),()=>store.completeDay(old),()=>store.setWeekTargets(old,[]),()=>store.stopTemplate('missing',old)];
  for(const edit of edits)assert.throws(edit,/summary only/);
  assert.deepEqual(store.exportSnapshot(),before);assert.equal(store.loadDay(old).nutrition,8);
  store.updateRating(addDays(today,-7),7);store.addTask(addDays(today,1),'Tomorrow');
  assert.equal(store.loadDay(addDays(today,1)).tasks[0].name,'Tomorrow');
});

test('one-time tasks precede recurring tasks without changing their relative order or storage',()=>{
  const tasks=[{id:'r1',templateId:'r'},{id:'a'},{id:'r2',templateId:'s'},{id:'b'}],before=structuredClone(tasks);
  assert.deepEqual(orderedTasks(tasks).map(task=>task.id),['a','b','r1','r2']);assert.deepEqual(tasks,before);
});

test('planning tasks does not log the to-do list; working or explicitly reviewing does',()=>{
  const store=fresh();store.updateRating(today,8);const id=store.addTask(today,'One task');
  assert.equal(summary(store).sections.find(section=>section.id==='checklists').score,null);
  assert.equal(summary(store).score,8);assert.equal(taskScoreRange(summary(store)).projected,true);
  store.removeTask(today,id);const next=store.addTask(today,'Another task');
  assert.equal(summary(store).logged,1);
  store.confirmSection(today,'checklists');assert.equal(summary(store).sections[2].score,0);
  store.toggleTask(today,next);assert.equal(summary(store).sections[2].score,10);
});

test('the optimistic task score includes only remaining leaf actions and never changes the recorded score',()=>{
  const store=fresh();store.updateRating(today,8);store.setTrainingMode(today,'rest');store.setCreatine(today,true);store.addTask(today,'Parent',{children:['First','Second']});
  let day=store.loadDay(today);store.toggleTask(today,day.tasks[0].children[0].id);
  const actual=summary(store),before=store.exportSnapshot();
  assert.deepEqual(taskScoreRange(actual),{score:9.3,low:7.7,projected:true});assert.equal(actual.score,7.7);assert.deepEqual(store.exportSnapshot(),before);
  store.updateSentiments(today,{rating:4});assert.deepEqual(taskScoreRange(summary(store)),{score:8,low:6.8,projected:true});
  store.toggleTask(today,day.tasks[0].children[1].id);assert.equal(taskScoreRange(summary(store)).projected,false);
});

test('body weight persists locally and through cloud records without inventing gym credit',()=>{
  const store=fresh();store.updateBodyWeight(today,{value:182.4,unit:'lb'});
  assert.equal(summary(store).score,null);assert.equal(store.dayProgress(today).sections[1].ready,false);
  const restored=createStore({seed:false,snapshot:recordsSnapshot(snapshotRecords(store.exportSnapshot()))});
  assert.deepEqual(restored.loadDay(today).bodyWeight,{value:182.4,unit:'lb'});
  assert.deepEqual(dailyRecap(restored.loadDay(today)).bodyWeight,{value:182.4,unit:'lb'});
  const old=store.exportSnapshot();delete old.days[0].bodyWeight;assert.equal(validateSnapshot(old).days[0].bodyWeight,null);
  const before=store.exportSnapshot();
  for(const value of [{value:0,unit:'lb'},{value:701,unit:'kg'},{value:180.55,unit:'lb'},{value:180,unit:'stone'}])assert.throws(()=>store.updateBodyWeight(today,value));
  assert.deepEqual(store.exportSnapshot(),before);store.updateBodyWeight(today,null);assert.equal(store.loadDay(today).bodyWeight,null);
});

test('calendar category filters and their averages use only entered category scores',()=>{
  const store=fresh();store.updateRating(today,8);store.updateSentiments(today,{rating:2});
  const data=summary(store);assert.equal(categorySummary(data,'all').score,5);
  assert.equal(categorySummary(data,'nutrition').score,8);assert.equal(categorySummary(data,'sentiments').score,2);assert.equal(categorySummary(data,'training').score,null);
  const average=averageDays([today,addDays(today,1)],date=>categorySummary(summarizeDay(store.loadDay(date)), 'nutrition'));
  assert.equal(average.score,8);assert.equal(average.count,1);assert.equal(data.score,5);
});

test('ideal workout fills the remaining daily target with useful whole sets and updates after logging',()=>{
  const store=fresh(),progress=store.trainingProgress(today),plan=idealWorkout(progress);
  assert.equal(plan.sets,Math.ceil(progress.dailyTarget));assert.ok(plan.groups.length>=1);
  for(const group of plan.groups){assert.ok(Number.isInteger(group.sets)&&group.sets>0&&group.sets<=group.remaining);store.addGymEntry(today,group.id,group.sets);}
  assert.equal(store.trainingProgress(today).gymScore,10);assert.equal(idealWorkout(store.trainingProgress(today)).sets,0);
  assert.equal(idealWorkout(store.trainingProgress(today)).targetMet,true);
});

test('ideal workout stops at the weekly deficit and never recommends full or disabled muscles',()=>{
  const progress={target:50,dailyTarget:10,weighted:0,groups:[{id:'chest',name:'Chest',target:10,credited:10,remaining:0},{id:'back',name:'Back',target:10,credited:8,remaining:2},{id:'core',name:'Core',target:0,credited:0,remaining:0}]};
  const plan=idealWorkout(progress);assert.equal(plan.sets,2);assert.deepEqual(plan.groups.map(group=>[group.id,group.sets]),[['back',2]]);
  assert.equal(idealWorkout({...progress,groups:progress.groups.map(group=>({...group,remaining:0}))}).goalsMet,true);
});
