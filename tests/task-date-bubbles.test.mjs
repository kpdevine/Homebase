import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createStore} from '../prototype/model.mjs';
import {dailyRecap} from '../prototype/recap.mjs';

const source=await readFile(new URL('../prototype/app.mjs',import.meta.url),'utf8');
const functions=['taskDueBubble','taskDateBubbles'].map(name=>{
  const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\nfunction ',start+1));
}).join('\n');
const ui={dateFormat:date=>date,longDate:date=>date};vm.createContext(ui);vm.runInContext(functions,ui);
const bubbles=task=>ui.taskDateBubbles(task,'2026-10-27');

test('due and planned work dates have separate labeled bubbles and absent plans add no bubble',()=>{
  const markup=bubbles({dueDate:'2026-10-30',displayDate:'2026-10-28',done:false});
  assert.match(markup,/task-due-bubble/);assert.match(markup,/task-plan-bubble/);assert.match(markup,/>Due 2026-10-30</);assert.match(markup,/>Plan 2026-10-28</);
  assert.doesNotMatch(bubbles({dueDate:'2026-10-30',displayDate:null}),/task-plan-bubble/);
});
test('past due and planned dates get the overdue state only while unfinished',()=>{
  const task={dueDate:'2026-10-26',displayDate:'2026-10-25',done:false};
  assert.equal((bubbles(task).match(/class="[^"]*is-overdue/g)||[]).length,2);
  assert.doesNotMatch(bubbles({...task,done:true}),/is-overdue/);
  const planLate=bubbles({...task,dueDate:'2026-10-30'});
  assert.match(planLate,/task-plan-bubble is-overdue/);assert.doesNotMatch(planLate,/task-due-bubble is-overdue/);
});
test('dates equal to today are not overdue and recaps retain the planned work date',()=>{
  assert.doesNotMatch(bubbles({dueDate:'2026-10-27',displayDate:'2026-10-27'}),/is-overdue/);
  const store=createStore({seed:false});store.addTask('2026-10-27','Write outline',{dueDate:'2026-10-30',displayDate:'2026-10-27'});
  const recap=dailyRecap(store.loadDay('2026-10-27'));assert.equal(recap.tasks[0].displayDate,'2026-10-27');assert.equal(recap.tasks[0].dueDate,'2026-10-30');
});
