import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../prototype/app.mjs',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('let completingDay=false;'),source.indexOf('function updateFinalSentiments('));
function confirmation({member=true,ready=true,vibes='',save=async()=>{}}={}){
  const nodes=new Map(),calls=[];
  const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{value:'',textContent:'',disabled:false,focus(){calls.push('focus');},addEventListener(type,fn){this.click=fn;}});return nodes.get(selector);};
  $('#final-vibes-input').value=vibes;
  const context={$,socialUI:{requiresVibes:()=>member,loggingReady:()=>ready,saveVibes:async value=>{calls.push(['save',value]);await save();}},store:{completeDay(){calls.push('complete');}},selectedDate:'2026-10-29',editableToday:()=> '2026-10-29',buildAchievements:()=>[],firstAchievementUnlocks:()=>[],achievementNotified:new Set(),preferences:{},preferencesKey:'preview',localStorage:{setItem(){}},renderFinalSentimentsState(){},render(){},closeDialog(){},setView(){},announce(){},celebrateDayCompletion(){},queueAchievementCelebration(){},shortDate:String};
  vm.createContext(context);vm.runInContext(handler,context);
  return {$,calls,click:()=>$('#submit-day').click()};
}

test('Solar System logging rejects blank vibes and waits for profile membership to load',async()=>{
  const blank=confirmation({vibes:'   '});await blank.click();assert.equal(blank.calls.includes('complete'),false);assert.match(blank.$('#final-vibes-error').textContent,/Write your current vibes/);
  const loading=confirmation({ready:false,vibes:'A good day'});await loading.click();assert.deepEqual(loading.calls,[]);
});

test('a failed vibes save keeps the day open and reports the error',async()=>{
  const check=confirmation({vibes:'A good day',save:async()=>{throw new Error('Offline. Try again.');}});await check.click();
  assert.equal(check.calls.includes('complete'),false);assert.equal(check.$('#final-vibes-error').textContent,'Offline. Try again.');
});

test('logging waits for vibes persistence and ignores a second confirmation while saving',async()=>{
  let release;const saving=new Promise(resolve=>{release=resolve;});
  const check=confirmation({vibes:'A good day',save:()=>saving}),pending=check.click();
  await check.click();assert.equal(check.calls.length,1);assert.equal(check.calls.includes('complete'),false);
  release();await pending;assert.deepEqual(check.calls,[['save','A good day'],'complete']);
});

test('someone outside a Solar System can complete a day without shared vibes',async()=>{
  const check=confirmation({member:false});await check.click();assert.deepEqual(check.calls,['complete']);
});
