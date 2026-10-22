import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createReminderWorker} from '../worker.mjs';

function database() {
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  return {raw:db,prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return db.prepare(sql).run(...args);}};}};
}
const subscription={endpoint:'https://web.push.apple.com/fake-test-only',keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}};
function request(path,body,token='user-a',origin='https://pocketplanet.day') {
  return new Request('https://reminders.example'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({timeZone:'America/Chicago',...body})});
}
test('authenticated subscription, cross-device logging suppression, one delivery per day, and owner-only disable',async()=>{
  const env={DB:database(),VAPID_PUBLIC_KEY:'test',VAPID_PRIVATE_KEY:'test'};let logged=false,sent=0,at=new Date('2026-10-21T03:30:00Z');
  const worker=createReminderWorker({verify:async token=>{if(!['user-a','user-b'].includes(token))throw Error();return token;},readLogged:async()=>logged,now:()=>at,send:async()=>{sent++;return {ok:true,status:201};}});
  assert.equal((await worker.fetch(request('/subscribe',{subscription},'invalid'),env)).status,401);
  assert.equal((await worker.fetch(request('/subscribe',{subscription},'user-a','https://evil.example'),env)).status,403);
  assert.equal((await worker.fetch(request('/subscribe',{subscription}),env)).status,200);
  assert.equal((await worker.fetch(request('/subscribe',{subscription},'user-b'),env)).status,409);
  logged=true;await worker.fetch(request('/state',{}),env);await worker.scheduled({},env,{});assert.equal(sent,0);
  logged=false;await worker.fetch(request('/state',{}),env);await Promise.all([worker.scheduled({},env,{}),worker.scheduled({},env,{})]);assert.equal(sent,1);
  await worker.scheduled({},env,{});assert.equal(sent,1);
  at=new Date('2026-10-22T03:30:00Z');await worker.scheduled({},env,{});assert.equal(sent,2);
  await worker.fetch(request('/unsubscribe',{endpoint:subscription.endpoint},'user-b'),env);assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM devices').first()).count,1);
  await worker.fetch(request('/unsubscribe',{endpoint:subscription.endpoint}),env);assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM devices').first()).count,0);
});
test('expired push subscriptions are removed and permission errors cannot trigger an unbounded retry',async()=>{
  for(const status of [410,403]) {
    const env={DB:database()};let sent=0;
    const worker=createReminderWorker({verify:async()=> 'user-a',readLogged:async()=>false,now:()=>new Date('2026-10-21T03:30:00Z'),send:async()=>{sent++;return {ok:false,status};}});
    await worker.fetch(request('/subscribe',{subscription}),env);await worker.scheduled({},env,{});await worker.scheduled({},env,{});
    assert.equal(sent,1);assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM devices').first()).count,status===410?0:1);
  }
});


test('the scheduler evaluates each device timezone instead of a Central-time scan window',async()=>{
  const env={DB:database()},sent=[];let at=new Date('2026-10-22T02:29:00Z');
  const worker=createReminderWorker({verify:async token=>token,readLogged:async()=>false,now:()=>at,send:async(sub,message)=>{sent.push({endpoint:sub.endpoint,date:message.date});return {ok:true,status:201};}});
  const east={...subscription,endpoint:subscription.endpoint+'-east'},west={...subscription,endpoint:subscription.endpoint+'-west'};
  await worker.fetch(request('/subscribe',{subscription:east,timeZone:'America/New_York'}),env);
  await worker.fetch(request('/subscribe',{subscription:west,timeZone:'America/Los_Angeles'}),env);
  await worker.scheduled({},env,{});assert.equal(sent.length,0);
  at=new Date('2026-10-22T02:30:00Z');await worker.scheduled({},env,{});assert.deepEqual(sent,[{endpoint:east.endpoint,date:'2026-10-21'}]);
  at=new Date('2026-10-22T05:30:00Z');await worker.scheduled({},env,{});assert.deepEqual(sent[1],{endpoint:west.endpoint,date:'2026-10-21'});
  await worker.scheduled({},env,{});assert.equal(sent.length,2);
});

test('state refresh updates only the current owned device timezone and checks all device-local record dates',async()=>{
  const env={DB:database()},dates=[];const at=new Date('2026-10-22T02:30:00Z');
  const worker=createReminderWorker({verify:async token=>token,readLogged:async(uid,token,date)=>{dates.push(date);return true;},now:()=>at});
  const first={...subscription,endpoint:subscription.endpoint+'-first'},second={...subscription,endpoint:subscription.endpoint+'-second'};
  await worker.fetch(request('/subscribe',{subscription:first,timeZone:'America/Chicago'}),env);
  await worker.fetch(request('/subscribe',{subscription:second,timeZone:'Asia/Tokyo'}),env);
  dates.length=0;
  assert.equal((await worker.fetch(request('/state',{endpoint:first.endpoint,timeZone:'America/New_York'}),env)).status,200);
  assert.deepEqual(new Set(dates),new Set(['2026-10-21','2026-10-22']));
  const zones=env.DB.raw.prepare('SELECT time_zone FROM devices ORDER BY time_zone').all().map(row=>row.time_zone);
  assert.deepEqual(zones,['America/New_York','Asia/Tokyo']);
  await worker.fetch(request('/state',{endpoint:first.endpoint,timeZone:'Europe/London'},'user-b'),env);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS count FROM devices WHERE time_zone='America/New_York'").get().count,1);
  assert.equal((await worker.fetch(request('/subscribe',{subscription:first,timeZone:'bogus'}),env)).status,400);
  dates.length=0;await worker.fetch(request('/state',{},'user-a'),env);assert.deepEqual(new Set(dates),new Set(['2026-10-21','2026-10-22']));
});
