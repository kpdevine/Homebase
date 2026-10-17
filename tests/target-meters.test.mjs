import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,GROUPS,meterPoint,scoreFromPoint} from '../prototype/model.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
const date='2026-10-12',values=target=>GROUPS.map(group=>({id:group.id,target}));
test('target meter has exactly 21 whole positions and snaps the gap to an endpoint',()=>{
  for(let value=0;value<=20;value++){const point=meterPoint(1+value/20*9);assert.equal(scoreFromPoint(point.x,point.y,110,110,{min:0,max:20,step:1}),value);}
  for(let angle=0;angle<360;angle+=.25){const radians=angle*Math.PI/180,value=scoreFromPoint(110+82*Math.cos(radians),110+82*Math.sin(radians),110,110,{min:0,max:20,step:1});assert.ok(Number.isInteger(value)&&value>=0&&value<=20);}
});
test('zero targets persist, carry forward, and exclude goal credit while keeping total sets',()=>{
  const store=createStore({seed:false});store.setWeekTargets(date,values(0));store.addGymEntry(date,'chest',5);
  const restored=createStore({seed:false,snapshot:validateSnapshot(store.exportSnapshot())}),pace=restored.trainingProgress(date);
  assert.equal(pace.actual,5);assert.equal(pace.credited,0);assert.equal(pace.score,null);assert.equal(pace.excluded,true);assert.equal(pace.logged,true);assert.deepEqual(pace.suggestions,[]);
  assert.ok(restored.loadWeek('2026-10-19').groups.every(group=>group.target===0));
});
test('new edits accept only whole 0–20 targets without corrupting saved values',()=>{
  const store=createStore({seed:false});store.setWeekTargets(date,values(20));const before=store.exportSnapshot();
  for(const bad of [-1,20.1,21,8.5,NaN])assert.throws(()=>store.setWeekTargets(date,values(bad)));
  assert.deepEqual(store.exportSnapshot(),before);
  const old=store.exportSnapshot();old.targets[0][1][0].target=25;const restored=createStore({seed:false,snapshot:old});assert.equal(restored.loadWeek(date).groups[0].target,25);
});
test('an older combined Legs goal can also be turned off without losing its logs',()=>{
  const store=createStore({seed:false});store.addGymEntry(date,'legs',5);const snapshot=store.exportSnapshot();snapshot.targets=[[date,[{id:'legs',name:'Legs',target:16}]]];
  const restored=createStore({seed:false,snapshot});restored.setWeekTargets(date,[...values(0),{id:'legs',target:0}]);
  assert.equal(restored.trainingProgress(date).target,0);assert.equal(restored.trainingProgress(date).actual,5);
});
