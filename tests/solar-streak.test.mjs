import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays} from '../prototype/model.mjs';
import {newUserSettings} from '../prototype/customization.mjs';
import {leaderboardSummary,solarStreakText,solarMemberStreak} from '../prototype/social-model.mjs';
const today='2026-11-02';
function setup(){const settings=newUserSettings();for(const id of Object.keys(settings.tabs))settings.tabs[id]=id==='nutrition';return createStore({seed:false,today,settings});}
test('Solar consecutive logging streak crosses months and keeps yesterday until today is logged',()=>{
  const store=setup();for(let offset=1;offset<=5;offset++)store.updateRating(addDays(today,-offset),8);
  assert.equal(leaderboardSummary(store,today).consecutiveStreak,5);assert.equal(leaderboardSummary(store,today).streakEndDate,addDays(today,-1));
  store.updateRating(today,0);store.updateRating(addDays(today,1),10);
  const before=store.exportSnapshot(),summary=leaderboardSummary(store,today);
  assert.equal(summary.consecutiveStreak,6);assert.equal(summary.streakEndDate,today);assert.equal(summary.daysLogged,2);assert.equal(summary.totalDaysLogged,6);assert.deepEqual(store.exportSnapshot(),before);
  assert.equal(solarStreakText(summary,today),'6 day consecutive streak!');
});
test('missing days break streaks and backdated logging recalculates the count',()=>{
  const store=setup();for(const offset of [0,1,3,4])store.updateRating(addDays(today,-offset),8);
  assert.equal(leaderboardSummary(store,today).consecutiveStreak,2);
  store.updateRating(addDays(today,-2),8);assert.equal(leaderboardSummary(store,today).consecutiveStreak,5);
  assert.equal(leaderboardSummary(store,addDays(today,2)).consecutiveStreak,0);
});
test('Solar streak label starts at three and hides stale, future and legacy values',()=>{
  for(const count of [0,1,2])assert.equal(solarStreakText({consecutiveStreak:count,streakEndDate:today},today),'');
  assert.equal(solarStreakText({consecutiveStreak:3,streakEndDate:today},today),'3 day consecutive streak!');
  for(const end of [addDays(today,-2),addDays(today,1),null])assert.equal(solarStreakText({consecutiveStreak:5,streakEndDate:end},today),'');
  assert.equal(solarStreakText({},today),'');
});
test('every member can derive a streak from shared days before publishing the new summary fields',()=>{
  const days=[];for(let offset=0;offset<7;offset++)days.push({uid:'friend',date:addDays(today,-offset),score:0});
  days.push({uid:'other',date:today,score:9},{uid:'friend',date:addDays(today,1),score:10});
  const friend=solarMemberStreak({uid:'friend'},days,today);assert.equal(friend.consecutiveStreak,7);assert.equal(solarStreakText(friend,today),'7 day consecutive streak!');
  assert.equal(solarMemberStreak({uid:'other'},days,today).consecutiveStreak,1);
  assert.equal(solarMemberStreak({uid:'friend',consecutiveStreak:70,streakEndDate:today},days,today).consecutiveStreak,70);
});
