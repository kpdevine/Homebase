import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays} from '../prototype/model.mjs';
import {summarizeDay,fullyLogged} from '../prototype/scoring.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {snapshotRecords,recordsSnapshot} from '../prototype/cloud-records.mjs';

const start='2026-10-26',planned=addDays(start,2);
const score=(store,date)=>summarizeDay(store.loadDay(date),[],store.loadWeek(date));

test('a task with no expiration penalizes every unfinished day from its plan and preserves history after completion',()=>{
  const store=createStore({seed:false}),id=store.addTask(start,'Write the outline',{displayDate:planned});
  for(let offset=0;offset<7;offset++)store.updateRating(addDays(start,offset),8);
  for(const date of [start,addDays(start,1)]){assert.equal(score(store,date).score,8);assert.equal(score(store,date).total,0);}
  for(const date of [planned,addDays(planned,1),addDays(planned,2)]){
    assert.equal(store.loadDay(date).tasks[0].id,id);assert.equal(score(store,date).score,4);
    assert.equal(score(store,date).sections.find(section=>section.id==='checklists').logged,false);
    assert.equal(fullyLogged(score(store,date)),false);
  }
  const completed=addDays(planned,3);store.toggleTask(completed,id);
  assert.equal(score(store,completed).sections.find(section=>section.id==='checklists').score,10);
  assert.equal(score(store,addDays(completed,-1)).score,4);
  assert.equal(store.loadDay(addDays(completed,1)).tasks.length,0);
  const restored=createStore({seed:false,snapshot:recordsSnapshot(snapshotRecords(store.exportSnapshot()))});
  for(let offset=0;offset<7;offset++)assert.deepEqual(restored.loadDay(addDays(start,offset)),store.loadDay(addDays(start,offset)));
});

test('an expiration does not start penalties before a later planned date or remove overdue tasks',()=>{
  const store=createStore({seed:false});store.addTask(start,'Send form',{displayDate:planned,dueDate:addDays(start,1)});
  store.updateRating(start,8);store.updateRating(addDays(start,1),8);
  assert.equal(score(store,start).score,8);assert.equal(score(store,addDays(start,1)).score,8);
  assert.equal(store.loadDay(addDays(planned,30)).tasks.length,1);
  assert.equal(score(store,planned).sections.find(section=>section.id==='checklists').score,0);
});

test('legacy tasks carry forward without read-time rewrites and support completion, removal and undo',()=>{
  const source=createStore({seed:false}),id=source.addTask(start,'Existing task');
  const snapshot=source.exportSnapshot(),task=snapshot.days[0].tasks[0];delete task.taskEvents;delete task.displayDate;delete task.dueDate;
  const store=createStore({seed:false,snapshot}),before=store.exportSnapshot();
  assert.equal(store.loadDay(planned).tasks[0].id,id);assert.deepEqual(store.exportSnapshot(),before);
  const removed=store.removeTask(planned,id);assert.equal(store.loadDay(planned).tasks.length,0);assert.equal(store.loadDay(start).tasks.length,1);
  store.restoreTask(planned,removed.task,removed.index);assert.throws(()=>store.restoreTask(planned,removed.task,removed.index),/already exists/);
  store.toggleTask(planned,id);assert.equal(store.loadDay(addDays(planned,1)).tasks.length,0);assert.equal(store.loadDay(start).tasks[0].done,false);
  validateSnapshot(store.exportSnapshot());
});

test('a planned task can move earlier or later without a stale future event bringing it back',()=>{
  const store=createStore({seed:false}),id=store.addTask(planned,'Future plan');
  store.editTask(planned,id,{name:'Moved earlier',date:start});
  assert.equal(store.loadDay(start).tasks[0].name,'Moved earlier');
  assert.equal(store.loadDay(planned).tasks[0].displayDate,start);
  store.editTask(start,id,{name:'Moved later',date:planned});
  assert.equal(store.loadDay(start).tasks.length,0);assert.equal(store.loadDay(planned).tasks[0].name,'Moved later');
  validateSnapshot(store.exportSnapshot());
});
