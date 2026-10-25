import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {planetForScore,orbitalColor,orbitalCircle} from '../prototype/orbital-meter.mjs';
import {createStore,adjustScore} from '../prototype/model.mjs';
import {validateSnapshot} from '../prototype/persistence.mjs';
import {summarizeDay} from '../prototype/scoring.mjs';

test('all eleven planet bands resolve to shipped assets and change at their boundaries',async()=>{
  const paths=[];
  for(let score=0;score<=10;score++){
    const file=planetForScore(score);paths.push(file);
    await access(new URL('../prototype/'+file.slice(2),import.meta.url));
    if(score<10)assert.equal(planetForScore(score+.99),file);
  }
  assert.equal(new Set(paths).size,11);
  assert.equal(paths.filter(file=>file.includes('score-planets')).length,4);
  assert.equal(planetForScore(-1),paths[0]);assert.equal(planetForScore(11),paths[10]);
});
test('both orbital palettes stay valid and retain exact non-banded score fills',()=>{
  for(const theme of ['blue','mars'])for(let step=0;step<=100;step++)assert.match(orbitalColor(step/10,theme),/^#[a-f0-9]{6}$/);
  assert.notEqual(orbitalColor(7.1),orbitalColor(7.2));
  assert.notEqual(orbitalColor(7,'blue'),orbitalColor(7,'mars'));
  const zero=orbitalCircle(0,'0.0'),absent=orbitalCircle(null,'—'),perfect=orbitalCircle(10,'10');
  assert.match(zero,/stroke-dasharray="0 100" style="opacity:0"/);
  assert.match(absent,/no-score/);assert.match(perfect,/stroke-dasharray="100 100"/);
  assert.doesNotMatch(perfect,/orbital-planet|<img/);
});
test('zero Nutrition is a logged, reviewable score and survives validated restore',()=>{
  const date='2026-10-25',store=createStore({seed:false});
  assert.equal(store.loadDay(date).nutrition,null);
  store.updateRating(date,0);store.confirmSection(date,'nutrition');
  const snapshot=validateSnapshot(store.exportSnapshot()),restored=createStore({seed:false,snapshot});
  const day=restored.loadDay(date),summary=summarizeDay(day,restored.loadTrainingDay(date),restored.loadWeek(date));
  assert.equal(day.nutrition,0);assert.equal(day.reviewed.nutrition,true);
  assert.equal(summary.sections.find(section=>section.id==='nutrition').score,0);
  assert.equal(adjustScore(0,-1),0);assert.equal(adjustScore(.01,-1),0);
  restored.updateRating(date,null);assert.equal(restored.loadDay(date).nutrition,null);
});
