import test from 'node:test';
import assert from 'node:assert/strict';
import {solarAppearance,solarMonthStats,REACTIONS,monthlyRanks,dayReactionCounts,rankLeaderboard} from '../prototype/social-model.mjs';

test('planet profiles accept the existing emoji set and bounded optional messages',()=>{
  assert.deepEqual(solarAppearance(),{planet:'happy',vibes:''});
  for(const {id} of REACTIONS)assert.deepEqual(solarAppearance({planet:id,vibes:'  Good day  '}),{planet:id,vibes:'Good day'});
  assert.throws(()=>solarAppearance({planet:'unrecognized'}));
  for(const vibes of [null,{},'x'.repeat(161)])assert.throws(()=>solarAppearance({vibes}));
});

test('monthly medals follow current scores and logged-day tie breaks, excluding unlogged or stale rows',()=>{
  const rows=[{uid:'c',username:'c',month:'2026-10',monthScore:8,daysLogged:3},{uid:'a',username:'a',month:'2026-10',monthScore:9,daysLogged:4},
    {uid:'b',username:'b',month:'2026-10',monthScore:9,daysLogged:2},{uid:'old',username:'old',month:'2026-09',monthScore:10,daysLogged:20},
    {uid:'empty',username:'empty',month:'2026-10',monthScore:null,daysLogged:0},{uid:'zero',username:'zero',month:'2026-10',monthScore:0,daysLogged:1}];
  assert.deepEqual([...monthlyRanks(rows,'2026-10')],[['a',1],['b',2],['c',3],['zero',4]]);
  assert.deepEqual(rankLeaderboard(rows,'2026-10').slice(0,3).map(row=>row.uid),['a','b','c']);
});

test('reaction badges count only the selected member and day using recognized planets',()=>{
  const date='2026-10-22',reactions=[{target:'a',date,kind:'fire'},{target:'a',date,kind:'fire'},{target:'a',date,kind:'party'},
    {target:'b',date,kind:'fire'},{target:'a',date:'2026-10-21',kind:'love'},{target:'a',date,kind:'invalid'}];
  assert.deepEqual(dayReactionCounts(reactions,'a',date).map(({id,count})=>({id,count})),[{id:'party',count:1},{id:'fire',count:2}]);
});

test('group averages weight each logged day and omit stale months or missing scores',()=>{
  const members=[{month:'2026-10',monthScore:10,daysLogged:1},{month:'2026-10',monthScore:7,daysLogged:3},
    {month:'2026-09',monthScore:10,daysLogged:30},{month:'2026-10',monthScore:null,daysLogged:0}];
  assert.deepEqual(solarMonthStats(members,'2026-10'),{average:7.8,logs:4});
  assert.deepEqual(solarMonthStats([],'2026-10'),{average:null,logs:0});
  assert.deepEqual(solarMonthStats([{month:'2026-10',monthScore:0,daysLogged:1}],'2026-10'),{average:0,logs:1});
});
