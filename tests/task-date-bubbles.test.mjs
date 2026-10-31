import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createStore} from '../prototype/model.mjs';
import {dailyRecap} from '../prototype/recap.mjs';

const source=await readFile(new URL('../prototype/app.mjs',import.meta.url),'utf8');
const functions=['taskDateBubbles'].map(name=>{
  const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\nfunction ',start+1));
}).join('\n');
const ui={dateFormat:date=>date,longDate:date=>date};vm.createContext(ui);vm.runInContext(functions,ui);
const bubbles=task=>ui.taskDateBubbles(task,'2026-10-27');

test('one plan-to-do-by bubble replaces separate deadline and planning labels',()=>{
  const markup=bubbles({dueDate:'2026-10-30',displayDate:'2026-10-28',done:false});
  assert.match(markup,/>Plan to do by 2026-10-28</);assert.doesNotMatch(markup,/task-due-bubble/);
  assert.match(bubbles({dueDate:'2026-10-30',displayDate:null}),/>Plan to do by 2026-10-30</);
});
test('unfinished plans show only Overdue after the planned day',()=>{
  const task={displayDate:'2026-10-26',done:false};
  assert.match(bubbles(task),/is-overdue/);assert.match(bubbles(task),/>Overdue</);
  assert.doesNotMatch(bubbles({...task,done:true}),/is-overdue|>Overdue</);
});

test('dates equal to today are not overdue and recaps retain the planned work date',()=>{
  assert.doesNotMatch(bubbles({dueDate:'2026-10-27',displayDate:'2026-10-27'}),/is-overdue/);
  const store=createStore({seed:false});store.addTask('2026-10-27','Write outline',{dueDate:'2026-10-30',displayDate:'2026-10-27'});
  const recap=dailyRecap(store.loadDay('2026-10-27'));assert.equal(recap.tasks[0].displayDate,'2026-10-27');assert.equal(recap.tasks[0].dueDate,'2026-10-30');
});

test('legacy dated tasks show their assigned day as a plan without inventing a deadline',()=>{
  const store=createStore({seed:false});store.addTask('2026-10-29','Existing task');
  const snapshot=store.exportSnapshot();delete snapshot.days[0].tasks[0].taskEvents;delete snapshot.days[0].tasks[0].dueDate;delete snapshot.days[0].tasks[0].displayDate;
  const restored=createStore({seed:false,snapshot}),before=restored.exportSnapshot(),task=restored.loadDay('2026-10-29').tasks[0];
  const markup=ui.taskDateBubbles(task,'2026-10-29','2026-10-29');
  assert.match(markup,/>Plan to do by 2026-10-29</);assert.doesNotMatch(markup,/task-due-bubble/);
  assert.equal(dailyRecap(restored.loadDay('2026-10-29')).tasks[0].displayDate,'2026-10-29');
  assert.deepEqual(restored.exportSnapshot(),before);
});

test('old recurring routines and future planning cards show the occurrence date',()=>{
  const store=createStore({seed:false});store.addTask('2026-10-29','Existing routine',{recurrence:{frequency:'daily',weekdays:[]}});
  const before=store.exportSnapshot(),occurrence=store.loadDay('2026-10-30').tasks[0];
  const markup=ui.taskDateBubbles(occurrence,'2026-10-29','2026-10-30');
  assert.match(markup,/>Plan to do by 2026-10-30</);assert.doesNotMatch(markup,/is-overdue|task-due-bubble/);
  assert.deepEqual(store.exportSnapshot(),before);
});

test('legacy deadlines provide the plan-by label while stored dates remain compatible',()=>{
  const store=createStore({seed:false});store.addTask('2026-10-29','Deadline only',{dueDate:'2026-10-30',displayDate:null,children:['One']});
  const task=store.loadDay('2026-10-29').tasks[0],recap=dailyRecap(store.loadDay('2026-10-29')).tasks[0];
  for(const value of [task,recap]){
    assert.equal(value.displayDate,null);
    assert.match(ui.taskDateBubbles(value,'2026-10-29','2026-10-29'),/>Plan to do by 2026-10-30</);
  }
  assert.equal(recap.children[0].displayDate,undefined);
});
