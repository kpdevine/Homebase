import test from 'node:test';
import assert from 'node:assert/strict';
import {mountScrollBoundary} from '../prototype/scroll-boundary.mjs';
function setup(){
  const events=new Map(),root={},window={scrollY:0,getComputedStyle:()=>({overflowY:'auto'})};
  const document={documentElement:root,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
  const stop=mountScrollBoundary({window,document});
  let blocked=false;
  const touch=(name,y,target=root,count=1)=>{blocked=false;events.get(name)({touches:Array.from({length:count},()=>({clientY:y})),target,cancelable:true,preventDefault(){blocked=true;}});return blocked;};
  return {window,root,events,stop,touch};
}
test('a downward pull at the page top stops bounce, while ordinary scrolling and pinch gestures work',()=>{
  const ui=setup();ui.touch('touchstart',100);assert.equal(ui.touch('touchmove',130),true);
  assert.equal(ui.touch('touchmove',110),false);
  ui.window.scrollY=20;assert.equal(ui.touch('touchmove',140),false);
  ui.window.scrollY=0;ui.touch('touchstart',100,ui.root,2);assert.equal(ui.touch('touchmove',140,ui.root,2),false);
  ui.stop();assert.equal(ui.events.size,0);
});
test('scrollable menus can scroll back to their own top without dragging the page past its edge',()=>{
  const ui=setup(),menu={scrollTop:30,clientHeight:100,scrollHeight:300,parentElement:ui.root};
  ui.touch('touchstart',100,menu);assert.equal(ui.touch('touchmove',120,menu),false);
  menu.scrollTop=0;assert.equal(ui.touch('touchmove',140,menu),true);
});
