import test from 'node:test';
import assert from 'node:assert/strict';
import {weightHistory,weightPlot} from '../prototype/weight-history.mjs';
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
