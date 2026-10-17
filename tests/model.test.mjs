import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_TODAY, addDays, adjustScore, createStore, meterPoint, monthGrid, moveMonth, sampleWeekStart, scoreFromPoint, scorePercent } from '../prototype/model.mjs';

test('all 91 tenth-step positions round-trip and dragging stays within the scale', () => {
  for (let step = 10; step <= 100; step++) {
    const score = step / 10;
    const point = meterPoint(score);
    assert.equal(scoreFromPoint(point.x, point.y, 110, 110), score);
  }
  assert.equal(scoreFromPoint(110, 110, 110, 110), null);
  for (let angle = 0; angle < 360; angle += 0.25) {
    const radians = angle * Math.PI / 180;
    const score = scoreFromPoint(110 + 82 * Math.cos(radians), 110 + 82 * Math.sin(radians), 110, 110);
    assert.ok(Math.abs(score * 10 - Math.round(score * 10)) < 1e-8 && score >= 1 && score <= 10);
  }
});

test('the bottom gap chooses the nearest endpoint instead of wrapping through a score', () => {
  const at = angle => scoreFromPoint(110 + 82 * Math.cos(angle * Math.PI / 180), 110 + 82 * Math.sin(angle * Math.PI / 180), 110, 110);
  assert.equal(at(60), 10);
  assert.equal(at(120), 1);
});

test('date arithmetic crosses month/year/leap boundaries without moving a calendar key', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-11-01', 1), '2026-11-02');
  assert.equal(sampleWeekStart('2026-10-18'), '2026-10-12');
  assert.equal(moveMonth('2026-12-31', 1), '2027-01-01');
  const grid = monthGrid('2026-10-15');
  assert.equal(grid.length, 35);
  assert.equal(grid[0], '2026-09-28');
  assert.equal(grid[34], '2026-11-01');
  assert.equal(monthGrid('2026-11-15').length, 42);
  assert.equal(monthGrid('2027-02-15').length, 28);
});

test('rating edits stay with their day, retain missing values, and leave illustrative overall untouched', () => {
  const store = createStore();
  const yesterday = addDays(DEMO_TODAY, -1);
  const original = store.loadDay(DEMO_TODAY);
  store.updateRating(yesterday, 3.7);
  assert.equal(store.loadDay(yesterday).nutrition, 3.7);
  assert.deepEqual(store.loadDay(DEMO_TODAY), original);
  store.updateRating(DEMO_TODAY, null);
  assert.equal(store.loadDay(DEMO_TODAY).nutrition, null);
  assert.equal(store.loadDay(DEMO_TODAY).sampleOverall, original.sampleOverall);
  for (const invalid of [0, 11, 2.555, NaN, Infinity, undefined, '7']) assert.throws(() => store.updateRating(DEMO_TODAY, invalid), RangeError);
  store.updateRating(DEMO_TODAY, 1);
  assert.equal(store.loadDay(DEMO_TODAY).nutrition, 1);
  assert.equal(store.loadDay('2027-01-01').nutrition, null);
});

test('tenth adjustments avoid floating-point drift and clamp at both ends', () => {
  let score = 1;
  for (let index = 0; index < 90; index++) score = adjustScore(score, 1);
  assert.equal(score, 10);
  assert.equal(adjustScore(score, 1), 10);
  for (let index = 0; index < 90; index++) score = adjustScore(score, -1);
  assert.equal(score, 1);
  assert.equal(adjustScore(score, -1), 1);
  assert.equal(adjustScore(null, 1), 1);
  assert.equal(adjustScore(null, -1), 1);
  assert.equal(adjustScore(7.9, 1), 8);
});

test('calendar circles use the daily score fraction and preserve an absent score', () => {
  assert.equal(scorePercent(7.6), 76);
  assert.equal(scorePercent(1), 10);
  assert.equal(scorePercent(10), 100);
  assert.equal(scorePercent(null), null);
  const store = createStore();
  store.updateRating(DEMO_TODAY, 9.8);
  assert.equal(scorePercent(store.loadDay(DEMO_TODAY).sampleOverall), 76);
});

test('task changes do not rewrite another day and returned records are detached', () => {
  const store = createStore();
  const day = store.loadDay(DEMO_TODAY);
  const previous = store.loadDay(addDays(DEMO_TODAY, -1));
  store.toggleTask(DEMO_TODAY, day.tasks[0].id);
  assert.notEqual(store.loadDay(DEMO_TODAY).tasks[0].done, day.tasks[0].done);
  assert.deepEqual(store.loadDay(addDays(DEMO_TODAY, -1)), previous);
  day.tasks[0].name = 'External mutation';
  assert.notEqual(store.loadDay(DEMO_TODAY).tasks[0].name, day.tasks[0].name);
  store.addTask('2027-01-01', '  A new intention  ');
  assert.equal(store.loadDay('2027-01-01').tasks[0].name, 'A new intention');
  assert.throws(() => store.addTask(DEMO_TODAY, '  '), RangeError);
  assert.throws(() => store.addTask(DEMO_TODAY, 'a'.repeat(101)), RangeError);
});

test('gym totals use dated entries, preserve actual over-target totals, and can undo an entry', () => {
  const store = createStore();
  const original = store.loadWeek(DEMO_TODAY);
  const entryId = store.addGymEntry(DEMO_TODAY, 'chest', 20);
  const current = store.loadWeek(DEMO_TODAY);
  assert.equal(current.groups.find(group => group.id === 'chest').completed, 28);
  assert.equal(current.groups.find(group => group.id === 'chest').target, 12);
  assert.equal(current.entries.at(-1).date, DEMO_TODAY);
  assert.equal(store.loadWeek('2026-10-19').entries.length, 0);
  store.removeGymEntry(entryId);
  assert.deepEqual(store.loadWeek(DEMO_TODAY), original);
  for (const invalid of [0, -2, 2.5, 101]) assert.throws(() => store.addGymEntry(DEMO_TODAY, 'chest', invalid), RangeError);
  assert.throws(() => store.addGymEntry(DEMO_TODAY, 'unknown', 3), RangeError);
  store.addGymEntry('2026-10-19', 'chest', 3);
  assert.equal(store.loadWeek('2026-10-19').groups.length, 0);
  assert.equal(store.loadTrainingDay('2026-10-19')[0].sets, 3);
  for (const entry of original.entries) store.removeGymEntry(entry.id);
  assert.equal(store.loadWeek(DEMO_TODAY).groups.length, 4);
  assert.ok(store.loadWeek(DEMO_TODAY).groups.every(group => group.completed === 0));
});

test('a day can only be completed after explicit review of all three sections', () => {
  const store = createStore();
  assert.throws(() => store.completeDay(DEMO_TODAY));
  store.confirmSection(DEMO_TODAY, 'nutrition');
  assert.throws(() => store.confirmSection(DEMO_TODAY, 'training'));
  store.setTrainingMode(DEMO_TODAY, 'rest');
  store.confirmSection(DEMO_TODAY, 'training');
  assert.throws(() => store.completeDay(DEMO_TODAY));
  store.confirmSection(DEMO_TODAY, 'checklists');
  // Reviewing a checklist does not require checking every task.
  assert.ok(store.loadDay(DEMO_TODAY).tasks.some(task => !task.done));
  store.completeDay(DEMO_TODAY);
  assert.ok(store.loadDay(DEMO_TODAY).completedAt);
});

test('missing nutrition and an unlogged workout cannot be confirmed', () => {
  const store = createStore();
  const key = '2026-10-20';
  assert.throws(() => store.confirmSection(key, 'nutrition'));
  store.setTrainingMode(key, 'training');
  assert.throws(() => store.confirmSection(key, 'training'));
  store.addGymEntry(key, 'legs', 4);
  store.confirmSection(key, 'training');
  assert.throws(() => store.setTrainingMode(key, 'rest'));
  assert.equal(store.loadDay(key).trainingMode, 'training');
  store.confirmSection(key, 'checklists'); // An explicitly reviewed empty list is valid.
  assert.equal(store.dayProgress(key).reviewedCount, 2);
});

test('edits reopen only the affected review and do not affect another date', () => {
  const store = createStore();
  store.setTrainingMode(DEMO_TODAY, 'rest');
  for (const section of ['nutrition', 'training', 'checklists']) store.confirmSection(DEMO_TODAY, section);
  store.completeDay(DEMO_TODAY);
  const other = store.loadDay('2026-10-14');
  store.updateRating(DEMO_TODAY, 7.8);
  assert.equal(store.loadDay(DEMO_TODAY).completedAt, null);
  assert.deepEqual(store.loadDay(DEMO_TODAY).reviewed, { nutrition: false, training: true, checklists: true });
  assert.deepEqual(store.loadDay('2026-10-14'), other);
  store.confirmSection(DEMO_TODAY, 'nutrition');
  store.completeDay(DEMO_TODAY);
  store.toggleTask(DEMO_TODAY, store.loadDay(DEMO_TODAY).tasks[0].id);
  assert.equal(store.dayProgress(DEMO_TODAY).canComplete, false);
  assert.equal(store.loadDay(DEMO_TODAY).reviewed.checklists, false);
});

test('removing the last workout entry invalidates training review and completion', () => {
  const store = createStore();
  const id = store.addGymEntry(DEMO_TODAY, 'chest', 3);
  for (const section of ['nutrition', 'training', 'checklists']) store.confirmSection(DEMO_TODAY, section);
  store.completeDay(DEMO_TODAY);
  store.removeGymEntry(id);
  assert.equal(store.loadDay(DEMO_TODAY).completedAt, null);
  assert.equal(store.dayProgress(DEMO_TODAY).sections.find(section => section.id === 'training').ready, false);
  assert.throws(() => store.completeDay(DEMO_TODAY));
});

test('starting a new store resets session changes', () => {
  const first = createStore();
  first.updateRating(DEMO_TODAY, 2);
  first.addTask(DEMO_TODAY, 'Only in this session');
  const reset = createStore();
  assert.equal(reset.loadDay(DEMO_TODAY).nutrition, 7);
  assert.equal(reset.loadDay(DEMO_TODAY).tasks.length, 4);
});
