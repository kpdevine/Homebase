import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {appDateKey,localDateKey,timeGreeting,lateCheckInWindow,createDayRollover} from '../prototype/day-clock.mjs';
import {createStore,addDays,sampleWeekStart} from '../prototype/model.mjs';
import {summarizeDay,loggingStreak} from '../prototype/scoring.mjs';
import {streakStats} from '../prototype/achievements.mjs';

test('the app day stays on yesterday through 00:59:59 and switches at 1 a.m.',()=>{
  const zone='America/Chicago';
  for(const [instant,expected] of [
    ['2026-10-21T04:59:59Z','2026-10-20'],
    ['2026-10-21T05:00:00Z','2026-10-20'],
    ['2026-10-21T05:59:59Z','2026-10-20'],
    ['2026-10-21T06:00:00Z','2026-10-21'],
  ])assert.equal(appDateKey(new Date(instant),zone),expected);
  assert.equal(localDateKey(new Date('2026-10-21T05:30:00Z'),zone),'2026-10-21','wall-clock dates remain available separately from record dates');
});

test('the grace hour crosses month, leap-day, and year boundaries by calendar date',()=>{
  for(const [instant,expected] of [
    ['2027-01-01T00:30:00Z','2026-12-31'],
    ['2028-03-01T00:59:59Z','2028-02-29'],
    ['2026-03-01T00:01:00Z','2026-02-28'],
    ['2026-11-01T01:00:00Z','2026-11-01'],
  ])assert.equal(appDateKey(new Date(instant),'UTC'),expected);
});

test('spring and repeated fall hours do not move a daily record backward after 1 a.m.',()=>{
  const zone='America/New_York';
  for(const instant of ['2026-11-01T05:00:00Z','2026-11-01T05:59:00Z','2026-11-01T06:00:00Z','2026-11-01T07:00:00Z'])
    assert.equal(appDateKey(new Date(instant),zone),'2026-11-01');
  assert.equal(appDateKey(new Date('2026-11-01T04:59:59Z'),zone),'2026-10-31');
  assert.equal(appDateKey(new Date('2026-03-08T05:59:59Z'),zone),'2026-03-07');
  for(const instant of ['2026-03-08T06:00:00Z','2026-03-08T06:59:59Z','2026-03-08T07:00:00Z'])
    assert.equal(appDateKey(new Date(instant),zone),'2026-03-08');
});

test('device-local defaults govern app day, calendar date, and greeting outside Chicago',()=>{
  const moduleURL=new URL('../prototype/day-clock.mjs',import.meta.url).href;
  for(const [zone,expected] of [
    ['Asia/Tokyo',['2026-10-20','2026-10-21','Good night']],
    ['America/Los_Angeles',['2026-10-20','2026-10-20','Good morning']],
  ]) {
    const child=spawnSync(process.execPath,['--input-type=module','-e',`import {appDateKey,localDateKey,timeGreeting} from ${JSON.stringify(moduleURL)};const at=new Date('2026-10-20T15:30:00Z');console.log(JSON.stringify([appDateKey(at),localDateKey(at),timeGreeting(at)]));`],{env:{...process.env,TZ:zone},encoding:'utf8'});
    assert.equal(child.status,0,child.stderr);
    assert.deepEqual(JSON.parse(child.stdout),expected,zone);
  }
});

test('late logging warnings remain active throughout the grace hour',()=>{
  for(const [time,expected] of [['20:59:59',false],['21:00:00',true],['23:59:59',true],['00:00:00',true],['00:59:59',true],['01:00:00',false]])
    assert.equal(lateCheckInWindow(new Date(`2026-10-21T${time}Z`),'UTC'),expected,time);
});

test('an open Today screen follows rollover after editing finishes, only once',()=>{
  const rollover=createDayRollover('2026-10-20');
  assert.equal(rollover.tick('2026-10-20'),null);
  assert.equal(rollover.tick('2026-10-21',{busy:true}),null);
  assert.equal(rollover.tick('2026-10-21',{busy:true}),null);
  assert.deepEqual(rollover.tick('2026-10-21'),{today:'2026-10-21',followToday:true});
  assert.equal(rollover.tick('2026-10-21'),null);
  assert.deepEqual(rollover.tick('2026-10-24'),{today:'2026-10-24',followToday:true},'resuming after several days catches up without intermediate changes');
});

test('explicit history/future selection stays selected, including navigation during a delayed rollover',()=>{
  for(const selected of ['2026-10-18','2026-10-23']) {
    const rollover=createDayRollover('2026-10-20');
    rollover.select(selected,'2026-10-20');
    assert.deepEqual(rollover.tick('2026-10-21'),{today:'2026-10-21',followToday:false});
  }
  const rollover=createDayRollover('2026-10-20');
  rollover.tick('2026-10-21',{busy:true});
  rollover.select('2026-10-20','2026-10-21');
  assert.equal(rollover.tick('2026-10-21'),null);
  rollover.select('2026-10-21','2026-10-21');
  assert.deepEqual(rollover.tick('2026-10-22'),{today:'2026-10-22',followToday:true});
});

test('Sunday training and rest credits stay in their Mon–Sun week until Monday at 1 a.m.',()=>{
  let now=new Date('2026-10-19T00:30:00Z');
  const today=()=>appDateKey(now,'UTC'),store=createStore({seed:false,editableToday:today});
  for(const date of ['2026-10-12','2026-10-13'])store.setTrainingMode(date,'rest');
  assert.equal(today(),'2026-10-18');
  assert.equal(sampleWeekStart(today()),'2026-10-12');
  assert.equal(store.loadWeek(today()).start,'2026-10-12');
  assert.equal(store.trainingProgress(today()).restCredits,0);
  store.addGymEntry(today(),'chest',3);
  now=new Date('2026-10-19T01:00:00Z');
  assert.equal(sampleWeekStart(today()),'2026-10-19');
  assert.equal(store.loadWeek(today()).start,'2026-10-19');
  assert.equal(store.trainingProgress(today()).restCredits,2);
  assert.equal(store.loadTrainingDay('2026-10-18')[0].sets,3,'existing dated logs stay on Sunday');
});

test('editing and task-planning windows, recurring dates, and streaks all use the active app day',()=>{
  let now=new Date('2026-10-21T00:30:00Z');
  const today=()=>appDateKey(now,'UTC'),store=createStore({seed:false,editableToday:today});
  const oldest=addDays(today(),-7),furthest=addDays(today(),7);
  store.updateRating(oldest,8);
  assert.throws(()=>store.updateRating(addDays(oldest,-1),8),/summary only/);
  store.addTask(furthest,'Next week');
  assert.throws(()=>store.addTask(addDays(furthest,1),'Too far'),/seven days/);
  store.addTask(today(),'Bedtime',{recurrence:{frequency:'daily',weekdays:[]}});
  store.toggleTask(today(),store.loadDay(today()).tasks[0].id);
  store.updateRating(today(),9);store.setTrainingMode(today(),'rest');
  const summary=date=>summarizeDay(store.loadDay(date),store.loadTrainingDay(date),store.loadWeek(date));
  assert.deepEqual(loggingStreak(today(),summary),{count:1,includesToday:true,endDate:'2026-10-20'});
  assert.equal(streakStats(['2026-10-20'],today()).includesToday,true);
  const before=store.exportSnapshot();
  now=new Date('2026-10-21T01:00:00Z');
  assert.throws(()=>store.updateRating(oldest,7),/summary only/);
  store.addTask(addDays(furthest,1),'Newly available');
  assert.equal(store.loadDay(today()).tasks.find(task=>task.templateId).done,false);
  assert.deepEqual(loggingStreak(today(),summary),{count:1,includesToday:false,endDate:'2026-10-20'});
  assert.equal(streakStats(['2026-10-20'],today()).current,1);
  const restored=createStore({seed:false,snapshot:before});
  assert.equal(restored.loadDay('2026-10-20').nutrition,9,'restored history never re-dates itself');
});
