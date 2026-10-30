import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays} from '../prototype/model.mjs';
import {validateSnapshot,writeLocal,readLocal} from '../prototype/persistence.mjs';
import {snapshotRecords,recordsSnapshot} from '../prototype/cloud-records.mjs';
import {dailyRecap} from '../prototype/recap.mjs';
import {buildAchievements} from '../prototype/achievements.mjs';

const start='2026-10-26',next=addDays(start,1),later=addDays(start,3);
const fresh=()=>createStore({seed:false});
const due={dueDate:next,displayDate:null};
const task=(store,date=start)=>store.loadDay(date).tasks[0];

test('due-only tasks stay visible through overdue days and stop after completion',()=>{
  const s=fresh(),id=s.addTask(start,'Send application',due),before=s.exportSnapshot();
  assert.equal(s.loadDay(addDays(start,-1)).tasks.length,0);
  for(const date of [start,next,later,addDays(start,40)]){assert.equal(task(s,date).id,id);assert.equal(task(s,date).dueDate,next);assert.equal(s.loadDay(date).checklistTouched,false);}
  assert.deepEqual(s.exportSnapshot(),before,'viewing carryover dates does not save duplicate tasks or log days');
  s.toggleTask(later,id);assert.equal(task(s,later).done,true);assert.equal(task(s,next).done,false);assert.equal(s.loadDay(addDays(later,1)).tasks.length,0);
  assert.equal(s.exportSnapshot().days.flatMap(day=>day.tasks).length,1);validateSnapshot(s.exportSnapshot());
});

test('planned deadline tasks start on the planned day; tasks without expiration carry forward',()=>{
  const s=fresh();s.addTask(next,'Prepare notes',{dueDate:later,displayDate:next});
  assert.equal(s.loadDay(start).tasks.length,0);assert.equal(task(s,next).name,'Prepare notes');assert.equal(task(s,later).name,'Prepare notes');
  s.addTask(start,'Legacy');assert.equal(s.loadDay(next).tasks.some(task=>task.name==='Legacy'),true);
});

test('Any day without a deadline also stays visible until completed',()=>{
  const s=fresh(),id=s.addTask(start,'Read',{displayDate:null});assert.equal(task(s,later).id,id);
  s.toggleTask(later,id);assert.equal(s.loadDay(addDays(later,1)).tasks.length,0);
});

test('subtask checks, renames, deadlines and deletion retain their earlier dated history',()=>{
  const s=fresh(),id=s.addTask(start,'Application',{...due,children:['Write','Send']});
  const [write,send]=task(s).children;
  s.toggleTask(start,write.id);s.confirmSection(start,'checklists');
  s.editTask(next,id,{name:'Submit application',children:[{id:write.id,name:'Write'},{id:send.id,name:'Send'}],dueDate:later,displayDate:null});
  assert.equal(task(s,start).name,'Application');assert.equal(task(s,start).dueDate,next);assert.equal(s.loadDay(start).reviewed.checklists,true);
  assert.equal(task(s,next).children[0].done,true);
  s.toggleTask(later,send.id);assert.equal(task(s,later).done,true);assert.equal(task(s,next).done,false);assert.equal(task(s,next).children[1].done,false);
  const removed=s.removeTask(later,id);assert.equal(s.loadDay(later).tasks.length,0);assert.equal(task(s,next).name,'Submit application');
  s.restoreTask(later,removed.task,removed.index);assert.equal(task(s,later).done,true);validateSnapshot(s.exportSnapshot());
});

test('a task created outside the editable window can be completed and edited today',()=>{
  const s=fresh(),id=s.addTask(start,'Old deadline',due),today=addDays(start,20);
  const restored=createStore({seed:false,snapshot:s.exportSnapshot(),editableToday:()=>today});
  restored.editTask(today,id,{name:'Finish old deadline',displayDate:null,dueDate:next});restored.toggleTask(today,id);
  assert.equal(task(restored,today).done,true);assert.equal(task(restored,start).name,'Old deadline');assert.equal(restored.loadDay(addDays(today,1)).tasks.length,0);
});

test('ordinary logging never persists projections and backup plus cloud round trips retain all events',()=>{
  const s=fresh(),id=s.addTask(start,'Deadline',due);
  s.updateRating(next,7);s.confirmSection(next,'checklists');s.toggleTask(later,id);
  const snapshot=s.exportSnapshot();assert.equal(snapshot.days.find(day=>day.date===next).tasks.length,0);
  const storage=new Map(),adapter={setItem:(key,value)=>storage.set(key,value),getItem:key=>storage.get(key)??null};writeLocal(adapter,snapshot);
  for(const saved of [readLocal(adapter).snapshot,recordsSnapshot(snapshotRecords(snapshot))]){
    const restored=createStore({seed:false,snapshot:saved});
    for(const date of [start,next,later,addDays(later,1)])assert.deepEqual(restored.loadDay(date),s.loadDay(date));
  }
  assert.equal(dailyRecap(s.loadDay(next)).done,0);assert.equal(dailyRecap(s.loadDay(later)).done,1);
});

test('recurring deadlines follow each occurrence and occurrence versus future edits remain separate',()=>{
  const s=fresh();s.addTask(start,'Daily report',{dueDate:next,recurrence:{frequency:'daily',weekdays:[]}});
  assert.equal(task(s,next).dueDate,addDays(next,1));
  s.editTask(next,task(s,next).id,{name:'Special report',dueDate:later});assert.equal(task(s,next).dueDate,later);assert.equal(task(s,start).dueDate,next);
  s.editRoutine(later,task(s,later).id,{name:'Report',dueDate:later,children:[],recurrence:{frequency:'daily',weekdays:[]}});
  assert.equal(task(s,addDays(later,2)).dueDate,addDays(later,2));
  const restored=createStore({seed:false,snapshot:recordsSnapshot(snapshotRecords(s.exportSnapshot()))});assert.equal(task(restored,addDays(later,2)).dueDate,addDays(later,2));
});

test('invalid dates and out-of-window plans fail without modifying saved data',()=>{
  const s=createStore({seed:false,editableToday:()=>start});
  const id=s.addTask(start,'Deadline',due),before=s.exportSnapshot();
  for(const dates of [{dueDate:'2026-02-30'},{displayDate:'bad'},{dueDate:'tomorrow'},{displayDate:addDays(start,8)}]){
    assert.throws(()=>s.addTask(start,'Invalid',dates));assert.throws(()=>s.editTask(start,id,{name:'Invalid',...dates}));assert.deepEqual(s.exportSnapshot(),before);
  }
  s.addTask(start,'Long deadline',{dueDate:'2027-10-26',displayDate:null});
});

test('saving an unchanged carried task preserves its review and overdue plans remain editable',()=>{
  const s=fresh(),id=s.addTask(start,'Deadline',{dueDate:next,displayDate:start});
  s.confirmSection(start,'checklists');const before=s.exportSnapshot();
  s.editTask(start,id,{name:'Deadline',children:[],dueDate:next,displayDate:start});assert.deepEqual(s.exportSnapshot(),before);
  const today=addDays(start,20),restored=createStore({seed:false,snapshot:before,editableToday:()=>today});
  restored.editTask(today,id,{name:'Still pending',date:today,dueDate:next,displayDate:start});assert.equal(task(restored,today).name,'Still pending');assert.equal(task(restored,start).name,'Deadline');
});

test('task history rejects invalid event dates, dates in children and counter reuse after removed subtasks',()=>{
  const s=fresh(),id=s.addTask(start,'Deadline',{...due,children:['Keep','Remove']});
  s.editTask(next,id,{name:'Deadline',children:[{id:task(s).children[0].id,name:'Keep'}]});
  const snapshot=s.exportSnapshot();validateSnapshot(snapshot);
  const restored=recordsSnapshot(snapshotRecords(snapshot));assert.equal(restored.serial,snapshot.serial);
  for(const mutate of [value=>{value.days[0].tasks[0].taskEvents[0].date='bad';},value=>{value.days[0].tasks[0].taskEvents[0].value.children[0].dueDate=next;},value=>{value.serial=2;}]){
    const corrupt=structuredClone(snapshot);mutate(corrupt);assert.throws(()=>validateSnapshot(corrupt));
  }
});

test('carried checks earn action milestones once and changed future lists reopen their review',()=>{
  const s=fresh();s.setSettings({...s.getSettings(),tabs:{nutrition:false,training:false,checklists:true,sentiments:false,sleep:false,prayer:false}},start);
  const id=s.addTask(start,'Application',{...due,children:['Write','Send']});
  s.toggleTask(start,task(s).children[0].id);s.confirmSection(start,'checklists');s.completeDay(start);
  s.toggleTask(next,task(s,next).children[1].id);s.confirmSection(next,'checklists');s.completeDay(next);
  assert.equal(buildAchievements(s,next).cards.find(card=>card.id==='tasks-10').value,2);
  assert.equal(s.loadDay(start).reviewed.checklists,true);
  s.confirmSection(later,'checklists');
  s.toggleTask(next,task(s,next).children[1].id);
  assert.equal(s.loadDay(later).reviewed.checklists,false);
  assert.equal(s.loadDay(start).reviewed.checklists,true);
  assert.equal(task(s,next).id,id);
});

test('editing or moving other tasks and routines never saves a carried projection as a duplicate',()=>{
  const s=fresh();s.addTask(start,'Deadline',due);
  const ordinary=s.addTask(next,'Ordinary');s.editTask(next,ordinary,{name:'Renamed'});
  s.editTask(next,ordinary,{name:'Moved',date:later});
  s.addTask(next,'Daily',{recurrence:{frequency:'daily',weekdays:[]}});
  const routine=s.loadDay(next).tasks.find(task=>task.templateId);
  s.editRoutine(next,routine.id,{name:'New daily',children:[],recurrence:{frequency:'daily',weekdays:[]}});
  const snapshot=s.exportSnapshot();validateSnapshot(snapshot);
  assert.equal(snapshot.days.flatMap(day=>day.tasks).filter(task=>task.name==='Deadline').length,1);
  assert.equal(s.loadDay(later).tasks.find(task=>task.id===ordinary).name,'Moved');
  assert.equal(s.loadDay(later).tasks.filter(task=>task.name==='Deadline').length,1);
});
