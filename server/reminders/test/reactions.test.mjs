import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {cloudReaction,reactionRequest,deliverReaction} from '../reaction-events.mjs';
import {createReminderWorker} from '../worker.mjs';
const at=new Date('2026-10-26T03:10:00Z'),input={scope:'vibes',group:'orbit',target:'recipient'};
const event={...input,actor:'reactor',version:'status-version-1',username:'planet_friend',kind:'fire',label:'On fire'};
const sub={endpoint:'https://web.push.apple.com/test-only',keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}};
function database(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));return {raw:db,prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return db.prepare(sql).run(...args);}};}};}
function register(db,id,uid){db.raw.prepare('INSERT INTO devices(id,uid,subscription,time_zone,created_at) VALUES(?,?,?,?,?)').run(id,uid,JSON.stringify({...sub,endpoint:sub.endpoint+'-'+id}),'America/Chicago',at.getTime());}
const s=stringValue=>({stringValue}),t=timestampValue=>({timestampValue});
function fixture(){return {reaction:{target:s('recipient'),reactor:s('reactor'),username:s('planet_friend'),kind:s('fire'),version:s('status-version-1'),updatedAt:t(at.toISOString())},item:{vibes:s('Private status text is never in the push'),vibesVersion:s('status-version-1')},member:{uid:s('recipient')}};}
function reader(values,calls=[]){return async(url,options)=>{calls.push({url,options});const key=url.includes('/vibeReactions/')||url.includes('/reactions/')?'reaction':url.includes('/members/')?'member':'item';return new Response(values[key]?JSON.stringify({fields:values[key]}):null,{status:values[key]?200:404,headers:{'Content-Type':'application/json'}});};}
test('server derives notification details from a fresh saved reaction and verifies its current status',async()=>{
  const data=fixture(),calls=[];const result=await cloudReaction('reactor','actor-token',{...input,username:'forged',kind:'love'},at,{fetcher:reader(data,calls)});
  assert.deepEqual(result,event);assert.equal(calls.length,3);
  for(const call of calls){assert.equal(call.options.headers.Authorization,'Bearer actor-token');assert.equal(call.url.includes('/users/'),false);}
  const day={scope:'day',group:'orbit',target:'recipient',date:'2026-10-25'};data.reaction.date=s(day.date);delete data.reaction.version;
  assert.equal((await cloudReaction('reactor','token',day,at,{fetcher:reader(data)})).version,day.date);
});
test('self reactions, removed members, old/missing reactions and outdated statuses cannot notify',async()=>{
  let reads=0;assert.equal(await cloudReaction('recipient','token',input,at,{fetcher:async()=>{reads++;}}),null);assert.equal(reads,0);
  for(const change of [data=>data.member=null,data=>data.reaction=null,data=>data.reaction.reactor=s('forged'),data=>data.reaction.updatedAt=t(new Date(at.getTime()-121000).toISOString()),data=>data.item.vibesVersion=s('new-version'),data=>data.item.vibes=s(''),data=>data.reaction.kind=s('unknown')]){
    const data=fixture();change(data);assert.equal(await cloudReaction('reactor','token',input,at,{fetcher:reader(data)}),null);
  }
  for(const body of [{...input,target:'../other'},{...input,group:'bad/path'},{...input,scope:'other'},{...input,scope:'day',date:'bogus'}])assert.throws(()=>reactionRequest(body));
});
test('only recipient devices get one alert per reactor and item, even with simultaneous retries or changed emoji',async()=>{
  const DB=database();register(DB,'one','recipient');register(DB,'two','recipient');register(DB,'actor','reactor');register(DB,'other','outsider');const sent=[];
  const send=async(subscription,message)=>{sent.push({subscription,message});return {ok:true,status:201};};
  await Promise.all([deliverReaction(event,{DB},{send,now:at}),deliverReaction(event,{DB},{send,now:at})]);
  assert.equal(sent.length,2);assert.ok(sent.every(row=>/-(one|two)$/.test(row.subscription.endpoint)));
  assert.ok(sent.every(row=>row.message.body==='@planet_friend reacted to your Current vibes (On fire).'));
  assert.ok(sent.every(row=>!JSON.stringify(row.message).includes('Private status')));
  await deliverReaction({...event,kind:'love',label:'Love'},{DB},{send,now:at});assert.equal(sent.length,2);
  await deliverReaction({...event,version:'new-status-version'},{DB},{send,now:at});assert.equal(sent.length,4);
  await deliverReaction({...event,scope:'day',version:'2026-10-25',date:'2026-10-25'},{DB},{send,now:at});assert.equal(sent.length,6);
  assert.equal(DB.raw.prepare('SELECT last_sent_date FROM devices WHERE id=?').get('one').last_sent_date,null);
});
test('reaction alerts do not depend on daily logging and require authentication and a verified event',async()=>{
  const DB=database();register(DB,'one','recipient');let sent=0,reads=0;
  const worker=createReminderWorker({now:()=>at,verify:async token=>{if(token!=='valid')throw Error();return 'reactor';},readReaction:async()=>{reads++;return event;},send:async()=>{sent++;return {ok:true,status:201};}});
  const request=(token='valid',body=input)=>new Request('https://service.example/reaction',{method:'POST',headers:{Origin:'https://pocketplanet.day',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await worker.fetch(request('bad'),{DB})).status,401);assert.equal(reads,0);
  assert.equal((await worker.fetch(request('valid',{...input,target:'../bad'}),{DB})).status,400);assert.equal(reads,0);
  assert.equal((await worker.fetch(request(),{DB})).status,200);assert.equal(sent,1);
  assert.equal((await worker.fetch(request(),{DB})).status,200);assert.equal(sent,1);
});
test('expired recipient devices are removed, transient failures are bounded, and event bursts are capped',async()=>{
  const DB=database();register(DB,'expired','recipient');register(DB,'active','recipient');let sent=0;
  const send=async sub=>{sent++;if(sub.endpoint.endsWith('-expired'))return {ok:false,status:410};throw new TypeError('network');};
  await deliverReaction(event,{DB},{send,now:at});assert.equal(DB.raw.prepare('SELECT COUNT(*) AS count FROM devices').get().count,1);
  for(let index=1;index<25;index++)await deliverReaction({...event,version:'version-'+index},{DB},{send,now:at});
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS count FROM reaction_notifications').get().count,20);assert.equal(sent,21);
});

test('mogging saved reactions resolve their notification name',async()=>{
  const data=fixture();data.reaction.kind=s('mogging');
  const result=await cloudReaction('reactor','actor-token',input,at,{fetcher:reader(data)});
  assert.equal(result.kind,'mogging');assert.equal(result.label,'Mogging');
});
