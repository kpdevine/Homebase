import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../prototype/phone-launch.js',import.meta.url),'utf8');
function launch({phone=true,theme='mars',motion='system',reduce=false,search='',missingImage=false}={}){
  let now=0,serial=0;
  const timers=new Map(),events=new Map(),imageEvents=new Map();
  const root={dataset:{theme}},image={src:null,complete:false,naturalWidth:0,getAttribute(name){return this[name];},addEventListener(name,fn){imageEvents.set(name,fn);}};
  const document={documentElement:root,hidden:false,getElementById:()=>missingImage?null:image,addEventListener(name,fn){events.set(name,fn);}};
  const window={matchMedia:()=>({matches:reduce}),addEventListener(name,fn){events.set(name,fn);}};
  const context={window,document,navigator:{userAgent:phone?'iPhone':'Desktop'},location:{search},URLSearchParams,Date:{now:()=>now},localStorage:{getItem:()=>JSON.stringify({motion})},setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,context);
  const advance=duration=>{const end=now+duration;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;};
  return {root,image,document,window,events,advance,dom(){events.get('DOMContentLoaded')();},load(){imageEvents.get('load')();},error(){imageEvents.get('error')();}};
}

test('the selected cutout gets a complete loading circle before sliding away',()=>{
  const ui=launch();ui.dom();ui.load();ui.window.pocketLaunch.ready();
  assert.match(ui.image.src,/assets\/mascots\/pocket-planet-mars\.png/);
  assert.equal(ui.root.dataset.launchImage,'ready');
  ui.advance(399);assert.equal(ui.root.dataset.phoneLaunch,'show');
  ui.advance(1);assert.equal(ui.root.dataset.phoneLaunch,'leaving');
  ui.advance(179);assert.equal(ui.root.dataset.phoneLaunch,'leaving');
  ui.advance(1);assert.equal(ui.root.dataset.phoneLaunch,undefined);
});

test('a slow mascot does not hold a ready app behind the loading cover',()=>{
  const ui=launch();ui.dom();ui.window.pocketLaunch.ready();ui.advance(400);
  assert.equal(ui.root.dataset.phoneLaunch,'leaving');
  ui.load();ui.advance(180);assert.equal(ui.root.dataset.phoneLaunch,undefined);
});

test('a failed startup or asset cannot leave a permanent cover',()=>{
  const stalled=launch();stalled.dom();
  stalled.advance(1580);assert.equal(stalled.root.dataset.phoneLaunch,undefined);
  const broken=launch();broken.dom();broken.error();broken.window.pocketLaunch.ready();
  assert.equal(broken.image.hidden,true);assert.equal(broken.root.dataset.launchImage,'unavailable');
  broken.advance(580);assert.equal(broken.root.dataset.phoneLaunch,undefined);
  const absent=launch({missingImage:true});absent.dom();assert.equal(absent.root.dataset.phoneLaunch,undefined);
});

test('short interruptions do not replay; reopening runs a complete circle',()=>{
  const ui=launch();ui.dom();ui.load();ui.window.pocketLaunch.ready();ui.advance(580);
  ui.document.hidden=true;ui.events.get('visibilitychange')();ui.advance(5000);
  ui.document.hidden=false;ui.events.get('visibilitychange')();
  assert.equal(ui.root.dataset.phoneLaunch,undefined);
  ui.document.hidden=true;ui.events.get('visibilitychange')();ui.advance(30000);
  ui.document.hidden=false;ui.events.get('visibilitychange')();assert.equal(ui.root.dataset.phoneLaunch,'show');
  ui.advance(399);assert.equal(ui.root.dataset.phoneLaunch,'show');
  ui.advance(181);assert.equal(ui.root.dataset.phoneLaunch,undefined);
});

test('returning from the page cache uses the currently selected theme',()=>{
  const ui=launch();ui.dom();ui.load();ui.window.pocketLaunch.ready();ui.advance(580);
  ui.root.dataset.theme='blue';ui.events.get('pageshow')({persisted:true});
  assert.match(ui.image.src,/pocket-planet-blue\.png/);
  assert.equal(ui.root.dataset.launchImage,undefined);
  ui.load();ui.advance(580);assert.equal(ui.root.dataset.phoneLaunch,undefined);
});

test('reduced motion is static and does not wait through an exit slide',()=>{
  for(const settings of [{motion:'reduced'},{motion:'system',reduce:true}]){
    const ui=launch(settings);ui.dom();ui.load();ui.window.pocketLaunch.ready();
    assert.equal(ui.root.dataset.launchMotion,'reduced');
    ui.advance(0);assert.equal(ui.root.dataset.phoneLaunch,undefined);
  }
});

test('desktop stays unchanged outside the explicitly requested preview',()=>{
  const desktop=launch({phone:false});
  assert.equal(desktop.window.pocketLaunch,undefined);assert.equal(desktop.root.dataset.phoneLaunch,undefined);
  const demo=launch({phone:false,search:'?preview=1&opening=1'});demo.dom();demo.load();demo.window.pocketLaunch.ready();
  assert.equal(demo.root.dataset.phoneLaunch,'show');demo.advance(580);demo.window.pocketLaunch.replay();
  assert.equal(demo.root.dataset.phoneLaunch,'show');assert.equal(demo.root.dataset.launchImage,'ready');
});
