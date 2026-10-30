import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays} from '../prototype/model.mjs';
import {summarizeDay,loggingStreak,timeGreeting,scoreReward,scoreGlow} from '../prototype/scoring.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
const monday='2026-10-19';
const routine=(frequency,weekdays=[])=>({recurrence:{frequency,weekdays}});
const summary=store=>date=>summarizeDay(store.loadDay(date),store.loadTrainingDay(date));

test('daily, weekdays, weekly and selected-day schedules honor their start date',()=>{
  for(const[frequency,weekdays,expected]of [['daily',[],[0,1,2,3,4,5,6,7]],['weekdays',[],[0,1,2,3,4,7]],['weekly',[],[0,7]],['custom',[2,4],[1,3]]]){
    const store=createStore({seed:false});store.addTask(monday,'Repeat',routine(frequency,weekdays));
    assert.equal(store.loadDay(addDays(monday,-1)).tasks.length,0);
    for(let i=0;i<=7;i++)assert.equal(store.loadDay(addDays(monday,i)).tasks.length,expected.includes(i)?1:0,`${frequency} day ${i}`);
  }
});
test('unopened recurring days remain unlogged and read-only, with independent occurrences',()=>{
  const store=createStore({seed:false});store.addTask(monday,'Daily',routine('daily'));
  const before=store.exportSnapshot(),tomorrow=addDays(monday,1),day=store.loadDay(tomorrow);
  assert.equal(summary(store)(tomorrow).score,0);assert.equal(store.hasEntry(tomorrow),false);
  assert.deepEqual(store.exportSnapshot(),before);
  store.toggleTask(tomorrow,day.tasks[0].id);
  assert.equal(summary(store)(tomorrow).score,10);assert.equal(store.loadDay(monday).tasks[0].done,false);
  assert.equal(store.loadDay(addDays(monday,2)).tasks[0].done,false);
});
test('parents require their children and checklist scores count leaf actions once',()=>{
  const store=createStore({seed:false});store.addTask(monday,'Get ready for bed',{children:['Brush teeth','Shower']});
  let parent=store.loadDay(monday).tasks[0];assert.throws(()=>store.toggleTask(monday,parent.id));
  store.toggleTask(monday,parent.children[0].id);
  assert.equal(summary(store)(monday).sections[2].score,5);assert.equal(store.loadDay(monday).tasks[0].done,false);
  store.toggleTask(monday,parent.children[1].id);assert.equal(store.loadDay(monday).tasks[0].done,true);
  assert.equal(summary(store)(monday).total,2);
  store.toggleTask(monday,parent.children[0].id);assert.equal(store.loadDay(monday).tasks[0].done,false);
});
test('skipping a recurring occurrence and Undo never affect the schedule or another date',()=>{
  const store=createStore({seed:false});store.addTask(monday,'Bedtime',{...routine('daily'),children:['Brush teeth','Shower']});
  const tomorrow=addDays(monday,1),original=store.loadDay(tomorrow),removed=store.removeTask(tomorrow,original.tasks[0].id);
  assert.equal(store.loadDay(tomorrow).tasks.length,0);assert.equal(store.loadDay(monday).tasks.length,1);
  const restored=createStore({seed:false,snapshot:store.exportSnapshot()});assert.equal(restored.loadDay(tomorrow).tasks.length,0);
  store.restoreTask(tomorrow,removed.task,removed.index);assert.deepEqual(store.loadDay(tomorrow).tasks,original.tasks);
  assert.throws(()=>store.restoreTask(tomorrow,removed.task,0));
});
test('stopping a schedule preserves earlier entries and removes future occurrences',()=>{
  const store=createStore({seed:false});store.addTask(monday,'Daily',routine('daily'));
  const id=store.loadTemplates()[0].id,earlier=store.loadDay(monday);
  store.updateRating(addDays(monday,2),8);store.stopTemplate(id,addDays(monday,1));
  assert.deepEqual(store.loadDay(monday),earlier);
  assert.equal(store.loadDay(addDays(monday,1)).tasks.length,1);
  assert.equal(store.loadDay(addDays(monday,2)).tasks.length,0);assert.equal(store.loadDay(addDays(monday,2)).nutrition,8);
  validateSnapshot(store.exportSnapshot());
});
test('version 1 backups migrate without changing legacy history and v2 routines round-trip',()=>{
  const old=createStore().exportSnapshot();old.version=1;delete old.templates;
  for(const day of old.days){delete day.checklistTouched;delete day.skippedTemplates;for(const task of day.tasks)delete task.children;}
  const store=createStore({seed:false,snapshot:old});assert.equal(store.exportSnapshot().version,2);
  assert.deepEqual(store.loadDay(old.days[0].date).tasks.map(({children,...task})=>task),old.days[0].tasks);
  store.addTask(monday,'Routine',{...routine('custom',[1,3,5]),children:['First','Second']});
  store.toggleTask(monday,store.loadDay(monday).tasks[0].children[0].id);
  const restored=createStore({seed:false,snapshot:store.exportSnapshot()});
  assert.deepEqual(restored.exportSnapshot(),store.exportSnapshot());
  assert.deepEqual(restored.loadDay(addDays(monday,2)),store.loadDay(addDays(monday,2)));
});
test('malformed dependencies and schedules are rejected before stored data changes',()=>{
  const store=createStore({seed:false});store.addTask(monday,'Parent',{children:['Child']});const before=store.exportSnapshot();
  for(const options of [{children:['']},routine('custom'),routine('bad'),routine('custom',[8])])assert.throws(()=>store.addTask(monday,'Invalid',options));
  assert.deepEqual(store.exportSnapshot(),before);
  const changes=[copy=>copy.days[0].tasks[0].done=true,copy=>copy.days[0].tasks[0].children[0].id=copy.days[0].tasks[0].id,copy=>copy.days[0].tasks[0].children[0].children=[{}],copy=>copy.days[0].tasks[0].templateId='unknown'];
  for(const change of changes){const copy=structuredClone(before);change(copy);assert.throws(()=>validateSnapshot(copy));}
});
test('fully logged streak allows today in progress and resets at the first gap',()=>{
  const store=createStore({seed:false}),today=addDays(monday,3);
  for(const date of [monday,addDays(monday,1),addDays(monday,2)]){store.updateRating(date,7);store.setTrainingMode(date,'rest');store.confirmSection(date,'checklists');}
  assert.deepEqual(loggingStreak(today,summary(store)),{count:3,includesToday:false,endDate:addDays(today,-1)});
  store.updateRating(today,8);store.setTrainingMode(today,'rest');store.confirmSection(today,'checklists');
  assert.equal(loggingStreak(today,summary(store)).count,4);
  store.updateRating(addDays(today,-1),null);assert.equal(loggingStreak(today,summary(store)).count,1);
  assert.equal(loggingStreak(addDays(today,2),summary(store)).count,0);
});
test('all four time greetings use Chicago time including midnight and DST',()=>{
  for(const[utc,expected]of [['2026-10-17T09:59Z','Good night'],['2026-10-17T10:00Z','Good morning'],['2026-10-17T17:00Z','Good afternoon'],['2026-10-17T22:00Z','Good evening'],['2026-10-18T02:00Z','Good night'],['2026-11-01T07:30Z','Good night']])assert.equal(timeGreeting(new Date(utc),'America/Chicago'),expected);
});
test('score rewards distinguish high and perfect scores without rewarding missing input',()=>{
  for(const score of [null,NaN,0,8.9,9,9.19])assert.equal(scoreReward(score),'');
  assert.equal(scoreReward(9.2),'score-high');assert.equal(scoreReward(9.9),'score-high');
  assert.equal(scoreReward(10),'score-high score-perfect');
});
test('ring luminosity increases continuously across every score rather than only at nine',()=>{
  assert.equal(scoreGlow(null),0);assert.ok(scoreGlow(6)<scoreGlow(7));assert.ok(scoreGlow(7)<scoreGlow(8));assert.ok(scoreGlow(8)<scoreGlow(9));assert.ok(scoreGlow(9)<scoreGlow(10));
  assert.ok(scoreGlow(8)<2.87);assert.equal(scoreGlow(10),7);
  for(let step=1;step<=100;step++)assert.ok(scoreGlow(step/10)>=scoreGlow((step-1)/10));
});
