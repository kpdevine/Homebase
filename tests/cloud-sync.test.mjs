import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,GROUPS} from '../prototype/model.mjs';
import {EMPTY_SNAPSHOT,canonical,snapshotRecords,recordsSnapshot,recordChanges,reconcileRecords,acknowledgeOwnChanges,syncBatch} from '../prototype/cloud-records.mjs';
import {createCloudEngine} from '../prototype/cloud-engine.mjs';
const date='2026-10-17',other='2026-10-18';
const fresh=()=>createStore({seed:false});
const make=(day,rating)=>{const store=fresh();store.updateRating(day,rating);return store.exportSnapshot();};

test('last sync time advances only with a server-confirmed synchronized snapshot',async()=>{
  const store=fresh(),states=[];let receive,clock=1000;
  const engine=createCloudEngine({transport:{subscribe(fn){receive=fn;return()=>{};},async commit(){}},readLocal:()=>store.exportSnapshot(),applyLocal(){},onState:state=>states.push(state),now:()=>clock,delay:60000});
  try{
    engine.enable();assert.equal(states.at(-1).lastSyncedAt,null);
    receive(snapshotRecords(store.exportSnapshot()));assert.equal(states.at(-1).lastSyncedAt,1000);
    clock=2000;await engine.flush();assert.equal(states.at(-1).lastSyncedAt,1000,'a no-op timer is not a new sync');
    store.updateRating(date,8);engine.changed();assert.equal(states.at(-1).lastSyncedAt,1000);
    await engine.flush();assert.equal(states.at(-1).lastSyncedAt,1000,'sending writes still waits for listener confirmation');
    clock=3000;receive(snapshotRecords(store.exportSnapshot()));assert.equal(states.at(-1).status,'synced');assert.equal(states.at(-1).lastSyncedAt,3000);
  }finally{engine.close();}
});

test('cloud documents round-trip full daily records, training, routines and zero targets',()=>{
  const store=fresh();store.updateRating(date,8.75);store.addGymEntry(date,'chest',5);store.updateSentiments(date,{notes:'A good day',rating:0});
  store.addTask(date,'Bedtime',{children:['Brush teeth'],recurrence:{frequency:'daily',weekdays:[]}});
  store.setWeekTargets(date,GROUPS.map(group=>({id:group.id,target:0})));
  const records=snapshotRecords(store.exportSnapshot()),roundtrip=recordsSnapshot(records);
  assert.deepEqual(snapshotRecords(roundtrip),records);
  assert.equal([...records.keys()].filter(id=>id.startsWith('day_')).length,1);
  const day=JSON.parse(records.get(`day_${date}`));assert.equal(day.entries[0].sets,5);assert.equal(day.day.sentiments.rating,0);
});
test('a nutrition edit changes only its day document, including the new rating and original tasks',()=>{
  const store=fresh();store.addTask(date,'Read');store.updateRating(date,7);store.updateRating(other,8);
  const before=snapshotRecords(store.exportSnapshot());store.updateRating(date,8.5);
  const changes=recordChanges(before,snapshotRecords(store.exportSnapshot()));
  assert.deepEqual(changes.map(change=>change.id),[`day_${date}`]);assert.equal(JSON.parse(changes[0].after).day.tasks[0].name,'Read');
});
test('different-day edits merge; competing same-day edits are surfaced without discarding either side',()=>{
  const base=snapshotRecords(make(date,7)),left=fresh(),right=fresh();
  left.updateRating(date,8);right.updateRating(date,9);right.updateRating(other,6);
  const local=snapshotRecords(left.exportSnapshot()),remote=snapshotRecords(right.exportSnapshot());
  const mine=reconcileRecords(base,local,remote);assert.deepEqual(mine.conflicts,[`day_${date}`]);
  assert.equal(recordsSnapshot(mine.merged).days.find(day=>day.date===date).nutrition,8);
  assert.equal(recordsSnapshot(mine.merged).days.find(day=>day.date===other).nutrition,6);
  const theirs=reconcileRecords(base,local,remote,'cloud');assert.equal(recordsSnapshot(theirs.merged).days.find(day=>day.date===date).nutrition,9);
  const separate=reconcileRecords(snapshotRecords(EMPTY_SNAPSHOT),snapshotRecords(make(date,8)),snapshotRecords(make(other,9)));
  assert.deepEqual(separate.conflicts,[]);assert.equal(recordsSnapshot(separate.merged).days.length,2);
});
test('deletion conflicts do not silently resurrect or remove a newer record',()=>{
  const base=snapshotRecords(make(date,7)),local=snapshotRecords(EMPTY_SNAPSHOT),remote=snapshotRecords(make(date,9));
  assert.deepEqual(reconcileRecords(base,local,remote).conflicts,[`day_${date}`]);
  assert.equal(recordsSnapshot(reconcileRecords(base,local,remote,'cloud').merged).days[0].nutrition,9);
});
test('device-scoped task, routine and gym IDs do not collide after simultaneous offline edits',()=>{
  const left=createStore({seed:false,clientId:'laptop'}),right=createStore({seed:false,clientId:'phone'});
  for(const store of [left,right]){store.addTask(date,'Read',{children:['One page']});store.addGymEntry(date,'chest',2);store.addTask(other,'Walk',{recurrence:{frequency:'daily',weekdays:[]}});}
  const ids=store=>store.exportSnapshot().days.flatMap(day=>day.tasks.map(task=>task.id)).concat(store.loadTrainingDay(date).map(entry=>entry.id),store.loadTemplates().map(template=>template.id));
  assert.ok(ids(left).every(id=>!ids(right).includes(id)));
});
test('malformed cloud payloads and oversized daily documents never become local records',()=>{
  assert.throws(()=>recordsSnapshot(new Map([['day_bad',JSON.stringify({type:'day',day:{date:'bad'},entries:[]})]])));
  const snapshot=make(date,7);snapshot.days[0].tasks=Array.from({length:1000},(_,index)=>({id:`task-${index}`,name:'a'.repeat(100),done:false,children:Array.from({length:20},(_,child)=>({id:`kid-${index}-${child}`,name:'a'.repeat(100),done:false,children:[]}))}));snapshot.serial=1000;
  assert.throws(()=>snapshotRecords(snapshot),/too large/);
});
test('bulk batches create routines before dependent days, delete routines last, and stay bounded',()=>{
  const changes=[{id:'day_2026-10-17',before:null,after:'{}'},{id:'routine_a',before:null,after:'{}'},{id:'routine_old',before:'{}',after:null}];
  assert.deepEqual(syncBatch(changes).map(change=>change.id),['routine_a','day_2026-10-17','routine_old']);
  assert.equal(syncBatch(Array.from({length:401},(_,i)=>({id:`day_${i}`,before:null,after:'{}'}))).length,100);
});
function harness(snapshot=EMPTY_SNAPSHOT,{base=null,canApply=()=>true,commitHook,preferCloudOnFirstRead=false}={}){
  let local=structuredClone(snapshot),receive,state,remote=new Map(),commits=0,persisted;
  const engine=createCloudEngine({preferCloudOnFirstRead,readLocal:()=>structuredClone(local),applyLocal:value=>{local=value;},canApply,loadBase:()=>base,saveBase:value=>{persisted=value;},onState:value=>{state=value;},delay:1000000,
    transport:{subscribe:callback=>{receive=callback;return()=>{};},commit:async changes=>{commits++;if(commitHook)await commitHook(changes);for(const change of changes){if((remote.get(change.id)??null)!==change.before){const error=new Error('conflict');error.code='homebase/conflict';throw error;}if(change.after===null)remote.delete(change.id);else remote.set(change.id,change.after);}receive(new Map(remote));}}});
  return {engine,get local(){return local;},set local(value){local=value;},get state(){return state;},get commits(){return commits;},get persisted(){return persisted;},send:value=>{remote=new Map(value);receive(remote);}};
}
test('a fresh device restores saved cloud settings and records instead of uploading its defaults',async()=>{
  const remote=fresh();remote.setSettings({...remote.getSettings(),tabsChosen:true,moduleOrder:['sleep','prayer','training','nutrition','checklists','sentiments']},date);remote.setAccountPreferences({firstName:'Alex',theme:'mars',motion:'reduced'});remote.updateRating(date,9);
  const h=harness(make(other,1),{preferCloudOnFirstRead:true});h.engine.enable();h.send(snapshotRecords(remote.exportSnapshot()));
  assert.equal(h.state.status,'synced');assert.equal(h.state.restored,true);assert.equal(h.commits,0);assert.equal(h.local.days.length,1);assert.equal(h.local.days[0].nutrition,9);assert.equal(h.local.settings.accountPreferences.firstName,'Alex');assert.equal(h.local.settings.moduleOrder[0],'sleep');h.engine.close();
});
test('a new cloud account keeps fresh defaults and uploads its chosen settings',async()=>{
  const store=fresh();store.setSettings({...store.getSettings(),tabsChosen:true},date);
  const h=harness(store.exportSnapshot(),{preferCloudOnFirstRead:true});h.engine.enable();h.send(new Map());assert.equal(h.state.restored,true);assert.equal(h.state.status,'pending');
  await h.engine.flush();assert.equal(h.state.status,'synced');assert.equal(h.local.settings.tabsChosen,true);assert.equal(h.commits,1);h.engine.close();
});
test('sign-in alone uploads nothing; enabling sync uploads only changed records and receives updates',async()=>{
  const h=harness(make(date,8));h.send(new Map());assert.equal(h.commits,0);assert.equal(h.state.status,'ready');
  h.engine.enable();await h.engine.flush();assert.equal(h.commits,1);assert.equal(h.state.status,'synced');
  h.send(snapshotRecords(make(date,9)));assert.equal(h.local.days[0].nutrition,9);assert.equal(h.state.status,'synced');h.engine.close();
});
test('remote updates wait for editing to finish and then merge with local changes',()=>{
  let editing=true;const base=snapshotRecords(make(date,7)),h=harness(make(date,7),{base:[...base],canApply:()=>!editing});
  h.engine.enable();h.send(snapshotRecords(make(date,8)));assert.equal(h.local.days[0].nutrition,7);assert.equal(h.state.status,'editing');
  editing=false;h.engine.resume();assert.equal(h.local.days[0].nutrition,8);h.engine.close();
});
test('an own-write acknowledgement preserves a newer local edit rather than creating a false conflict',async()=>{
  const base=snapshotRecords(make(date,7));let h;
  h=harness(make(date,8),{base:[...base],commitHook:async()=>{h.local=make(date,9);}});h.engine.enable();h.send(base);await h.engine.flush();
  assert.equal(h.local.days[0].nutrition,9);assert.notEqual(h.state.status,'conflict');
  await h.engine.flush();assert.equal(h.state.status,'synced');h.engine.close();
});
test('failed offline sends retain local records and the baseline for a safe later retry',async()=>{
  const base=snapshotRecords(make(date,7));let offline=true;
  const h=harness(make(date,8),{base:[...base],commitHook:async()=>{if(offline)throw new Error('offline');}});
  h.engine.enable();h.send(base);await h.engine.flush();assert.equal(h.state.status,'offline');assert.equal(h.local.days[0].nutrition,8);
  offline=false;await h.engine.retry();assert.equal(h.state.status,'synced');h.engine.close();
});
test('choosing a conflicting cloud day preserves unrelated local and remote days',async()=>{
  const base=snapshotRecords(make(date,7)),store=fresh();store.updateRating(date,8);store.updateRating('2026-10-19',6);
  const h=harness(store.exportSnapshot(),{base:[...base]});h.engine.enable();const remote=fresh();remote.updateRating(date,9);remote.updateRating(other,5);h.send(snapshotRecords(remote.exportSnapshot()));
  assert.equal(h.state.status,'conflict');h.engine.resolve('cloud');await h.engine.flush();
  assert.deepEqual(h.local.days.map(day=>[day.date,day.nutrition]),[[date,9],[other,5],['2026-10-19',6]]);h.engine.close();
});

test('closing a connection during an upload cannot update the next account or local workspace',async()=>{
  let release,receive,local=make(date,8),applied=0;
  const states=[],gate=new Promise(resolve=>{release=resolve;});
  const engine=createCloudEngine({readLocal:()=>local,applyLocal:value=>{local=value;applied++;},onState:value=>states.push(value.status),delay:1000000,
    transport:{subscribe:callback=>{receive=callback;return()=>{};},commit:()=>gate}});
  receive(new Map());engine.enable();const pending=engine.flush();engine.close();const count=states.length;
  release();await pending;receive(snapshotRecords(make(date,9)));
  assert.equal(states.length,count);assert.equal(applied,0);assert.equal(local.days[0].nutrition,8);
});

test('a delayed server acknowledgement keeps a newer local edit queued without a false conflict',async()=>{
  const base=snapshotRecords(make(date,7));let local=make(date,8),receive,state,lastChanges;
  const engine=createCloudEngine({readLocal:()=>local,applyLocal:value=>{local=value;},loadBase:()=>[...base],onState:value=>{state=value;},delay:1000000,
    transport:{subscribe:callback=>{receive=callback;return()=>{};},commit:async changes=>{lastChanges=changes;}}});
  engine.enable();receive(base);await engine.flush();local=make(date,9);
  const ack=new Map(base);for(const change of lastChanges)ack.set(change.id,change.after);receive(ack);
  assert.equal(local.days[0].nutrition,9);assert.equal(state.status,'pending');engine.close();
});

test('Sync now replaces a terminated listener and receives server records before sending again',async()=>{
  let receive,fail,state,subscriptions=0,stops=0,commits=0,local=make(date,7);
  const base=snapshotRecords(local);
  const engine=createCloudEngine({readLocal:()=>local,applyLocal:value=>{local=value;},loadBase:()=>[...base],onState:value=>{state=value;},delay:1000000,
    transport:{subscribe:(callback,onError)=>{subscriptions++;receive=callback;fail=onError;return()=>{stops++;};},commit:async()=>{commits++;}}});
  engine.enable();receive(base);fail(new Error('Quota temporarily exceeded'));
  assert.equal(state.status,'error');await engine.flush();assert.equal(commits,0);
  await engine.retry();assert.equal(subscriptions,2);assert.equal(stops,1);assert.equal(commits,0);
  receive(snapshotRecords(make(date,8)));assert.equal(local.days[0].nutrition,8);assert.equal(state.status,'synced');engine.close();
});
