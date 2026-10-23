import test from 'node:test';
import assert from 'node:assert/strict';
import {solarAppearance,solarMonthStats,REACTIONS} from '../prototype/social-model.mjs';

test('planet profiles accept the existing emoji set and bounded optional messages',()=>{
  assert.deepEqual(solarAppearance(),{planet:'happy',vibes:''});
  for(const {id} of REACTIONS)assert.deepEqual(solarAppearance({planet:id,vibes:'  Good day  '}),{planet:id,vibes:'Good day'});
  assert.throws(()=>solarAppearance({planet:'unrecognized'}));
  for(const vibes of [null,{},'x'.repeat(161)])assert.throws(()=>solarAppearance({vibes}));
});

test('group averages weight each logged day and omit stale months or missing scores',()=>{
  const members=[{month:'2026-10',monthScore:10,daysLogged:1},{month:'2026-10',monthScore:7,daysLogged:3},
    {month:'2026-09',monthScore:10,daysLogged:30},{month:'2026-10',monthScore:null,daysLogged:0}];
  assert.deepEqual(solarMonthStats(members,'2026-10'),{average:7.8,logs:4});
  assert.deepEqual(solarMonthStats([],'2026-10'),{average:null,logs:0});
  assert.deepEqual(solarMonthStats([{month:'2026-10',monthScore:0,daysLogged:1}],'2026-10'),{average:0,logs:1});
});
