import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays,GROUPS} from '../prototype/model.mjs';
import {buildAchievements,streakStats} from '../prototype/achievements.mjs';
import {recordsSnapshot,snapshotRecords} from '../prototype/cloud-records.mjs';
import {achievementIcon,achievementIconIds} from '../prototype/achievement-icons.mjs';

const monday='2026-10-12',sunday='2026-10-18';
const badge=(result,id)=>result.cards.find(card=>card.id===id);
function fresh() {
  const store=createStore({seed:false});
  store.setWeekTargets(monday,GROUPS.map(group=>({id:group.id,target:group.id==='chest'?20:0})));
  return store;
}
function finish(store,date,{nutrition=10,sets=0,notes='',sentiment=null}={}) {
  store.updateRating(date,nutrition);
  if(sets)store.addGymEntry(date,'chest',sets);else store.setTrainingMode(date,'rest');
  if(notes||sentiment!==null)store.updateSentiments(date,{notes,rating:sentiment});
  for(const section of store.dayProgress(date).sections)store.confirmSection(date,section.id);
  store.completeDay(date);
}

test('score achievements require completed reviews and use recorded rather than optimistic scores',()=>{
  const store=fresh();store.updateRating(monday,10);store.setTrainingMode(monday,'rest');
  store.addTask(monday,'Still unfinished');
  assert.equal(buildAchievements(store,monday).unlocked,0);
  for(const section of store.dayProgress(monday).sections)store.confirmSection(monday,section.id);
  store.completeDay(monday);
  const result=buildAchievements(store,monday);
  assert.equal(badge(result,'completed-1').count,1);
  assert.equal(badge(result,'overall-10').count,0);
  assert.equal(badge(result,'nutrition-10').count,1);
  assert.equal(badge(result,'tasks-perfect').count,0);
});

test('threshold badges repeat per qualifying day, preserve latest dates, and never duplicate on reading',()=>{
  const store=fresh();finish(store,monday);finish(store,addDays(monday,1),{nutrition:9});
  const before=store.exportSnapshot(),first=buildAchievements(store,sunday),second=buildAchievements(store,sunday);
  assert.equal(badge(first,'overall-9').count,2);
  assert.equal(badge(first,'overall-10').count,1);
  assert.equal(badge(first,'nutrition-9').latest,addDays(monday,1));
  assert.deepEqual(first,second);assert.deepEqual(store.exportSnapshot(),before);
  assert.equal(first.total,49);
});

test('gym score badges exclude perfect rest and attendance-only days',()=>{
  const store=fresh();finish(store,monday);
  const tuesday=addDays(monday,1);store.setTrainingMode(tuesday,'training');store.updateRating(tuesday,10);
  for(const section of store.dayProgress(tuesday).sections)store.confirmSection(tuesday,section.id);store.completeDay(tuesday);
  finish(store,addDays(monday,2),{sets:4});
  const result=buildAchievements(store,sunday);
  assert.equal(badge(result,'training-10').count,1);
  assert.equal(badge(result,'training-9').count,1);
  assert.equal(badge(result,'goal-sets-100').value,4);
});

test('streaks handle gaps, yesterday grace, future records and repeat only for full blocks',()=>{
  const dates=Array.from({length:14},(_,index)=>addDays(monday,index));
  assert.deepEqual(streakStats([...dates,dates[0]],addDays(monday,14),7),{current:14,best:14,count:2,latest:addDays(monday,13),includesToday:false});
  assert.equal(streakStats(dates,addDays(monday,15),7).current,0);
  assert.equal(streakStats(dates,addDays(monday,6),7).count,1);
  const gap=[monday,addDays(monday,1),addDays(monday,3),addDays(monday,4),addDays(monday,5)];
  assert.equal(streakStats(gap,addDays(monday,5),3).count,1);
  assert.equal(streakStats(gap,addDays(monday,5),3).best,3);
});

test('streaks only track logged days and completed 9+ days; future days never award early',()=>{
  const store=fresh();
  for(let index=0;index<8;index++) {
    const date=addDays(monday,index);store.updateRating(date,10);store.setTrainingMode(date,'rest');store.confirmSection(date,'checklists');
  }
  let result=buildAchievements(store,sunday);
  assert.deepEqual(Object.keys(result.streaks),['logging','strong']);
  assert.equal(result.streaks.logging.current,7);assert.equal(result.streaks.strong.current,0);
  assert.ok(result.cards.filter(card=>card.group==='streaks').every(card=>/^streak-(logging|strong)-/.test(card.id)));
  assert.equal(badge(result,'streak-logging-7').count,1);
  finish(store,addDays(monday,7));
  result=buildAchievements(store,sunday);assert.equal(result.completed,0);assert.equal(badge(result,'completed-1').count,0);
});

test('weekly badges use Monday–Sunday, active goals, finalized sets, and no extra-set credit',()=>{
  const store=fresh();store.addGymEntry(monday,'chest',25);store.updateRating(monday,10);
  assert.equal(badge(buildAchievements(store,sunday),'weekly-goals').count,0);
  for(const section of store.dayProgress(monday).sections)store.confirmSection(monday,section.id);store.completeDay(monday);
  for(let index=1;index<5;index++)finish(store,addDays(monday,index));
  const result=buildAchievements(store,sunday);
  assert.equal(badge(result,'weekly-goals').count,1);assert.equal(badge(result,'weekly-goals').latest,monday);
  assert.equal(badge(result,'weekly-five').count,1);assert.equal(badge(result,'weekly-five').latest,addDays(monday,4));
  assert.equal(badge(result,'goal-sets-100').value,20);
  finish(store,addDays(monday,6));finish(store,addDays(monday,7));
  assert.equal(badge(buildAchievements(store,addDays(monday,7)),'weekly-five').count,1);
});

test('task actions count children once, empty lists do not award perfect-task days, and notes need no rating',()=>{
  const store=fresh(),id=store.addTask(monday,'Bedtime',{children:['Teeth','Shower']});
  for(const child of store.loadDay(monday).tasks.find(task=>task.id===id).children)store.toggleTask(monday,child.id);
  finish(store,monday,{notes:'A good evening.'});finish(store,addDays(monday,1));
  const result=buildAchievements(store,sunday);
  assert.equal(badge(result,'tasks-100').value,2);assert.equal(badge(result,'tasks-perfect').count,1);
  assert.equal(badge(result,'journal-day').count,1);assert.equal(badge(result,'sentiments-9').count,0);
});

test('history edits, cloud round-trips and resets recalculate awards without storing an unlock ledger',()=>{
  const store=fresh();finish(store,monday,{sets:4});
  const original=buildAchievements(store,sunday);
  const restored=createStore({seed:false,snapshot:recordsSnapshot(snapshotRecords(store.exportSnapshot()))});
  assert.deepEqual(buildAchievements(restored,sunday),original);
  restored.updateRating(monday,8);
  assert.equal(badge(buildAchievements(restored,sunday),'overall-10').count,0);
  assert.equal(buildAchievements(restored,sunday).completed,0);
  for(const section of restored.dayProgress(monday).sections)restored.confirmSection(monday,section.id);restored.completeDay(monday);
  assert.equal(badge(buildAchievements(restored,sunday),'nutrition-9').count,0);
  assert.equal(badge(buildAchievements(restored,sunday),'completed-1').count,1);
  assert.equal(buildAchievements(createStore({seed:false}),sunday).earned,0);
});

test('every achievement has its own distinct accessible decorative icon',()=>{
  const cards=buildAchievements(fresh(),sunday).cards;
  assert.deepEqual(new Set(achievementIconIds),new Set(cards.map(card=>card.id)));
  const icons=cards.map(card=>achievementIcon(card.id));
  assert.equal(new Set(icons).size,cards.length);
  assert.ok(icons.every(svg=>svg.includes('aria-hidden="true"')&&svg.includes('viewBox="0 0 32 32"')));
});

test('expanded milestones distinguish 9.5 scores and unlock longer logging and journal runs',()=>{
  const store=fresh();
  for(let index=0;index<14;index++)finish(store,addDays(monday,index),{nutrition:index===0?9.4:9.5,notes:'Daily chapter'});
  const result=buildAchievements(store,addDays(monday,13));
  assert.equal(badge(result,'completed-14').count,1);
  assert.equal(badge(result,'completed-60').count,0);
  assert.equal(badge(result,'nutrition-9.5').count,13);
  assert.equal(badge(result,'nutrition-8').count,14);
  assert.equal(badge(result,'journal-3').count,1);
  assert.equal(badge(result,'journal-30').count,0);
  assert.equal(badge(result,'streak-logging-14').count,1);
});

test('9+ streaks require consecutive completed days at the threshold and recalculate after edits',()=>{
  const store=fresh();
  for(let index=0;index<3;index++)finish(store,addDays(monday,index),{nutrition:7,sets:4});
  let result=buildAchievements(store,addDays(monday,2));
  assert.equal(result.streaks.strong.current,3);
  assert.equal(badge(result,'streak-strong-3').count,1);
  finish(store,addDays(monday,3),{nutrition:6,sets:4});
  result=buildAchievements(store,addDays(monday,3));
  assert.equal(result.streaks.logging.current,4);
  assert.equal(result.streaks.strong.best,3);
  assert.equal(result.streaks.strong.includesToday,false);
  store.updateRating(addDays(monday,1),6);
  result=buildAchievements(store,addDays(monday,3));
  assert.equal(result.streaks.logging.current,4);
  assert.equal(badge(result,'streak-strong-3').count,0);
});
