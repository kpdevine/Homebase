import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,meterPoint,scoreFromPoint} from '../prototype/model.mjs';
import {summarizeDay,loggingStreak,averageDays} from '../prototype/scoring.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {dailyRecap} from '../prototype/recap.mjs';
const date='2026-10-17';
const summary=store=>summarizeDay(store.loadDay(date),store.loadTrainingDay(date));
function logged(){const store=createStore({seed:false});store.updateRating(date,8);store.setTrainingMode(date,'rest');store.setCreatine(date,true);for(const section of ['nutrition','training','checklists','sentiments'])store.confirmSection(date,section);return store;}

test('all 101 sentiment positions round-trip on the zero-to-ten circular scale',()=>{
  for(let tenth=0;tenth<=100;tenth++){const point=meterPoint(1+tenth*.09);assert.equal(scoreFromPoint(point.x,point.y,110,110,{min:0,max:10}),tenth/10);}
  assert.equal(scoreFromPoint(110,110,110,110,{min:0,max:10}),null);
});
test('notes are unscored; an optional zero adds an equal component with flexible rest included; removal restores the score',()=>{
  const store=logged(),original=summary(store).score;
  store.updateSentiments(date,{notes:'A quiet day.'});assert.equal(summary(store).score,original);
  store.updateSentiments(date,{rating:0});assert.equal(summary(store).score,7);assert.equal(summary(store).logged,4);assert.equal(summary(store).provisional,false);
  store.updateSentiments(date,{rating:8});assert.equal(summary(store).score,9);
  store.updateSentiments(date,{rating:null});assert.equal(summary(store).score,original);
});
test('optional sentiments do not satisfy required logging or change streak requirements',()=>{
  const store=createStore({seed:false});store.updateSentiments(date,{rating:10});assert.equal(summary(store).provisional,true);
  assert.equal(loggingStreak(date,key=>summarizeDay(store.loadDay(key))).count,0);
  const full=logged();full.updateSentiments(date,{rating:0});assert.equal(loggingStreak(date,key=>summarizeDay(full.loadDay(key))).count,1);
  assert.equal(averageDays([date],()=>summary(full)).score,7);
});
test('sentiments persist per date, migrate old backups, and reopen only final completion',()=>{
  const store=logged();store.completeDay(date);store.updateSentiments(date,{notes:'Finished a project.',rating:7.3});
  assert.equal(store.loadDay(date).completedAt,null);assert.deepEqual(store.loadDay(date).reviewed,{nutrition:true,training:true,checklists:true});
  const restored=createStore({seed:false,snapshot:store.exportSnapshot()});assert.deepEqual(restored.loadDay(date).sentiments,{notes:'Finished a project.',rating:7.3});
  assert.deepEqual(restored.loadDay('2026-10-18').sentiments,{notes:'',rating:null});
  const old=store.exportSnapshot();delete old.days[0].sentiments;assert.deepEqual(validateSnapshot(old).days[0].sentiments,{notes:'',rating:null});
});
test('invalid sentiment inputs are rejected without changing stored data',()=>{
  const store=logged(),before=store.exportSnapshot();
  for(const rating of [-1,10.1,7.35,NaN,Infinity,'8'])assert.throws(()=>store.updateSentiments(date,{rating}));
  assert.throws(()=>store.updateSentiments(date,{notes:'a'.repeat(5001)}));assert.deepEqual(store.exportSnapshot(),before);
  const backup=store.exportSnapshot();backup.days[0].sentiments.rating=7.35;assert.throws(()=>validateSnapshot(backup));
});
test('notes-only recaps show activity without inventing a rating',()=>{
  const store=createStore({seed:false});store.updateSentiments(date,{notes:'Something to remember.'});
  assert.equal(dailyRecap(store.loadDay(date)).hasActivity,true);assert.equal(summary(store).score,null);
});

test('sentiments always have a review checkoff, including empty, notes-only, and rating-only entries',()=>{
  const store=logged();
  store.updateSentiments(date,{rating:7});
  assert.equal(store.dayProgress(date).sections.length,4);
  store.updateSentiments(date,{notes:'Felt strong today.'});
  assert.deepEqual(store.dayProgress(date).sections.at(-1),{id:'sentiments',label:'Sentiments',ready:true,reviewed:false});
  assert.equal(store.dayProgress(date).canComplete,false);
  assert.throws(()=>store.completeDay(date));
  store.confirmSection(date,'sentiments');
  assert.equal(store.dayProgress(date).canComplete,true);
  store.completeDay(date);
  const restored=createStore({seed:false,snapshot:store.exportSnapshot()});
  assert.equal(restored.dayProgress(date).sections.at(-1).reviewed,true);
  restored.updateSentiments(date,{rating:8});
  assert.equal(restored.dayProgress(date).canComplete,false);
  assert.equal(restored.loadDay(date).completedAt,null);
  restored.updateSentiments(date,{notes:''});
  assert.equal(restored.dayProgress(date).sections.length,4);
  assert.equal(restored.dayProgress(date).canComplete,false);
  restored.confirmSection(date,'sentiments');
  assert.equal(restored.dayProgress(date).canComplete,true);
});

test('a blank sentiments review persists without adding a score, a logged category, or writing activity',()=>{
  const store=createStore({seed:false}),before=summary(store);
  store.confirmSection(date,'sentiments');
  assert.equal(store.dayProgress(date).sections.at(-1).reviewed,true);
  const restored=createStore({seed:false,snapshot:store.exportSnapshot()});
  assert.deepEqual(summary(restored),before);
  assert.equal(dailyRecap(restored.loadDay(date)).hasActivity,false);
  assert.equal(restored.dayProgress(date).sections.at(-1).reviewed,true);
  restored.updateSentiments(date,{notes:'Something happened.'});
  assert.equal(restored.dayProgress(date).sections.at(-1).reviewed,false);
});

test('older completed blank days retain completion without creating a new saved review flag on read',()=>{
  const old=logged().exportSnapshot();delete old.days[0].reviewed.sentiments;
  old.days[0].completedAt='2026-10-17T22:00:00.000Z';
  const restored=createStore({seed:false,snapshot:old});
  assert.equal(restored.dayProgress(date).canComplete,true);
  assert.equal(restored.loadDay(date).reviewed.sentiments,undefined);
  assert.deepEqual(restored.exportSnapshot(),old);
});

test('older completed days with rated sentiments keep their completed review',()=>{
  const store=logged();store.updateSentiments(date,{notes:'A good day.',rating:9});
  const old=store.exportSnapshot();old.days[0].completedAt=new Date().toISOString();
  const restored=createStore({seed:false,snapshot:old});
  assert.equal(restored.dayProgress(date).completedAt,old.days[0].completedAt);
  assert.equal(restored.dayProgress(date).sections.at(-1).reviewed,true);
});
