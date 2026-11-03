import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {readSolarCache,saveSolarCache,mergeSolarBootstrap} from '../prototype/solar-cache.mjs';
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
const member={groups:[{id:'orbit',groupName:'Our orbit',owner:'a'}],groupsLoaded:true,primaryId:'orbit',appearanceReady:true,appearance:{planet:'happy',vibes:'Hello',vibesDate:'2026-11-02'}};
test('returning members restore immediately and caches stay isolated by account',()=>{
 const cache=storage();saveSolarCache(cache,'alice',member);
 const loaded=readSolarCache(cache,'alice');assert.equal(loaded.groupsLoaded,true);assert.equal(loaded.groups[0].id,'orbit');assert.equal(loaded.appearanceReady,true);
 assert.equal(readSolarCache(cache,'bob'),null);
 assert.equal(readSolarCache({getItem(){throw Error('Storage unavailable');}},'alice'),null);
});
test('an unconfirmed empty snapshot keeps the known membership, but server-confirmed leaving clears it',()=>{
 const cache=storage(),empty={groups:[],groupsLoaded:false,appearanceReady:false};
 const pending=mergeSolarBootstrap(member,empty);assert.equal(pending.groups[0].id,'orbit');assert.equal(pending.appearanceReady,true);
 const left=mergeSolarBootstrap(member,{...empty,groupsLoaded:true});assert.equal(left.groups.length,0);
 saveSolarCache(cache,'alice',left);assert.equal(readSolarCache(cache,'alice'),null);
});
test('startup starts social membership loading before cloud synchronization completes',async()=>{
 const app=await readFile(new URL('../prototype/app.mjs',import.meta.url),'utf8');
 const start=app.indexOf('  onUser:user=>{'),end=app.indexOf('  onStatus:',start);
 const callback=app.slice(start,end).trim().replace(/,$/,'');
 const calls=[],context={socialUI:{setUser:user=>calls.push(user.uid)},store:{getSettings:()=>({})},finishWelcome(){},googleFirstName:()=> 'Alice'};
 vm.createContext(context);vm.runInContext('const handlers={'+callback+'}; handlers.onUser({uid:"alice"});',context);
 assert.deepEqual(calls,['alice']);
});
