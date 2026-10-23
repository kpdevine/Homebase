import test from 'node:test';
import assert from 'node:assert/strict';
import {needsWelcome,needsLoggingSetup,profileName} from '../prototype/onboarding.mjs';
import {newUserSettings} from '../prototype/customization.mjs';
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

test('completed setups never reopen, including legacy setups without the tab-selection flag',()=>{
  for(const settings of [{setupComplete:true,tabsChosen:false},{tabsChosen:true}]){
    const snapshot={settings,days:[],entries:[],templates:[]};
    for(const cloudStatus of ['loading','editing','synced','signed-out','offline'])assert.equal(needsLoggingSetup({snapshot,cloudStatus}),false);
    assert.equal(needsWelcome({snapshot}),false);
  }
});

test('setup waits for auth and initial cloud adoption instead of blocking saved settings from loading',()=>{
  const snapshot=createStore({seed:false,settings:newUserSettings()}).exportSnapshot();
  for(const cloudStatus of ['loading','pending','syncing','editing','conflict','offline','error'])assert.equal(needsLoggingSetup({snapshot,hasUser:true,cloudStatus}),false);
  assert.equal(needsLoggingSetup({snapshot,hasUser:true,cloudStatus:'ready'}),false);
  assert.equal(needsLoggingSetup({snapshot,hasUser:true,cloudStatus:'synced'}),true);
  assert.equal(needsLoggingSetup({snapshot,cloudStatus:'signed-out'}),true);
  assert.equal(needsLoggingSetup({snapshot,error:true,cloudStatus:'signed-out'}),false);
  const restored={...snapshot,settings:{...snapshot.settings,setupComplete:true}};
  assert.equal(needsLoggingSetup({snapshot:restored,hasUser:true,cloudStatus:'synced'}),false);
});

test('legacy activity suppresses setup while an empty first save still offers it',()=>{
  const snapshot=createStore({seed:false}).exportSnapshot();
  assert.equal(needsLoggingSetup({snapshot,cloudStatus:'signed-out'}),true);
  for(const activity of [{nutrition:7},{tasks:[{name:'Read'}]},{sentiments:{notes:'Good day'}},{trainingMode:'rest'},{sleep:{minutes:480}}]){
    assert.equal(needsLoggingSetup({snapshot:{...snapshot,days:[{date:'2026-10-22',...activity}]},cloudStatus:'signed-out'}),false);
  }
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
