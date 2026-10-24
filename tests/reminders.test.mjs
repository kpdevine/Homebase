import test from 'node:test';
import assert from 'node:assert/strict';
import {localParts,reminderDate,validTimeZone,reminderDue,loggedFromRecord,validPushSubscription} from '../server/reminders/policy.mjs';
import {createStore} from '../prototype/model.mjs';
import {summarizeDay} from '../prototype/scoring.mjs';

test('reminders begin at 10:30pm in Chicago, skip logged days, and never repeat on a device',()=>{
  const device={time_zone:'America/Chicago',last_sent_date:null};
  assert.equal(reminderDue(device,null,new Date('2026-10-21T03:29:59Z')),false);
  assert.equal(reminderDue(device,null,new Date('2026-10-21T03:30:00Z')),true);
  assert.equal(reminderDue(device,{date:'2026-10-20',logged:1},new Date('2026-10-21T03:30:00Z')),false);
  assert.equal(reminderDue({...device,last_sent_date:'2026-10-20'},null,new Date('2026-10-21T04:59:00Z')),false);
  assert.equal(reminderDue(device,null,new Date('2026-10-21T05:00:00Z')),false);
  assert.equal(reminderDue({...device,last_sent_date:'2026-10-19'},{date:'2026-10-19',logged:1},new Date('2026-10-21T03:30:00Z')),true);
});
test('the nightly reminder follows daylight saving rather than a fixed UTC offset',()=>{
  assert.deepEqual(localParts(new Date('2026-11-03T04:30:00Z'),'America/Chicago'),{date:'2026-11-02',minutes:1350});
  assert.equal(localParts(new Date('2026-07-02T03:30:00Z'),'America/Chicago').minutes,1350);
});
test('logging suppression matches the app check-ins, including zero-score rest and blank reviewed tasks',()=>{
  const date='2026-10-21',store=createStore({seed:false});store.setTrainingMode('2026-10-19','rest');store.setTrainingMode('2026-10-20','rest');
  const check=()=>{
    const day=store.loadDay(date),entries=store.loadTrainingDay(date),record={day,entries};
    assert.equal(loggedFromRecord(record),summarizeDay(day,entries,store.loadWeek(date)).requiredLogged===3);
  };
  check();store.updateRating(date,1);check();store.setTrainingMode(date,'rest');check();assert.equal(summarizeDay(store.loadDay(date),[],store.loadWeek(date)).sections.find(section=>section.id==='training').score,0);store.addTask(date,'Not checked yet');check();
  store.confirmSection(date,'checklists');check();
  assert.equal(store.loadDay(date).completedAt,null);
  assert.equal(loggedFromRecord({day:store.loadDay(date),entries:[]}),true);
  assert.equal(loggedFromRecord(null),false);
});
test('subscriptions accept standard push services and reject arbitrary URLs, credentials, and malformed keys',()=>{
  const sample={endpoint:'https://web.push.apple.com/opaque-token',keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}};
  assert.equal(validPushSubscription(sample).endpoint,sample.endpoint);
  for(const endpoint of ['http://web.push.apple.com/token','https://web.push.apple.com.example.com/token','https://localhost/','https://user:pass@web.push.apple.com/token','https://web.push.apple.com:8443/token'])assert.throws(()=>validPushSubscription({...sample,endpoint}));
  assert.throws(()=>validPushSubscription({...sample,keys:{p256dh:'bad',auth:'bad'}}));
});
test('custom food and training check-ins suppress reminders only after their configured inputs are answered',()=>{
  const store=createStore({seed:false}),date='2026-10-21',settings=store.getSettings();settings.nutrition.mode='macros';settings.training.mode='other';store.setSettings(settings,date);
  store.updateFood(date,{protein:150,calories:2000});store.confirmSection(date,'checklists');store.setTrainingMode(date,'training');
  const check=()=>loggedFromRecord({day:store.loadDay(date),entries:[]});assert.equal(check(),false);store.updateTrainingMinutes(date,20);assert.equal(check(),true);store.setCreatine(date,true);assert.equal(check(),true);
});


test('reminder windows follow each device local timezone and daylight saving',()=>{
  const at=new Date('2026-10-22T02:30:00Z'),device=zone=>({time_zone:zone,last_sent_date:null});
  assert.equal(reminderDue(device('America/New_York'),null,at),true);
  assert.equal(reminderDue(device('America/Chicago'),null,at),false);
  assert.equal(reminderDue(device('America/Los_Angeles'),null,at),false);
  assert.equal(reminderDue(device('America/Los_Angeles'),null,new Date('2026-10-22T05:30:00Z')),true);
  assert.equal(reminderDue(device('Asia/Tokyo'),null,new Date('2026-10-22T13:30:00Z')),true);
  assert.equal(reminderDue(device('Asia/Kolkata'),null,new Date('2026-10-22T17:00:00Z')),true);
  assert.equal(reminderDue(device('America/New_York'),null,new Date('2026-11-03T03:30:00Z')),true);
  assert.equal(reminderDate(new Date('2026-10-22T04:30:00Z'),'America/New_York'),'2026-10-21');
  assert.equal(reminderDate(new Date('2026-10-22T05:00:00Z'),'America/New_York'),'2026-10-22');
  assert.equal(validTimeZone('Pacific/Auckland'),'Pacific/Auckland');
  for(const zone of [null,'','not/a-zone','x'.repeat(101)])assert.throws(()=>validTimeZone(zone));
});
