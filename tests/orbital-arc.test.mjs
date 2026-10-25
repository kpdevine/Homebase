import test from 'node:test';
import assert from 'node:assert/strict';
import {startArcDrag,moveArcDrag} from '../prototype/drag-arc.mjs';

test('ten stays at ten while crossing the gap to zero, then reverses along the arc',()=>{
  const drag=startArcDrag(330);
  for(const angle of [335,345,355,0,5])assert.equal(moveArcDrag(drag,angle),10);
  for(const angle of [0,355,345,335,330])assert.equal(moveArcDrag(drag,angle),10);
  assert.equal(moveArcDrag(drag,297),9);
  assert.equal(moveArcDrag(drag,264),8);
});
test('zero stays at zero across the gap toward ten, then reverses along the arc',()=>{
  const drag=startArcDrag(0);
  for(const angle of [355,345,335,330,325])assert.equal(moveArcDrag(drag,angle),0);
  for(const angle of [330,335,345,355,0])assert.equal(moveArcDrag(drag,angle),0);
  assert.equal(moveArcDrag(drag,33),1);
  assert.equal(moveArcDrag(drag,66),2);
});
test('a full rotation beyond either pole cannot wrap the score',()=>{
  const high=startArcDrag(330);
  for(let angle=340;angle<=700;angle+=10)assert.equal(moveArcDrag(high,angle),10);
  const low=startArcDrag(0);
  for(let angle=-10;angle>=-370;angle-=10)assert.equal(moveArcDrag(low,angle),0);
});
test('normal dragging can cover the entire legal arc in both directions',()=>{
  const drag=startArcDrag(0);
  for(let value=1;value<=10;value++)assert.equal(moveArcDrag(drag,value*33),value);
  for(let value=9;value>=0;value--)assert.equal(moveArcDrag(drag,value*33),value);
});
test('a fresh drag in the gap uses its nearest pole and can return into the legal arc',()=>{
  const high=startArcDrag(340);assert.equal(moveArcDrag(high,330),10);
  assert.equal(moveArcDrag(high,297),9);
  const low=startArcDrag(350);assert.equal(moveArcDrag(low,0),0);
  assert.equal(moveArcDrag(low,33),1);
});
