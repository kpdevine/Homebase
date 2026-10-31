import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays} from '../prototype/model.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {snapshotRecords,recordsSnapshot} from '../prototype/cloud-records.mjs';
const monday='2026-10-12',tuesday=addDays(monday,1),wednesday=addDays(monday,2);
const fresh=()=>createStore({seed:false});
const changes=task=>({name:task.name,children:task.children.map(({id,name})=>({id,name}))});
const daily={frequency:'daily',weekdays:[]};

test('editing task names and subtasks preserves completed actions and reopens only the list review',()=>{
  const s=fresh(),id=s.addTask(monday,'Bedtime',{children:['Teeth','Shower']});let task=s.loadDay(monday).tasks[0];
  s.toggleTask(monday,task.children[0].id);s.confirmSection(monday,'checklists');
  task=s.loadDay(monday).tasks[0];s.editTask(monday,id,{name:'Get ready for bed',children:[{id:task.children[0].id,name:'Brush teeth'},{name:'Read'}]});
  const edited=s.loadDay(monday);assert.equal(edited.tasks[0].children[0].done,true);assert.equal(edited.tasks[0].children[1].done,false);assert.equal(edited.tasks[0].done,false);assert.equal(edited.reviewed.checklists,false);
  s.editTask(monday,id,{name:'Bedtime',children:[{id:task.children[0].id,name:'Brush teeth'}]});assert.equal(s.loadDay(monday).tasks[0].done,true);validateSnapshot(s.exportSnapshot());
});
test('changing the plan for a completed task preserves its actual completion day',()=>{
  const s=fresh(),id=s.addTask(monday,'Read');s.toggleTask(monday,id);const task=s.loadDay(monday).tasks[0];
  s.editTask(monday,id,{...changes(task),date:tuesday});assert.equal(s.loadDay(monday).tasks[0].id,id);assert.equal(s.loadDay(monday).tasks[0].done,true);assert.equal(s.loadDay(tuesday).tasks.length,0);assert.equal(s.loadDay(tuesday).checklistTouched,false);validateSnapshot(s.exportSnapshot());
});
test('one-day recurring edits do not change the routine or other occurrences',()=>{
  const s=fresh();s.addTask(monday,'Bedtime',{children:['Teeth'],recurrence:daily});const task=s.loadDay(tuesday).tasks[0],before=s.loadTemplates();
  s.editTask(tuesday,task.id,{name:'Early bedtime',children:[]});assert.equal(s.loadDay(tuesday).tasks[0].name,'Early bedtime');assert.equal(s.loadDay(monday).tasks[0].name,'Bedtime');assert.equal(s.loadDay(wednesday).tasks[0].name,'Bedtime');assert.deepEqual(s.loadTemplates(),before);validateSnapshot(s.exportSnapshot());
});
test('future routine edits version the schedule and preserve earlier history and retained checks',()=>{
  const s=fresh();s.addTask(monday,'Routine',{children:['Teeth','Shower'],recurrence:daily});const earlier=s.loadDay(monday);
  const task=s.loadDay(tuesday).tasks[0],future=s.loadDay(wednesday).tasks[0];s.toggleTask(wednesday,future.children[0].id);s.confirmSection(wednesday,'checklists');
  s.editRoutine(tuesday,task.id,{name:'Evening routine',children:[{id:task.children[0].id,name:'Brush teeth'},{name:'Read'}],recurrence:daily});
  assert.deepEqual(s.loadDay(monday),earlier);const next=s.loadDay(wednesday);assert.equal(next.tasks[0].name,'Evening routine');assert.equal(next.tasks[0].children[0].done,true);assert.equal(next.tasks[0].children[1].done,false);assert.equal(next.reviewed.checklists,false);assert.equal(s.loadDay(addDays(monday,5)).tasks[0].name,'Evening routine');
  const restored=createStore({seed:false,snapshot:recordsSnapshot(snapshotRecords(s.exportSnapshot()))});assert.deepEqual(restored.loadDay(wednesday),next);validateSnapshot(s.exportSnapshot());
});
test('frequency edits remove no-longer-due future occurrences and preserve skipped days',()=>{
  const s=fresh();s.addTask(monday,'Daily',{recurrence:daily});s.updateRating(wednesday,8);const task=s.loadDay(tuesday).tasks[0];s.removeTask(addDays(tuesday,2),s.loadDay(addDays(tuesday,2)).tasks[0].id);
  s.editRoutine(tuesday,task.id,{name:'Tue/Thu',children:[],recurrence:{frequency:'custom',weekdays:[2,4]}});
  assert.equal(s.loadDay(wednesday).tasks.length,0);assert.equal(s.loadDay(wednesday).nutrition,8);assert.equal(s.loadDay(addDays(tuesday,2)).tasks.length,0);assert.equal(s.loadDay(addDays(tuesday,7)).tasks[0].name,'Tue/Thu');validateSnapshot(s.exportSnapshot());
});
test('invalid edits are atomic and archived source/destination dates stay protected',()=>{
  const s=fresh(),id=s.addTask(monday,'Task',{children:['One']});const before=s.exportSnapshot();
  for(const patch of [{name:''},{name:'Task',children:[{id:'missing',name:'X'}]},{name:'Task',date:'bad'}]){assert.throws(()=>s.editTask(monday,id,patch));assert.deepEqual(s.exportSnapshot(),before);}
  const locked=createStore({seed:false,snapshot:before,editableToday:()=>addDays(monday,8)});assert.throws(()=>locked.editTask(monday,id,{name:'No'}));
  const current=locked.addTask(tuesday,'Current');assert.throws(()=>locked.editTask(tuesday,current,{name:'Move',date:monday}));
});
test('saving an unchanged task retains its review and editing alone never logs a list',()=>{
  const s=fresh(),id=s.addTask(monday,'Read');const task=s.loadDay(monday).tasks[0];s.editTask(monday,id,{name:'Read more'});assert.equal(s.loadDay(monday).checklistTouched,false);
  s.confirmSection(monday,'checklists');s.editTask(monday,id,{name:'Read more',children:[]});assert.equal(s.loadDay(monday).reviewed.checklists,true);
});

test('personal task planning and moving allow seven days ahead but reject an eighth atomically',()=>{
  const s=createStore({seed:false,editableToday:()=>monday}),last=addDays(monday,7),beyond=addDays(monday,8);
  const id=s.addTask(last,'Next Monday');assert.equal(s.loadDay(last).tasks[0].name,'Next Monday');
  const before=s.exportSnapshot();assert.throws(()=>s.addTask(beyond,'Too far'));assert.throws(()=>s.editTask(last,id,{name:'Move too far',date:beyond}));assert.deepEqual(s.exportSnapshot(),before);
  s.addTask(monday,'Daily',{recurrence:daily});assert.ok(s.loadDay(addDays(monday,30)).tasks.some(task=>task.name==='Daily'),'recurring schedules continue beyond the planning window');
});
