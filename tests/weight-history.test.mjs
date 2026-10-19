import test from 'node:test';
import assert from 'node:assert/strict';
import {weightHistory,weightPlot,weightPointContext,weightDayChange,nearestWeightPoint} from '../prototype/weight-history.mjs';
import {createStore} from '../prototype/model.mjs';
import {summarizeDay} from '../prototype/scoring.mjs';
test('weight history omits missing/future entries, sorts dates, filters periods and converts mixed units',()=>{
  const snapshot={days:[{date:'2026-10-18',bodyWeight:{value:100,unit:'kg'}},{date:'2026-10-01',bodyWeight:{value:220.46226218,unit:'lb'}},{date:'2026-08-01',bodyWeight:{value:90,unit:'kg'}},{date:'2026-10-19',bodyWeight:{value:110,unit:'kg'}},{date:'2026-10-02',bodyWeight:null}]};
  const before=structuredClone(snapshot),points=weightHistory(snapshot,{unit:'kg',through:'2026-10-18',days:30});
  assert.deepEqual(points.map(point=>point.date),['2026-10-01','2026-10-18']);assert.ok(Math.abs(points[0].value-100)<1e-8);assert.equal(points[1].value,100);assert.deepEqual(snapshot,before);
  assert.equal(weightHistory(snapshot,{unit:'lb',through:'2026-10-18'}).length,3);
});
test('weight graph uses elapsed dates rather than spacing missing weigh-ins equally',()=>{
  const plot=weightPlot([{date:'2026-10-01',value:180},{date:'2026-10-02',value:181},{date:'2026-10-11',value:179}]);
  assert.equal(plot.points[0].x,70);assert.equal(plot.points[1].x,126);assert.equal(plot.points[2].x,630);assert.ok(plot.points.every(point=>point.y>35&&point.y<225));
});
test('empty and single-point graphs have safe bounds and never invent extra readings',()=>{
  assert.equal(weightPlot([]),null);const plot=weightPlot([{date:'2026-10-18',value:180}]);assert.equal(plot.points.length,1);assert.equal(plot.points[0].x,350);assert.equal(plot.points[0].y,130);assert.equal(plot.min,179);assert.equal(plot.max,181);
});

test('weigh-in context uses the previous calendar day, never the weigh-in day or overall score',()=>{
  const store=createStore({seed:false});store.updateRating('2026-10-17',8.4);store.setTrainingMode('2026-10-17','training');
  store.updateRating('2026-10-18',10);store.setTrainingMode('2026-10-18','rest');
  const before=store.exportSnapshot(),context=weightPointContext('2026-10-18',date=>summarizeDay(store.loadDay(date),store.loadTrainingDay(date),store.loadWeek(date)));
  assert.deepEqual(context,{date:'2026-10-18',previousDate:'2026-10-17',nutrition:8.4,training:4});assert.deepEqual(store.exportSnapshot(),before);
});
test('weigh-in context crosses month/year/leap boundaries and preserves unlogged scores as absent',()=>{
  for(const [date,previousDate] of [['2026-01-01','2025-12-31'],['2024-03-01','2024-02-29'],['2026-03-01','2026-02-28']]) {
    const calls=[],context=weightPointContext(date,key=>{calls.push(key);return {sections:[{id:'nutrition',score:0},{id:'training',score:null}]};});
    assert.deepEqual(calls,[previousDate]);assert.equal(context.previousDate,previousDate);assert.equal(context.nutrition,0);assert.equal(context.training,null);
  }
  assert.equal(weightPointContext('2026-10-18',()=>({sections:[]})).training,null);
});

test('daily weight change converts units, keeps the sign, and requires the exact previous date',()=>{
  const snapshot={days:[{date:'2026-10-16',bodyWeight:{value:101,unit:'kg'}},{date:'2026-10-17',bodyWeight:{value:220.46226218,unit:'lb'}},{date:'2026-10-18',bodyWeight:{value:100.5,unit:'kg'}},{date:'2026-10-20',bodyWeight:{value:99,unit:'kg'}}]};
  assert.equal(weightDayChange(snapshot,'2026-10-17','kg'),-1);
  assert.equal(weightDayChange(snapshot,'2026-10-18','kg'),.5);
  assert.equal(weightDayChange(snapshot,'2026-10-18','lb'),1.1);
  assert.equal(weightDayChange(snapshot,'2026-10-20','kg'),null);
  assert.equal(weightDayChange(snapshot,'2026-10-19','kg'),null);
  assert.equal(weightDayChange({days:[{date:'2026-10-17',bodyWeight:{value:100,unit:'kg'}},{date:'2026-10-18',bodyWeight:{value:100,unit:'kg'}}]},'2026-10-18','kg'),0);
});

test('overlapping graph tap halos select the nearest visible dot and reject distant space',()=>{
  const points=[{date:'2026-10-16',x:20,y:20},{date:'2026-10-17',x:26,y:22},{date:'2026-10-18',x:30,y:18}];
  assert.equal(nearestWeightPoint(points,21,20).date,'2026-10-16');
  assert.equal(nearestWeightPoint(points,26,21).date,'2026-10-17');
  assert.equal(nearestWeightPoint(points,31,18).date,'2026-10-18');
  assert.equal(nearestWeightPoint(points,200,200),null);
  assert.equal(nearestWeightPoint([],20,20),null);
  assert.equal(nearestWeightPoint([points[0]],20,52).date,'2026-10-16');
});
