import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../prototype/model.mjs';
import {solarDisplayedDay,sharedDays} from '../prototype/social-model.mjs';
import {watchSolarDateWindow} from '../prototype/solar-date-window.mjs';

const today='2026-10-25',yesterday='2026-10-24';
const member={yesterdayDate:yesterday,yesterdayScore:7.5,todayDate:today,todayScore:9};
test('the main rating stays on yesterday until the whole review is completed',()=>{
  for(const flag of [undefined,false,null])assert.deepEqual(solarDisplayedDay({...member,todayReviewComplete:flag},today),{date:yesterday,label:'Yesterday',score:7.5});
  assert.deepEqual(solarDisplayedDay({...member,todayReviewComplete:true},today),{date:today,label:'Today',score:9});
  assert.equal(solarDisplayedDay({...member,todayScore:0,todayReviewComplete:true},today).score,0);
  assert.equal(solarDisplayedDay({...member,yesterdayScore:0},today).score,0);
});
test('reopening a review falls back and stale completion cannot carry past midnight',()=>{
  const row={...member,todayReviewComplete:true};
  assert.equal(solarDisplayedDay(row,today).label,'Today');
  row.todayReviewComplete=false;assert.equal(solarDisplayedDay(row,today).label,'Yesterday');
  row.todayReviewComplete=true;
  assert.deepEqual(solarDisplayedDay(row,'2026-10-26'),{date:today,label:'Yesterday',score:null});
  assert.deepEqual(solarDisplayedDay({},'2027-01-01'),{date:'2026-12-31',label:'Yesterday',score:null});
});
test('fully logged shared scores carry only a completion boolean and update when review changes',()=>{
  const store=createStore({seed:false});store.updateRating(today,0);store.setTrainingMode(today,'rest');store.confirmSection(today,'checklists');
  const initial=sharedDays(store,today).find(day=>day.date===today);
  assert.equal(initial.reviewComplete,false);
  for(const section of ['nutrition','training','sentiments'])store.confirmSection(today,section);
  store.completeDay(today);
  const completed=sharedDays(store,today).find(day=>day.date===today);
  assert.equal(completed.reviewComplete,true);assert.equal(completed.score,initial.score);
  assert.deepEqual(Object.keys(completed).sort(),['date','reviewComplete','score']);
  store.updateNotes(today,'nutrition','Reopened');
  assert.equal(sharedDays(store,today).find(day=>day.date===today).reviewComplete,false);
});
test('date and reaction listeners cover both days and reject callbacks after cleanup',()=>{
  const subscriptions=[],updates=[],errors=[];
  const subscribe=kind=>(group,date,receive,error)=>{const item={kind,group,date,receive,error,stopped:false};subscriptions.push(item);return ()=>item.stopped=true;};
  const api={watchToday:subscribe('days'),watchReactions:subscribe('reactions')};
  const stop=watchSolarDateWindow(api,'system',today,{days:(date,rows)=>updates.push({kind:'days',date,rows}),reactions:(date,rows)=>updates.push({kind:'reactions',date,rows}),error:e=>errors.push(e)});
  assert.deepEqual(subscriptions.map(({kind,date})=>({kind,date})),[{kind:'days',date:yesterday},{kind:'reactions',date:yesterday},{kind:'days',date:today},{kind:'reactions',date:today}]);
  subscriptions[2].receive([{uid:'a',score:9,reviewComplete:true}]);subscriptions[3].receive([{target:'a',date:today,kind:'fire'}]);
  assert.equal(updates[0].date,today);assert.equal(updates[1].date,today);
  stop();assert.ok(subscriptions.every(item=>item.stopped));
  subscriptions[2].receive([]);subscriptions[0].error(new Error('stale'));
  assert.equal(updates.length,2);assert.equal(errors.length,0);
});
