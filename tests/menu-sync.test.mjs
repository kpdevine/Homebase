import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceBusy} from '../prototype/interaction-guard.mjs';
import {createCloudEngine} from '../prototype/cloud-engine.mjs';
import {createStore} from '../prototype/model.mjs';
import {snapshotRecords} from '../prototype/cloud-records.mjs';

function surface(){
  const state={dialog:false,field:false,panels:[],reviewing:false};
  const document={querySelector:()=>state.dialog?{}:null,
    querySelectorAll:()=>state.panels.map(visible=>({getClientRects:()=>visible?[{}]:[]})),
    activeElement:{matches:()=>state.field}};
  return {state,busy:()=>workspaceBusy(document,{reviewing:state.reviewing})};
}
const date='2026-10-18';
function rated(value){const store=createStore({seed:false});store.updateRating(date,value);return store.exportSnapshot();}

test('cloud refresh waits while reading a dialog or expanded panel, before typing, and throughout guided review',()=>{
  for(const interaction of [{dialog:true},{panels:[true]},{field:true},{reviewing:true}]) {
    const ui=surface();Object.assign(ui.state,interaction);
    let local=rated(7),receive,applied=0,state;
    const base=snapshotRecords(local);
    const engine=createCloudEngine({readLocal:()=>local,applyLocal:next=>{local=next;applied++;},canApply:()=>!ui.busy(),
      loadBase:()=>[...base],onState:next=>state=next,delay:1000000,
      transport:{subscribe:callback=>{receive=callback;return()=>{};},commit:async()=>{}}});
    engine.enable();receive(snapshotRecords(rated(8)));
    for(let attempt=0;attempt<4;attempt++)engine.resume();
    assert.equal(applied,0);assert.equal(state.status,'editing');
    receive(snapshotRecords(rated(9)));engine.resume();assert.equal(local.days[0].nutrition,7);
    Object.assign(ui.state,{dialog:false,panels:[],field:false,reviewing:false});
    engine.resume();assert.equal(applied,1);assert.equal(local.days[0].nutrition,9);assert.equal(state.status,'synced');
    engine.close();
  }
});

test('closed or hidden panels do not hold cloud updates after the user leaves the menu',()=>{
  const ui=surface();ui.state.panels=[false,false];assert.equal(ui.busy(),false);
  ui.state.panels.push(true);assert.equal(ui.busy(),true);
  ui.state.panels.pop();assert.equal(ui.busy(),false);
});
