import test from 'node:test';
import assert from 'node:assert/strict';
import {mountViewport} from '../prototype/viewport.mjs';

function target(){const listeners=new Map();return {addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},emit(type){for(const fn of listeners.get(type)||[])fn();}};}
function setup(viewport={height:844,width:390,offsetTop:0,offsetLeft:0}){
  const properties=new Map(),frames=new Map();let serial=0;
  const window={...target(),innerHeight:844,innerWidth:390,visualViewport:viewport?Object.assign(target(),viewport):undefined,requestAnimationFrame(fn){frames.set(++serial,fn);return serial;},cancelAnimationFrame(id){frames.delete(id);}};
  const document={...target(),documentElement:{style:{setProperty:(key,value)=>properties.set(key,value)}},activeElement:null};
  return {window,document,properties,flush(){const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn());}};
}

test('keyboard resize and viewport pan keep modal bounds current and reveal the draft inside its dialog',()=>{
  const env=setup(),dialog={scrollTop:0,getBoundingClientRect:()=>({top:12,bottom:288}),querySelector:()=>({getBoundingClientRect:()=>({bottom:66})})};
  const field={value:'An unfinished current vibe',matches:()=>true,closest:()=>dialog,getBoundingClientRect:()=>({top:240,bottom:324})};
  env.document.activeElement=field;const stop=mountViewport(env);env.flush();
  assert.equal(dialog.scrollTop,48,'scroll the editor above the dialog bottom without scrolling the page');
  Object.assign(env.window.visualViewport,{height:300,width:390,offsetTop:180,offsetLeft:0});env.window.visualViewport.emit('resize');env.window.visualViewport.emit('scroll');env.flush();
  assert.equal(env.properties.get('--visible-height'),'300px');assert.equal(env.properties.get('--visible-top'),'180px');
  assert.equal(field.value,'An unfinished current vibe','viewport changes preserve the text draft');
  stop();env.window.visualViewport.height=500;env.window.visualViewport.emit('resize');env.flush();assert.equal(env.properties.get('--visible-height'),'300px','unmount removes listeners');
});

test('orientation changes update width and reveal an editor above the sticky title without moving unrelated page fields',()=>{
  const env=setup(),dialog={scrollTop:160,getBoundingClientRect:()=>({top:12,bottom:378}),querySelector:()=>({getBoundingClientRect:()=>({bottom:70})})};
  env.document.activeElement={matches:()=>true,closest:()=>dialog,getBoundingClientRect:()=>({top:40,bottom:124})};
  mountViewport(env);env.flush();assert.equal(dialog.scrollTop,122);
  Object.assign(env.window.visualViewport,{height:390,width:844,offsetTop:0});env.window.emit('resize');env.flush();assert.equal(env.properties.get('--visible-width'),'844px');
  const prior=dialog.scrollTop;env.document.activeElement={matches:()=>true,closest:()=>null};env.document.emit('focusin');env.flush();assert.equal(dialog.scrollTop,prior);
});

test('browsers without VisualViewport use the window bounds',()=>{
  const env=setup(null);mountViewport(env);env.flush();
  assert.equal(env.properties.get('--visible-height'),'844px');assert.equal(env.properties.get('--visible-width'),'390px');assert.equal(env.properties.get('--visible-top'),'0px');
});
