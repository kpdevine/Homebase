import test from 'node:test';
import assert from 'node:assert/strict';
import {profileDetails} from '../prototype/profile-data.mjs';

const identity={uid:'person',username:'current_name'},today='2026-10-30';
test('profile data uses the freshest authorized records while preserving current identity',()=>{
  const row=profileDetails(identity,[
    {uid:'person',username:'old_name',updatedAt:{seconds:1},month:'2026-10',monthScore:4,planet:'happy',vibes:'Old copy'},
    {uid:'person',updatedAt:{seconds:2},month:'2026-10',monthScore:8.4,totalDaysLogged:51,planet:'strong',vibes:'Current shared vibes',notes:'private'}
  ],today);
  assert.equal(row.username,'current_name');assert.equal(row.monthScore,8.4);assert.equal(row.totalDaysLogged,51);assert.equal(row.planet,'strong');assert.equal(row.vibes,'Current shared vibes');assert.equal(row.notes,undefined);
});
test('a newer score-only record does not erase the shared appearance',()=>{
  const row=profileDetails(identity,[{uid:'person',updatedAt:{seconds:2},monthScore:9},{uid:'person',updatedAt:{seconds:1},planet:'sun',vibes:'Hello'}],today);
  assert.equal(row.monthScore,9);assert.equal(row.planet,'sun');assert.equal(row.vibes,'Hello');
});
test('missing shared records remain unknown, and records for another user are ignored',()=>{
  const row=profileDetails(identity,[undefined,{uid:'someone-else',monthScore:10,planet:'sun'}],today);
  assert.equal(row.sharedDetailsAvailable,false);assert.equal(row.monthScore,undefined);assert.equal(row.planet,undefined);assert.equal(row.streakAvailable,false);
});
test('legacy shared days supply the same streak fallback as the Solar System',()=>{
  const row=profileDetails(identity,[{uid:'person',monthScore:8}],today,[{uid:'person',date:'2026-10-29',score:8},{uid:'person',date:'2026-10-28',score:7}]);
  assert.equal(row.consecutiveStreak,2);assert.equal(row.streakEndDate,'2026-10-29');
});
test('a newer legacy summary cannot inherit an outdated streak from an older public copy',()=>{
  const row=profileDetails(identity,[{uid:'person',updatedAt:{seconds:1},monthScore:7,consecutiveStreak:0,streakEndDate:null},{uid:'person',updatedAt:{seconds:2},monthScore:8}],today);
  assert.equal(row.streakAvailable,false);
});
test('the owner appearance wins over later summary copies without including preference metadata',()=>{
  const row=profileDetails(identity,[{uid:'person',updatedAt:{seconds:20},monthScore:8,planet:'happy',vibes:'Stale summary'}],today,undefined,{planet:'mogging',vibes:'Actual current vibes',primaryGroupId:'not-a-profile-field'});
  assert.equal(row.planet,'mogging');assert.equal(row.vibes,'Actual current vibes');assert.equal(row.primaryGroupId,undefined);
});
