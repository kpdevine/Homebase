import test from 'node:test';
import assert from 'node:assert/strict';
import {needsWelcome,profileName} from '../prototype/onboarding.mjs';
import {activeTemplates} from '../prototype/tasks.mjs';
import {createStore,addDays} from '../prototype/model.mjs';

test('new personal workspaces prompt for a name or Google sign-in, including after an empty first save',()=>{
  assert.equal(needsWelcome({preferences:{},snapshot:null}),true);
  assert.equal(needsWelcome({preferences:{welcomeGooglePending:true},snapshot:{days:[],entries:[],templates:[]}}),true);
});
test('welcome never blocks previews, existing records, named users, or recovery',()=>{
  for(const setup of [{preview:true},{error:'Recovery needed'},{preferences:{welcomed:true}},{preferences:{name:' Kieran '}},
    {snapshot:{days:[{date:'2026-10-18'}]}},{snapshot:{entries:[{}]}},{snapshot:{templates:[{}]}}])assert.equal(needsWelcome(setup),false);
});
test('profile names trim whitespace and reject blank, invalid, or oversized values',()=>{
  assert.equal(profileName(' Kieran '),'Kieran');
  for(const value of ['', '   ',null,{},'a'.repeat(31)])assert.equal(profileName(value),null);
  assert.equal(profileName('a'.repeat(30)),'a'.repeat(30));
});
test('stopped recurring schedules disappear from the manager while today and prior history remain',()=>{
  const date='2026-10-12',store=createStore({seed:false});
  store.addTask(date,'Evening routine',{recurrence:{frequency:'daily',weekdays:[]}});
  const template=store.loadTemplates()[0];
  assert.equal(activeTemplates(store.loadTemplates(),date).length,1);
  store.stopTemplate(template.id,date);
  assert.equal(activeTemplates(store.loadTemplates(),date).length,0);
  assert.equal(store.loadTemplates().length,1);
  assert.equal(store.loadDay(date).tasks.length,1);
  assert.equal(store.loadDay(addDays(date,1)).tasks.length,0);
  assert.equal(activeTemplates([{...template,endDate:addDays(date,2)}],date).length,1);
});
