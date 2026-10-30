import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays} from '../prototype/model.mjs';
import {dailyRecap} from '../prototype/recap.mjs';

const date='2026-10-17';
const recap=(store,key=date)=>dailyRecap(store.loadDay(key),store.loadTrainingDay(key));

test('an untouched scheduled day stays unlogged when opened in a recap',()=>{
  const store=createStore({seed:false});
  store.addTask(date,'Get ready for bed',{children:['Brush teeth','Shower'],recurrence:{frequency:'daily',weekdays:[]}});
  const before=store.exportSnapshot(),result=recap(store,addDays(date,1));
  assert.equal(result.score,0);assert.equal(result.hasActivity,false);assert.equal(result.checklistLogged,false);
  assert.equal(result.total,2);assert.equal(result.state,'Not logged');assert.equal(result.tasks[0].children.length,2);
  assert.deepEqual(store.exportSnapshot(),before);
});
test('a recap aggregates dated training groups without including other days or inventing rest',()=>{
  const store=createStore({seed:false});
  store.addGymEntry(date,'chest',3);store.addGymEntry(date,'chest',2);store.addGymEntry(date,'back',4);
  store.addGymEntry(addDays(date,1),'chest',30);
  const result=recap(store);
  assert.equal(result.training.sets,9);assert.equal(result.training.rest,false);
  assert.deepEqual(result.training.groups,[{id:'chest',sets:5},{id:'back',sets:4}]);
  assert.equal(result.state,'Partly logged');assert.equal(result.logged,1);
});
test('rest, reviewed empty checklists and completed days retain their distinct meanings',()=>{
  const store=createStore({seed:false});store.setTrainingMode(date,'rest');store.updateRating(date,8.6);
  store.confirmSection(date,'checklists');
  let result=recap(store);
  assert.equal(result.state,'All categories logged');assert.equal(result.completed,false);
  assert.equal(result.training.rest,true);assert.equal(result.training.sets,0);
  assert.equal(result.total,0);assert.equal(result.checklistLogged,true);assert.equal(result.reviewed,1);
  store.confirmSection(date,'nutrition');store.confirmSection(date,'training');store.confirmSection(date,'sentiments');store.completeDay(date);
  result=recap(store);assert.equal(result.state,'Day complete');assert.equal(result.reviewed,4);assert.equal(result.completed,true);
});
test('notes retain their full text, omit whitespace-only notes, and do not create a score',()=>{
  const store=createStore({seed:false}),text='Late dinner.\nStill hungry. <b>Personal note</b>';
  store.updateNotes(date,'nutrition',text);store.updateNotes(date,'training','  \n ');
  const result=recap(store);
  assert.deepEqual(result.notes,[{section:'nutrition',text}]);assert.equal(result.hasActivity,true);assert.equal(result.score,null);assert.equal(result.logged,0);
  result.notes[0].text='Changed presentation';assert.equal(store.loadDay(date).notes.nutrition,text);
});
test('parent tasks are presented with children but scored only by their leaf actions',()=>{
  const store=createStore({seed:false});store.addTask(date,'Bedtime',{children:['Brush teeth','Shower']});
  store.toggleTask(date,store.loadDay(date).tasks[0].children[0].id);
  const result=recap(store);
  assert.equal(result.done,1);assert.equal(result.total,2);assert.equal(result.tasks[0].done,false);
  assert.equal(result.tasks[0].children[0].done,true);assert.equal(result.tasks[0].children[1].done,false);
  result.tasks[0].children[0].done=false;assert.equal(store.loadDay(date).tasks[0].children[0].done,true);
});
