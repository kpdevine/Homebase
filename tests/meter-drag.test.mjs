import test from 'node:test';
import assert from 'node:assert/strict';
import {bindMeterDrag} from '../prototype/meter-drag.mjs';

function control(options={}) {
  const surface=new EventTarget(),meter=new EventTarget();let value=5,captured=null;
  meter.ownerDocument={defaultView:surface};
  meter.querySelector=()=>({getBoundingClientRect:()=>({left:0,top:0,width:220,height:210})});
  meter.classList={add(){},remove(){}};meter.focus=()=>{};
  meter.setPointerCapture=id=>captured=id;
  meter.hasPointerCapture=id=>id===captured;
  meter.releasePointerCapture=()=>captured=null;
  bindMeterDrag(meter,{read:()=>value,change:next=>value=next,...options});
  const send=(type,x,y,extra={})=>{
    const event=new Event(type,{cancelable:true});
    Object.assign(event,{clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,isPrimary:true,...extra});
    (type==='pointerdown'||type==='lostpointercapture'?meter:surface).dispatchEvent(event);
    return event;
  };
  return {send,value:()=>value,captured:()=>captured};
}
test('mouse dragging from the number adjusts continuously, keeps capture, and stops on release',()=>{
  const meter=control();
  assert.equal(meter.send('pointerdown',110,110).defaultPrevented,true);
  assert.equal(meter.value(),5);
  meter.send('pointermove',110,74);
  assert.equal(meter.value(),7);
  assert.equal(meter.captured(),1);
  meter.send('pointerup',110,56);
  assert.equal(meter.value(),8);
  assert.equal(meter.captured(),null);
  meter.send('pointermove',110,20);
  assert.equal(meter.value(),8);
});
test('ring clicking and captured dragging use the same angles for mouse and touch',()=>{
  for(const pointerType of ['mouse','touch']) {
    const meter=control();
    meter.send('pointerdown',28,110,{pointerType});
    assert.equal(meter.value(),2.3);
    meter.send('pointermove',192,110,{pointerType});
    assert.equal(meter.value(),7.7);
    meter.send('pointercancel',192,110,{pointerType});
    assert.equal(meter.captured(),null);
  }
});
test('unrelated pointers and secondary mouse buttons cannot change a drag',()=>{
  const meter=control();
  meter.send('pointerdown',110,110,{button:2});
  assert.equal(meter.captured(),null);
  meter.send('pointerdown',110,110);
  meter.send('pointermove',110,20,{pointerId:2});
  meter.send('pointerup',110,20,{pointerId:2});
  assert.equal(meter.value(),5);assert.equal(meter.captured(),1);
  meter.send('blur');assert.equal(meter.captured(),null);
});
test('target drags clamp to whole sets and ratings respect their configured minimum',()=>{
  const target=control({max:20,step:1});
  target.send('pointerdown',110,110);target.send('pointermove',113,110);
  assert.equal(target.value(),5);
  target.send('pointermove',119,110);assert.equal(target.value(),6);
  target.send('pointermove',500,110);assert.equal(target.value(),20);
  const nutrition=control({min:1});
  nutrition.send('pointerdown',110,110);nutrition.send('pointermove',110,500);
  assert.equal(nutrition.value(),1);
});
