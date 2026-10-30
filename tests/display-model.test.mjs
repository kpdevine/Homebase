import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, DEMO_TODAY, addDays, GROUPS } from '../prototype/model.mjs';
import { scoreColor, summarizeDay, localDateKey } from '../prototype/scoring.mjs';
import { readLocal, writeLocal, validateSnapshot, STORAGE_KEY } from '../prototype/persistence.mjs';

const memoryStorage = () => {
  const data = new Map();
  return { getItem:key => data.get(key) ?? null, setItem:(key,value) => data.set(key,value) };
};
test('daily score uses entered sections and explicitly labels partial input', () => {
  const store = createStore({ seed:false });
  let summary = summarizeDay(store.loadDay(DEMO_TODAY), []);
  assert.equal(summary.score, null); assert.equal(summary.logged, 0); assert.ok(summary.provisional);
  store.updateRating(DEMO_TODAY, 8.6);
  assert.equal(summarizeDay(store.loadDay(DEMO_TODAY), []).score, 8.6);
  store.addTask(DEMO_TODAY, 'First'); store.addTask(DEMO_TODAY, 'Second');
  store.toggleTask(DEMO_TODAY, store.loadDay(DEMO_TODAY).tasks[0].id);
  summary = summarizeDay(store.loadDay(DEMO_TODAY), []);
  assert.equal(summary.score, 6.8); assert.equal(summary.logged, 2);
  store.setTrainingMode(DEMO_TODAY, 'rest');
  summary = summarizeDay(store.loadDay(DEMO_TODAY), []);
  assert.equal(summary.score, 7.5); assert.equal(summary.logged, 3); assert.equal(summary.provisional, false);
});
test('perfect day is ten, unfinished tasks lower it, and an empty checklist needs review', () => {
  const store = createStore({ seed:false });
  store.updateRating(DEMO_TODAY, 10); store.setTrainingMode(DEMO_TODAY, 'rest'); store.setCreatine(DEMO_TODAY,true);
  assert.equal(summarizeDay(store.loadDay(DEMO_TODAY), []).logged, 2);
  store.confirmSection(DEMO_TODAY, 'checklists');
  assert.equal(summarizeDay(store.loadDay(DEMO_TODAY), []).score, 10);
  store.addTask(DEMO_TODAY, 'Unfinished');
  assert.equal(summarizeDay(store.loadDay(DEMO_TODAY), []).score, 6.7);
  store.toggleTask(DEMO_TODAY, store.loadDay(DEMO_TODAY).tasks[0].id);
  assert.equal(summarizeDay(store.loadDay(DEMO_TODAY), []).score, 10);
});
test('removing the last set preserves gym attendance instead of inventing a perfect rest day', () => {
  const store = createStore({ seed:false });
  const id = store.addGymEntry(DEMO_TODAY, 'chest', 3);
  let summary = summarizeDay(store.loadDay(DEMO_TODAY), store.loadTrainingDay(DEMO_TODAY));
  assert.equal(summary.sections[1].score, 4.8); assert.equal(summary.score, 4.8); assert.ok(summary.provisional);
  store.removeGymEntry(id);
  summary = summarizeDay(store.loadDay(DEMO_TODAY), store.loadTrainingDay(DEMO_TODAY));
  assert.equal(summary.sections[1].score, 3.6); assert.equal(summary.score, 3.6);
  assert.equal(store.loadDay(DEMO_TODAY).trainingMode,'training');
  assert.equal(store.trainingProgress(DEMO_TODAY).restCredits,2);
  store.setTrainingMode(DEMO_TODAY,'rest');
  assert.equal(store.trainingProgress(DEMO_TODAY).score,9);
  assert.equal(store.trainingProgress(DEMO_TODAY).restCredits,1);
});
test('continuous LCD palette brightens from indigo through blue to ice without threshold jumps', () => {
  assert.equal(scoreColor(0), '#1c285e'); assert.equal(scoreColor(10), '#f8fdff');
  assert.equal(scoreColor(12), scoreColor(10)); assert.equal(scoreColor(-3), scoreColor(0)); assert.equal(scoreColor(null), '#6682b5');
  assert.notEqual(scoreColor(7.1), scoreColor(7.2));
  const rgb = color => [1,3,5].map(index => parseInt(color.slice(index,index+2),16));
  assert.ok(rgb(scoreColor(8))[0]>114 && rgb(scoreColor(8))[0]<175,'eight remains brighter than the former seven but needs more effort to reach the former eight');
  assert.ok(rgb(scoreColor(9))[0]<228,'full icy white is held back beyond nine');
  for (let step=1;step<=100;step++) {
    const before=rgb(scoreColor((step-1)/10)),after=rgb(scoreColor(step/10));
    assert.ok(after.every((part,index)=>Math.abs(part-before[index])<=7));
  }
});
test('local calendar date and clock timezone survive UTC midnight and DST', () => {
  assert.equal(localDateKey(new Date('2026-10-17T02:00:00Z'), 'America/Chicago'), '2026-10-16');
  assert.equal(localDateKey(new Date('2026-11-01T07:30:00Z'), 'America/Chicago'), '2026-11-01');
});
test('saved snapshots restore dated entries, targets, review, completion and safe IDs', () => {
  const original=createStore({seed:false});
  original.updateRating(DEMO_TODAY,9.3); original.addTask(DEMO_TODAY,'My task');
  original.addGymEntry(DEMO_TODAY,'legs',4);
  original.setWeekTargets(DEMO_TODAY,GROUPS.map(group=>({id:group.id,target:20})));
  for (const id of ['nutrition','training','checklists','sentiments']) original.confirmSection(DEMO_TODAY,id);
  original.completeDay(DEMO_TODAY);
  const storage=memoryStorage(); writeLocal(storage,original.exportSnapshot());
  const result=readLocal(storage); assert.equal(result.error,null);
  const restored=createStore({snapshot:result.snapshot,seed:false});
  assert.deepEqual(restored.loadDay(DEMO_TODAY),original.loadDay(DEMO_TODAY));
  assert.equal(restored.loadTrainingDay(DEMO_TODAY)[0].sets,4);
  assert.ok(restored.loadWeek(DEMO_TODAY).groups.every(group=>group.target===20));
  restored.addTask(DEMO_TODAY,'Another task');
  const ids=restored.exportSnapshot().days.flatMap(day=>day.tasks.map(task=>task.id));
  assert.equal(ids.length,new Set(ids).size);
  assert.equal(restored.loadDay(DEMO_TODAY).completedAt,null);
  assert.deepEqual(restored.loadDay(DEMO_TODAY).reviewed,{nutrition:true,training:true,checklists:false,sentiments:true});
});
test('corrupt saved data is returned for recovery and never overwritten on read', () => {
  const storage=memoryStorage(); storage.setItem(STORAGE_KEY,'{"version":1,"days":');
  const result=readLocal(storage); assert.ok(result.error); assert.equal(result.snapshot,null);
  assert.equal(result.raw,storage.getItem(STORAGE_KEY));
  const denied={getItem(){throw new Error('Storage denied');}};
  assert.equal(readLocal(denied).error,'Storage denied');
});
test('invalid imports reject inconsistent records and cannot corrupt saved data', () => {
  const valid=createStore().exportSnapshot();
  const changes=[
    snapshot=>snapshot.version=99,
    snapshot=>snapshot.days[0].nutrition=4.555,
    snapshot=>snapshot.days[0].date='2026-02-30',
    snapshot=>snapshot.days[0].tasks[0].name=' ',
    snapshot=>snapshot.days[0].tasks[0].id='unsafe"selector',
    snapshot=>snapshot.days.push(snapshot.days[0]),
    snapshot=>snapshot.entries[0].sets=2.5,
    snapshot=>snapshot.serial=0,
    snapshot=>{const day=snapshot.days.find(day=>day.date===snapshot.entries[0].date);day.trainingMode='rest';},
    snapshot=>snapshot.days[0].completedAt='not a timestamp',
  ];
  for(const change of changes){const copy=structuredClone(valid);change(copy);assert.throws(()=>validateSnapshot(copy));}
  const storage=memoryStorage();writeLocal(storage,valid);const before=storage.getItem(STORAGE_KEY);
  const invalid=structuredClone(valid);invalid.days[0].reviewed.nutrition=true;invalid.days[0].nutrition=null;
  assert.throws(()=>writeLocal(storage,invalid));assert.equal(storage.getItem(STORAGE_KEY),before);
});
test('task deletion can be undone without duplicating IDs or changing other dates', () => {
  const store=createStore();const day=store.loadDay(DEMO_TODAY);const other=store.loadDay(addDays(DEMO_TODAY,-1));
  const removed=store.removeTask(DEMO_TODAY,day.tasks[1].id);
  assert.equal(store.loadDay(DEMO_TODAY).tasks.length,day.tasks.length-1);
  store.restoreTask(DEMO_TODAY,removed.task,removed.index);
  assert.deepEqual(store.loadDay(DEMO_TODAY).tasks,day.tasks);
  assert.deepEqual(store.loadDay(addDays(DEMO_TODAY,-1)),other);
  assert.throws(()=>store.restoreTask(DEMO_TODAY,removed.task,0));
});
test('target editing is per week and rejected targets leave the week intact', () => {
  const store=createStore(),before=store.loadWeek(DEMO_TODAY);
  const next=addDays(before.end,1);store.setWeekTargets(next,GROUPS.map(group=>({id:group.id,target:8})));
  assert.deepEqual(store.loadWeek(DEMO_TODAY),before);
  assert.ok(store.loadWeek(next).groups.every(group=>group.target===8));
  assert.throws(()=>store.setWeekTargets(next,[{id:'chest',target:1}]));
  assert.throws(()=>store.setWeekTargets(next,GROUPS.map(group=>({id:group.id,target:-1}))));
});
test('change hook emits a valid detached snapshot only after successful mutations', () => {
  const changes=[];const store=createStore({seed:false,onChange:snapshot=>changes.push(snapshot)});
  store.addTask(DEMO_TODAY,'One');assert.equal(changes.length,1);validateSnapshot(changes[0]);
  assert.throws(()=>store.updateRating(DEMO_TODAY,-.01));assert.equal(changes.length,1);
  changes[0].days[0].tasks[0].name='External';assert.equal(store.loadDay(DEMO_TODAY).tasks[0].name,'One');
});
