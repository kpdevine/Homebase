import test from 'node:test';
import assert from 'node:assert/strict';
import {caretGeometry} from '../prototype/handwriting-caret.mjs';

test('handwritten caret follows text at normal, compact desktop, and enlarged scale',()=>{
  for(const scale of [1,.8,1.25]) {
    const origin={left:140,top:80,width:600*scale};
    const rect={left:origin.left+450*scale,top:origin.top+20*scale,height:24*scale};
    const actual=caretGeometry(rect,origin,600);
    for(const [key,expected] of Object.entries({x:450,y:20,height:24}))assert.ok(Math.abs(actual[key]-expected)<1e-9,`${key} at ${scale} scale`);
  }
});

test('wrapped and scrolled notes subtract local scroll offsets after undoing scale',()=>{
  const origin={left:100,top:200,width:400};
  assert.deepEqual(caretGeometry({left:180,top:680,height:16},origin,500,25,500),{x:75,y:100,height:20});
  assert.deepEqual(caretGeometry({left:108,top:208,height:16},origin,500),{x:10,y:10,height:20});
});

test('unmeasurable or hidden text keeps the native cursor fallback',()=>{
  const rect={left:10,top:20,height:0},origin={left:0,top:0,width:100};
  assert.equal(caretGeometry(rect,origin,100),null);
  assert.equal(caretGeometry({...rect,height:20},{...origin,width:0},100),null);
  assert.equal(caretGeometry({...rect,height:20},origin,0),null);
});
