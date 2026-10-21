import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {addDays} from '../prototype/model.mjs';

// Exercise the real partial and full render paths without loading cloud services.
const app=await readFile(new URL('../prototype/app.mjs',import.meta.url),'utf8');
const functions=['renderHeader','renderTasks'].map(name=>app.slice(app.indexOf(`function ${name}() {`),app.indexOf('\nfunction ',app.indexOf(`function ${name}() {`)+1))).join('\n');
function screen(selected='2026-10-21',today=selected){
  const nodes=new Map();
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',style:{},classList:{toggle(){}},setAttribute(){}});return nodes.get(selector);};
  const context={
    $:node,$$:()=>[],document:{body:{classList:{toggle(){}}}},view:'checklists',selectedDate:selected,reviewSessionDate:selected,
    archivedDay:()=>false,renderHeaderShortcuts(){},appDateKey:()=>context.today,today,
    timeGreeting:()=> 'Good evening',displayName:'Test',escapeHtml:String,
    longDate:date=>`Full date ${date}`,shortDate:date=>`Short date ${date}`,dateFormat:date=>date,
    viewLabels:{checklists:'To-do list'},panelIds:{checklists:'checklists-view'},
    store:{loadDay:()=>({tasks:[],completedAt:null}),loadTemplates:()=>[]},
    taskProgress:()=>({done:0,total:0}),orderedTasks:tasks=>tasks,activeTemplates:()=>[],scoreColor:()=> '#101f40',addDays,
  };
  vm.createContext(context);vm.runInContext(functions,context);
  return {context,node,header:()=>vm.runInContext('renderHeader()',context),tasks:()=>vm.runInContext('renderTasks()',context)};
}

test('today to-do heading survives full and partial daily-review renders',()=>{
  const ui=screen();
  ui.header();ui.tasks();
  assert.equal(ui.node('#tasks-title').textContent,'TODAY');
  ui.header(); // Nutrition/Sentiments changes update the header without rendering tasks.
  assert.equal(ui.node('#tasks-title').textContent,'TODAY');
  ui.tasks();assert.equal(ui.node('#tasks-title').textContent,'TODAY');
  assert.equal(ui.node('#tasks-date').textContent,'Full date 2026-10-21');
});

test('reviewing another date retains the to-do label and puts its date above it',()=>{
  const ui=screen('2026-10-20','2026-10-21');
  for(const render of [ui.header,ui.tasks,ui.header,ui.tasks]){
    render();assert.equal(ui.node('#tasks-title').textContent,'TO-DO LIST');
    assert.equal(ui.node('#tasks-date').textContent,'Full date 2026-10-20');
  }
});

test('a review retained across the app-day boundary never replaces the heading with a date',()=>{
  const ui=screen('2026-10-20');ui.header();ui.tasks();
  ui.context.today='2026-10-21';ui.header();ui.tasks();
  assert.equal(ui.context.selectedDate,'2026-10-20');
  assert.equal(ui.node('#tasks-title').textContent,'TO-DO LIST');
  assert.equal(ui.node('#tasks-date').textContent,'Full date 2026-10-20');
});
