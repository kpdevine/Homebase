import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,addDays,monthGrid,adjustScore} from '../prototype/model.mjs';
import {averageDays,summarizeDay} from '../prototype/scoring.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
const date='2026-10-16';
const read=store=>key=>summarizeDay(store.loadDay(key),store.loadTrainingDay(key));
test('tenth controls snap old quarter ratings in the requested direction and preserve typed precision',()=>{
 assert.equal(adjustScore(8.6,1),8.7);assert.equal(adjustScore(8.6,-1),8.5);
 assert.equal(adjustScore(8.75,1),8.8);assert.equal(adjustScore(8.75,-1),8.7);
 const store=createStore({seed:false});for(const rating of [8.6,8.25,9.99,1,10]){store.updateRating(date,rating);assert.equal(store.loadDay(date).nutrition,rating);validateSnapshot(store.exportSnapshot());}
 assert.throws(()=>store.updateRating(date,8.255));
});
test('optional dated notes round-trip and editing reopens only their section',()=>{
 const store=createStore({seed:false});store.updateRating(date,8.25);store.setTrainingMode(date,'rest');
 for(const section of ['nutrition','training','checklists','sentiments'])store.confirmSection(date,section);store.completeDay(date);
 store.updateNotes(date,'nutrition','Balanced meals. Ate late.\nCould prep lunch.');
 assert.equal(store.loadDay(date).completedAt,null);assert.deepEqual(store.loadDay(date).reviewed,{nutrition:false,training:true,checklists:true,sentiments:true});
 store.updateNotes(date,'training','Recovery day.');
 const restored=createStore({seed:false,snapshot:store.exportSnapshot()});
 assert.deepEqual(restored.loadDay(date).notes,store.loadDay(date).notes);assert.equal(restored.loadDay(date).nutrition,8.25);
 assert.deepEqual(restored.loadDay(addDays(date,1)).notes,{nutrition:'',training:''});
 restored.updateNotes(date,'nutrition','');assert.equal(restored.loadDay(date).notes.nutrition,'');
});
test('notes alone do not invent a score or satisfy a required check-in',()=>{
 const store=createStore({seed:false});store.updateNotes(date,'nutrition','Not rated yet');store.updateNotes(date,'training','Will log later');
 assert.equal(read(store)(date).score,null);assert.throws(()=>store.confirmSection(date,'nutrition'));assert.throws(()=>store.confirmSection(date,'training'));
});
test('old backups gain empty notes without changing legacy ratings or tasks',()=>{
 const old=createStore().exportSnapshot();old.days.forEach(day=>delete day.notes);
 const loaded=validateSnapshot(old);assert.deepEqual(loaded.days[0].notes,{nutrition:'',training:''});
 assert.equal(loaded.days[0].nutrition,old.days[0].nutrition);assert.deepEqual(loaded.days[0].tasks,old.days[0].tasks);
 assert.equal(old.days[0].notes,undefined);
});
test('notes bounds and malformed backup notes are rejected before mutations',()=>{
 const store=createStore({seed:false});store.updateNotes(date,'nutrition','x'.repeat(5000));const before=store.exportSnapshot();
 assert.throws(()=>store.updateNotes(date,'nutrition','x'.repeat(5001)));assert.throws(()=>store.updateNotes(date,'other','text'));
 assert.deepEqual(store.exportSnapshot(),before);
 for(const notes of [null,{}, {nutrition:3,training:''},{nutrition:'',training:'x'.repeat(5001)}]){const copy=structuredClone(before);copy.days[0].notes=notes;assert.throws(()=>validateSnapshot(copy));}
});
test('weekly averages use Monday to Sunday, while month averages include only that month',()=>{
 const store=createStore({seed:false});const ratings={'2026-09-28':5,'2026-09-29':6,'2026-10-01':8,'2026-10-02':9,'2026-10-03':10,'2026-10-04':10};
 for(const[key,value]of Object.entries(ratings))store.updateRating(key,value);
 const week=Array.from({length:7},(_,i)=>addDays('2026-09-28',i));
 const weekly=averageDays(week,read(store));assert.equal(weekly.score,8);assert.equal(weekly.count,6);assert.equal(weekly.total,7);assert.ok(weekly.provisional);
 const month=monthGrid('2026-10-01').filter(key=>key.startsWith('2026-10'));
 const monthly=averageDays(month,read(store));assert.equal(monthly.score,9.3);assert.equal(monthly.count,4);assert.equal(monthly.total,31);
 store.updateRating('2026-10-02',5);assert.equal(averageDays(week,read(store)).score,7.3);
});
test('averages distinguish unentered periods, partial daily inputs, and complete periods',()=>{
 assert.deepEqual(averageDays(['a','b'],()=>({score:null,provisional:true})),{score:null,count:0,total:2,provisional:true});
 assert.deepEqual(averageDays(['a','b'],()=>({score:8,provisional:false})),{score:8,count:2,total:2,provisional:false});
 assert.ok(averageDays(['a'],()=>({score:10,provisional:true})).provisional);
});
