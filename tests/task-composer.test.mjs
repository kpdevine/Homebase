import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../prototype/app.mjs',import.meta.url),'utf8');
const start=source.indexOf('function renderTaskDate() {');
const render=source.slice(start,source.indexOf('\nfunction ',start+1));
function composer(due,planned='',taskEdit=null){
  const nodes=new Map();
  const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{value:'',hidden:false,disabled:false,textContent:''});return nodes.get(selector);};
  $('#task-due-date').value=due;$('#task-date').value=planned;
  const context={$,editableToday:()=> '2026-10-26',selectedDate:'2026-10-26',taskEdit,longDate:String};
  vm.createContext(context);vm.runInContext(render+'\nrenderTaskDate();',context);
  return {$,context};
}

test('a due date of today hides and clears the optional planned date',()=>{
  const {$,context}=composer('2026-10-26','2026-10-28');
  assert.equal($('.task-date-picker').hidden,true);assert.equal($('#task-date').disabled,true);assert.equal($('#task-date').value,'');assert.equal(context.taskComposeDate,'2026-10-26');
});
test('another due date reveals an optional calendar and blank planning keeps the task available now',()=>{
  const {$,context}=composer('2026-10-30');
  assert.equal($('.task-date-picker').hidden,false);assert.equal($('#task-date').disabled,false);assert.equal($('#task-date').value,'');assert.equal(context.taskComposeDate,'2026-10-26');
  const planned=composer('2026-10-30','2026-10-28');assert.equal(planned.context.taskComposeDate,'2026-10-28');
});
test('clearing the required deadline hides planning and recurring occurrence dates remain fixed',()=>{
  assert.equal(composer('').$('.task-date-picker').hidden,true);
  const {$,context}=composer('2026-10-30','2026-10-28',{templateId:'routine-1',date:'2026-10-27'});
  assert.equal($('.task-date-picker').hidden,true);assert.equal(context.taskComposeDate,'2026-10-27');
});
