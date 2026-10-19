import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../prototype/model.mjs';
import { validateSnapshot } from '../prototype/persistence.mjs';

test('whole-day comments persist without changing section notes, reviews, scores or completion',()=>{
  const date='2026-10-17',store=createStore({seed:false});
  store.updateRating(date,8.4);store.setTrainingMode(date,'rest');
  store.updateNotes(date,'nutrition','A nutrition-only explanation.');
  for(const id of ['nutrition','training','checklists','sentiments'])store.confirmSection(date,id);
  store.completeDay(date);
  const before=store.loadDay(date);
  store.updateDayComment(date,'A good day overall.\nTomorrow: start earlier.');
  const restored=createStore({seed:false,snapshot:store.exportSnapshot()});
  const after=restored.loadDay(date);
  assert.equal(after.comment,'A good day overall.\nTomorrow: start earlier.');
  assert.deepEqual(after.notes,before.notes);assert.deepEqual(after.reviewed,before.reviewed);
  assert.equal(after.completedAt,before.completedAt);assert.equal(after.nutrition,before.nutrition);
  assert.equal(restored.loadDay('2026-10-16').comment,'');
});

test('older backups gain an empty day comment and malformed or oversized comments are rejected',()=>{
  const store=createStore({seed:false});store.updateRating('2026-10-17',7);
  const old=store.exportSnapshot();delete old.days[0].comment;
  assert.equal(validateSnapshot(old).days[0].comment,'');
  for(const bad of [42,'x'.repeat(5001)]) {
    const snapshot=structuredClone(old);snapshot.days[0].comment=bad;
    assert.throws(()=>validateSnapshot(snapshot),/day comment/);
    assert.throws(()=>store.updateDayComment('2026-10-17',bad));
  }
});
