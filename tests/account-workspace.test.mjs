import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountWorkspace} from '../prototype/account-workspace.mjs';
import {createStore} from '../prototype/model.mjs';
import {newUserSettings} from '../prototype/customization.mjs';
import {snapshotRecords,recordsSnapshot} from '../prototype/cloud-records.mjs';
import {googleFirstName,needsLoggingSetup} from '../prototype/onboarding.mjs';

function fixture(legacy=false){
  const map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
  let local={snapshot:'device data',preferences:{name:'Device'},edits:{settings:123}};
  const options={storage,project:'test',read:()=>local,apply:value=>{local=value;},fresh:()=>({snapshot:'fresh',preferences:{},edits:null}),hasLegacyAccount:()=>legacy};
  let manager=createAccountWorkspace(options);
  return {get manager(){return manager;},get local(){return local;},set local(value){local=value;},reload(){manager=createAccountWorkspace(options);},storage};
}
test('switching accounts isolates their records, preferences, and offline edits; signing out restores device data',()=>{
  const h=fixture();assert.equal(h.manager.switchTo('alice').preferCloudOnFirstRead,true);assert.equal(h.local.snapshot,'fresh');
  h.local={snapshot:'Alice offline edit',preferences:{name:'Alice',theme:'mars'},edits:{day:456}};h.manager.restored();
  h.manager.switchTo('bob');assert.equal(h.local.snapshot,'fresh');h.local={snapshot:'Bob',preferences:{name:'Bob'},edits:null};h.manager.restored();
  assert.equal(h.manager.switchTo('alice').preferCloudOnFirstRead,false);assert.equal(h.local.snapshot,'Alice offline edit');assert.equal(h.local.preferences.theme,'mars');assert.deepEqual(h.local.edits,{day:456});
  h.manager.switchTo(null);assert.equal(h.local.snapshot,'device data');
  h.manager.switchTo('bob');assert.equal(h.local.snapshot,'Bob');
});
test('a legacy signed-in workspace migrates once and is never replaced by anonymous data on later sign-in',()=>{
  const h=fixture(true);assert.equal(h.manager.switchTo('alice').preferCloudOnFirstRead,false);assert.equal(h.local.snapshot,'device data');
  h.local={snapshot:'Alice',preferences:{},edits:null};h.manager.switchTo(null);h.local={snapshot:'anonymous',preferences:{},edits:null};
  h.manager.switchTo('alice');assert.equal(h.local.snapshot,'Alice');
});
test('interrupted initial restoration remains cloud-first after reloading',()=>{
  const h=fixture();h.manager.switchTo('alice');h.reload();assert.equal(h.manager.switchTo('alice').preferCloudOnFirstRead,true);
  h.manager.restored();h.reload();assert.equal(h.manager.switchTo('alice').preferCloudOnFirstRead,false);
});
test('failed cache writes stop account replacement and retain the current workspace',()=>{
  const h=fixture();const before=h.local;h.storage.setItem=()=>{throw Error('full');};assert.throws(()=>h.manager.switchTo('alice'),/full/);assert.equal(h.local,before);
});
test('unavailable browser storage is reported during account preparation rather than crashing app startup',()=>{
  const manager=createAccountWorkspace({storage:{getItem(){throw Error('blocked');}},project:'test'});
  assert.throws(()=>manager.switchTo('alice'),/blocked/);
});
test('Google names use the first name with a safe fallback',()=>{
  assert.equal(googleFirstName('  Alex Morgan Smith '),'Alex');assert.equal(googleFirstName(null),'Friend');assert.equal(googleFirstName(''),'Friend');
});
test('account preferences sync without completing first-time setup or changing daily reviews',()=>{
  const date='2026-10-26',store=createStore({seed:false,settings:newUserSettings()});store.loadDay(date);
  const before=structuredClone(store.exportSnapshot().days);
  store.setAccountPreferences({firstName:'Alex',theme:'mars',motion:'reduced'});
  assert.deepEqual(store.exportSnapshot().days,before);assert.equal(store.getSettings().setupComplete,false);
  const restored=recordsSnapshot(snapshotRecords(store.exportSnapshot()));
  assert.deepEqual(restored.settings.accountPreferences,{firstName:'Alex',theme:'mars',motion:'reduced'});
  assert.equal(needsLoggingSetup({snapshot:restored,hasUser:true,cloudStatus:'synced'}),true);
  store.setSettings({...store.getSettings(),tabsChosen:true},date);
  assert.equal(needsLoggingSetup({snapshot:recordsSnapshot(snapshotRecords(store.exportSnapshot())),hasUser:true,cloudStatus:'synced'}),false);
  assert.throws(()=>store.setAccountPreferences({firstName:'Alex',theme:'other',motion:'full'}),/account preferences/);
});
