import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCloud} from '../prototype/cloud-ui.mjs';
import {createStore} from '../prototype/model.mjs';
import {firebaseConfig} from '../prototype/firebase-config.mjs';
const memory=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};
function surface(options={}){
 const fields=new Map();let observe,remote;
 const el=id=>{if(!fields.has(id))fields.set(id,{open:false,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},showModal(){this.open=true;},close(){this.open=false;}});return fields.get(id);};
 const localStorage=memory(),sessionStorage=memory(),document={getElementById:el,addEventListener(){}};
 const snapshot=createStore({seed:false}).exportSnapshot();
 const client={signIn:async()=>observe({uid:'qa-user',displayName:'QA',email:'qa@example.com'}),signOut:async()=>observe(null),observeAuth:fn=>observe=fn,transport:()=>({subscribe:fn=>{remote=fn;return()=>{};},commit:async()=>{}})};
 Object.assign(globalThis,{document,localStorage,sessionStorage,window:{addEventListener(){}}});
 const cloud=mountCloud({preview:false,readLocal:()=>snapshot,applyLocal(){},canApply:()=>true,flushLocal:()=>true,onStatus(){},localEditTimes:()=>new Map(),adoptEditTimes(){},loadClient:async()=>client,...options});
 return {el,cloud,localStorage,sessionStorage,auth:user=>observe(user),ready:(records=new Map())=>remote(records),snapshot};
}
test('Google sign-in prompts to enable sync; declining keeps local data and re-sign-in prompts again',async()=>{
 const s=surface();await new Promise(resolve=>setImmediate(resolve));await s.cloud.signIn();
 assert.equal(s.el('sync-prompt').open,true);assert.equal(s.el('sync-turn-on').disabled,true);assert.equal(s.cloud.isEnabled(),false);
 s.ready();assert.equal(s.el('sync-turn-on').disabled,false);s.el('sync-not-now').handlers.click();assert.equal(s.el('sync-prompt').open,false);assert.equal(s.cloud.isEnabled(),false);
 await s.cloud.signIn();assert.equal(s.el('sync-prompt').open,true);s.auth(null);
});
test('enabling sync is explicit, persists per account, and does not prompt when already enabled',async()=>{
 const s=surface();await new Promise(resolve=>setImmediate(resolve));await s.cloud.signIn();s.ready();s.el('sync-turn-on').handlers.click();
 assert.equal(s.el('sync-prompt').open,false);assert.equal(s.cloud.isEnabled(),true);
 assert.equal(s.localStorage.getItem(`homebase.cloud-enabled.v1.${firebaseConfig.projectId}.qa-user`),'true');
 s.auth(null);s.auth({uid:'qa-user'});assert.equal(s.el('sync-prompt').open,false);s.auth(null);
});
test('restoring a previously declined session does not reopen the consent menu on every reload',async()=>{
 const s=surface();await new Promise(resolve=>setImmediate(resolve));s.localStorage.setItem(`homebase.cloud-prompted.v1.${firebaseConfig.projectId}.qa-user`,'true');s.auth({uid:'qa-user'});assert.equal(s.el('sync-prompt').open,false);s.auth(null);
});
test('account-first sign-in prepares the workspace and enables sync without a second consent dialog',async()=>{
 const prepared=[],users=[];const s=surface({autoSync:true,prepareAccount:user=>{prepared.push(user?.uid||null);return {preferCloudOnFirstRead:true};},onUser:user=>users.push(user?.uid||null)});
 await new Promise(resolve=>setImmediate(resolve));await s.cloud.signIn();
 assert.deepEqual(prepared,['qa-user']);assert.deepEqual(users,['qa-user']);assert.equal(s.cloud.isEnabled(),true);assert.equal(s.el('sync-prompt').open,false);
 s.auth(null);assert.deepEqual(prepared,['qa-user',null]);assert.equal(s.cloud.isEnabled(),false);
});
test('a failed account switch cannot start sync against the previous local records',async()=>{
 const s=surface({autoSync:true,prepareAccount:()=>{throw Error('Could not save offline records');}});await new Promise(resolve=>setImmediate(resolve));await s.cloud.signIn();
 assert.equal(s.cloud.isEnabled(),false);assert.equal(s.cloud.hasUser(),false);assert.equal(s.cloud.status(),'error');assert.match(s.el('cloud-status').textContent,/Could not save offline records/);
});

test('last successful sync persists per account and stays hidden from another signed-in account',async()=>{
 const s=surface({autoSync:true});await new Promise(resolve=>setImmediate(resolve));await s.cloud.signIn();
 try{
 const storageKey=`homebase.cloud-last-synced.v1.${firebaseConfig.projectId}.qa-user`;
 assert.equal(s.el('cloud-last-synced-time').textContent,'Not synced yet');assert.equal(s.localStorage.getItem(storageKey),null);
 const {snapshotRecords}=await import('../prototype/cloud-records.mjs');s.ready(snapshotRecords(s.snapshot));const saved=Number(s.localStorage.getItem(storageKey));assert.ok(saved>0);
 assert.equal(s.el('cloud-last-synced-time').dateTime,new Date(saved).toISOString());
 s.auth({uid:'another-account'});assert.equal(s.el('cloud-last-synced-time').textContent,'Not synced yet');
 s.auth({uid:'qa-user'});assert.equal(s.el('cloud-last-synced-time').dateTime,new Date(saved).toISOString());
 s.auth(null);assert.equal(s.el('cloud-last-synced-time').textContent,'Sign in to sync');assert.equal(s.el('cloud-last-synced-time').dateTime,'');
 }finally{s.auth(null);}
});

test('preview sync time explicitly describes local-only storage',()=>{
 const s=surface({preview:true});assert.equal(s.el('cloud-last-synced-time').textContent,'Preview stays local');
});
