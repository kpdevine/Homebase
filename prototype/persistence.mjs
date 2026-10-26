import {normalizeSettings,settingsForDay,nutritionScore,sentimentReady,trainingReady,enabledSections,timeScore} from './customization.mjs';
import { FREQUENCIES } from './tasks.mjs';
import { ALL_GROUPS } from './muscles.mjs';
export const STORAGE_KEY = 'homebase.local.v1'; // Keep the storage key so v1 data migrates in place.
const groupIds = ALL_GROUPS.map(group=>group.id);
const sectionIds = ['nutrition', 'training', 'checklists'];
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 100 && /^[A-Za-z0-9_-]+$/.test(value);
const validScore = value => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
const validTimestamp = value => value === null || typeof value === 'string' && Number.isFinite(Date.parse(value));
const assert = (condition, message) => { if (!condition) throw new Error(`Invalid Pocket Planet backup: ${message}`); };

export function validateSnapshot(value) {
  assert(value && typeof value === 'object' && [1,2].includes(value.version), 'unsupported format.');
  assert(Array.isArray(value.days) && value.days.length <= 20000, 'daily records.');
  assert(Array.isArray(value.entries) && value.entries.length <= 100000, 'training entries.');
  assert(Array.isArray(value.targets) && value.targets.length <= 5000, 'weekly targets.');
  assert(Number.isSafeInteger(value.serial) && value.serial >= 0, 'record counter.');
  const dates = new Set(), ids = new Set();
  const groupCatalog=value.groupCatalog??[];
  assert(Array.isArray(groupCatalog)&&groupCatalog.length<=1000&&new Set(groupCatalog.map(g=>g.id)).size===groupCatalog.length&&groupCatalog.every(g=>g&&typeof g.id==='string'&&/^[a-z][a-z0-9_-]{0,49}$/.test(g.id)&&typeof g.name==='string'&&g.name.length>0&&g.name.length<=50),'group catalog.');
  const settings=value.settings===undefined?undefined:normalizeSettings(value.settings);
  const knownGroupIds=new Set([...groupIds,...groupCatalog.map(g=>g.id),...(settings?.training.groups||[]).map(g=>g.id),...value.days.flatMap(day=>(day.configuration?normalizeSettings(day.configuration).training.groups:[]).map(g=>g.id)),...value.targets.flatMap(pair=>Array.isArray(pair?.[1])?pair[1].map(g=>g.id):[])]);
  const validGroup=id=>typeof id==='string'&&/^[a-z][a-z0-9_-]{0,49}$/.test(id)&&knownGroupIds.has(id);
  const templatesValue=value.version===1 ? [] : value.templates;
  assert(Array.isArray(templatesValue) && templatesValue.length<=5000,'recurring tasks.');
  const readName=name=>{assert(typeof name==='string' && name.trim().length>0 && name.length<=100,'task name.');return name;};
  const readId=id=>{assert(validId(id)&&!ids.has(id),'duplicate or invalid task ID.');ids.add(id);return id;};
  const templates=templatesValue.map(template=>{
    assert(template && validDate(template.startDate) && (template.endDate===null || validDate(template.endDate)),'recurrence dates.');
    assert(FREQUENCIES.includes(template.frequency) && Array.isArray(template.weekdays) && template.weekdays.every(day=>Number.isInteger(day)&&day>=1&&day<=7) && new Set(template.weekdays).size===template.weekdays.length && (template.frequency!=='custom'||template.weekdays.length>0),'recurrence frequency.');
    assert(Array.isArray(template.children)&&template.children.length<=20,'recurring subtasks.');
    return {id:readId(template.id),name:readName(template.name),startDate:template.startDate,endDate:template.endDate,frequency:template.frequency,weekdays:[...template.weekdays],children:template.children.map(child=>({id:readId(child.id),name:readName(child.name)}))};
  });
  const templateIds=new Set(templates.map(template=>template.id));
  function readTask(task,child=false) {
    assert(task&&typeof task.done==='boolean','task values.');
    const id=readId(task.id),name=readName(task.name),childrenValue=task.children??[];
    assert(Array.isArray(childrenValue)&&childrenValue.length<=(child?0:20),'nested subtasks.');
    const children=childrenValue.map(item=>readTask(item,true));
    assert(!children.length || task.done===children.every(item=>item.done),'parent completion must match subtasks.');
    assert(task.templateId===undefined || !child&&templateIds.has(task.templateId),'unknown recurring task.');
    return {id,name,done:task.done,children,...(task.templateId?{templateId:task.templateId}:{})};
  }
  const days = value.days.map(day => {
    assert(day && validDate(day.date) && !dates.has(day.date), 'duplicate or invalid date.'); dates.add(day.date);
    assert(Array.isArray(day.tasks) && day.tasks.length <= 1000, 'checklist.');
    const tasks = day.tasks.map(task=>readTask(task));
    const checklistTouched=day.checklistTouched??(tasks.length>0||day.reviewed?.checklists===true);
    const skippedTemplates=day.skippedTemplates??[];
    assert(typeof checklistTouched==='boolean' && Array.isArray(skippedTemplates) && skippedTemplates.every(id=>templateIds.has(id)) && new Set(skippedTemplates).size===skippedTemplates.length,'checklist schedule state.');
    const occurrences=tasks.filter(task=>task.templateId).map(task=>task.templateId);
    assert(new Set(occurrences).size===occurrences.length && occurrences.every(id=>!skippedTemplates.includes(id)),'duplicate recurring occurrence.');
    assert(validScore(day.nutrition) && validScore(day.sampleOverall ?? null), 'rating.');
    assert(day.trainingMode === null || ['training', 'rest', 'unplanned-rest', 'rest-unclassified', 'alternate'].includes(day.trainingMode), 'day type.');
    assert(day.alternateWorkout===undefined||typeof day.alternateWorkout==='string'&&day.alternateWorkout.length<=1000,'alternate workout.');
    assert(day.trainingMode!=='alternate'||trainingReady(day),'alternate workout description.');
    assert(day.creatine===undefined||day.creatine===null||typeof day.creatine==='boolean','creatine check-in.');
    assert(day.reviewed && sectionIds.every(id => typeof day.reviewed[id] === 'boolean'), 'review state.');
    assert(validTimestamp(day.completedAt), 'completion timestamp.');
    assert(!day.reviewed.nutrition || nutritionScore(day) !== null, 'nutrition review without a rating.');
    assert(!day.completedAt || enabledSections(day).filter(section=>section.id!=='sentiments').every(({id})=>day.reviewed[id]===true), 'incomplete section reviews.');
    const notes = day.notes === undefined ? { nutrition:'', training:'' } : day.notes;
    assert(notes && ['nutrition','training'].every(id => typeof notes[id] === 'string' && notes[id].length <= 5000), 'notes.');
    const comment=day.comment??'';
    assert(typeof comment==='string'&&comment.length<=5000,'day comment.');
    const bodyWeight=day.bodyWeight??null;
    assert(bodyWeight===null||bodyWeight&&['lb','kg'].includes(bodyWeight.unit)&&typeof bodyWeight.value==='number'&&Number.isFinite(bodyWeight.value)&&bodyWeight.value>=1&&bodyWeight.value<=(bodyWeight.unit==='kg'?700:1500)&&Math.abs(bodyWeight.value*10-Math.round(bodyWeight.value*10))<1e-8,'body weight.');
    const sentiments=day.sentiments===undefined?{notes:'',rating:null}:day.sentiments;
    assert(sentiments&&typeof sentiments.notes==='string'&&sentiments.notes.length<=5000&&(sentiments.rating===null||typeof sentiments.rating==='number'&&Number.isFinite(sentiments.rating)&&sentiments.rating>=0&&sentiments.rating<=10&&Math.abs(sentiments.rating*10-Math.round(sentiments.rating*10))<1e-8),'sentiments.');
    assert(day.reviewed.sentiments===undefined||typeof day.reviewed.sentiments==='boolean','sentiments review state.');
    assert(!day.completedAt||!settingsForDay(day).tabs.sentiments||day.reviewed.sentiments!==false,'incomplete sentiments review.');
    // Keep legacy blank-review payloads unchanged; the model honors their completion.
    for(const id of ['sleep','prayer']){assert(day[id]===undefined||day[id]&&Object.keys(day[id]).every(key=>key==='minutes')&&(day[id].minutes===null||Number.isInteger(day[id].minutes)&&day[id].minutes>=0&&day[id].minutes<=1440),id+' minutes.');assert(day.reviewed[id]===undefined||typeof day.reviewed[id]==='boolean',id+' review.');assert(!day.reviewed[id]||timeScore(day,id)!==null,id+' review without time.');}
    const reviewed={...Object.fromEntries(sectionIds.map(id => [id, day.reviewed[id]])),...Object.fromEntries(['sleep','prayer'].filter(id=>day.reviewed[id]!==undefined).map(id=>[id,day.reviewed[id]])),...(day.reviewed.sentiments!==undefined?{sentiments:day.reviewed.sentiments}:day.completedAt&&sentiments.notes.trim()&&sentiments.rating!==null?{sentiments:true}:{})};
    let workoutPlan;
    if(day.workoutPlan!==undefined) {
      const plan=day.workoutPlan;
      assert(plan&&Array.isArray(plan.groups)&&plan.groups.length<=24&&Number.isInteger(plan.sets)&&plan.sets>=0&&plan.sets<=10000&&typeof plan.targetMet==='boolean'&&typeof plan.goalsMet==='boolean','workout plan.');
      const seen=new Set();
      for(const group of plan.groups){assert(group&&validGroup(group.id)&&!seen.has(group.id)&&Number.isInteger(group.sets)&&group.sets>0&&group.sets<=1000,'workout plan muscle.');seen.add(group.id);}
      assert(plan.groups.reduce((sum,group)=>sum+group.sets,0)===plan.sets,'workout plan total.');
      workoutPlan={sets:plan.sets,groups:plan.groups.map(({id,sets})=>({id,sets})),targetMet:plan.targetMet,goalsMet:plan.goalsMet};
    }
    const configuration=day.configuration===undefined?undefined:normalizeSettings(day.configuration);
    const food=day.food;
    assert(food===undefined||food&&['protein','calories'].every(key=>food[key]===null||typeof food[key]==='number'&&Number.isFinite(food[key])&&food[key]>=0&&food[key]<=50000),'nutrition amounts.');
    assert(day.trainingMinutes===undefined||day.trainingMinutes===null||typeof day.trainingMinutes==='number'&&Number.isFinite(day.trainingMinutes)&&day.trainingMinutes>=0&&day.trainingMinutes<=1440,'training minutes.');
    assert(!day.reviewed.sentiments||sentimentReady(day),'required sentiment rating.');
    let draftTrainingEntries;
    if(day.draftTrainingEntries!==undefined){assert(Array.isArray(day.draftTrainingEntries)&&day.draftTrainingEntries.length<=10000&&['rest','unplanned-rest','rest-unclassified','alternate'].includes(day.trainingMode),'paused set entries.');draftTrainingEntries=day.draftTrainingEntries.map(entry=>{assert(entry&&validId(entry.id)&&!ids.has(entry.id)&&entry.date===day.date&&validGroup(entry.groupId)&&Number.isInteger(entry.sets)&&entry.sets>=1&&entry.sets<=100,'paused set entry.');ids.add(entry.id);return {id:entry.id,date:entry.date,groupId:entry.groupId,sets:entry.sets};});}
    return { ...(day.alternateWorkout!==undefined?{alternateWorkout:day.alternateWorkout}:{}),...(draftTrainingEntries?{draftTrainingEntries}:{}),...Object.fromEntries(['sleep','prayer'].filter(id=>day[id]!==undefined).map(id=>[id,{minutes:day[id].minutes}])),...(configuration?{configuration}:{}),...(food?{food:{protein:food.protein,calories:food.calories}}:{}),...(day.trainingMinutes!==undefined?{trainingMinutes:day.trainingMinutes}:{}),date: day.date, ...(day.creatine!==undefined?{creatine:day.creatine}:{}), tasks, checklistTouched, skippedTemplates:[...skippedTemplates], nutrition: day.nutrition, sampleOverall: day.sampleOverall ?? null, trainingMode: day.trainingMode, notes: { nutrition:notes.nutrition, training:notes.training }, comment, bodyWeight:bodyWeight?{value:bodyWeight.value,unit:bodyWeight.unit}:null, sentiments:{notes:sentiments.notes,rating:sentiments.rating}, reviewed, completedAt: day.completedAt,...(workoutPlan?{workoutPlan}:{}) };
  });
  const entries = value.entries.map(entry => {
    assert(entry && validId(entry.id) && !ids.has(entry.id), 'duplicate entry ID.'); ids.add(entry.id);
    assert(validDate(entry.date) && dates.has(entry.date) && validGroup(entry.groupId) && Number.isInteger(entry.sets) && entry.sets >= 1 && entry.sets <= 100, 'set entry.');
    return { id: entry.id, date: entry.date, groupId: entry.groupId, sets: entry.sets };
  });
  for (const day of days) {
    const hasSets = settingsForDay(day).training.mode==='gym'&&entries.some(entry => entry.date === day.date);
    assert(!(day.trainingMode === 'rest' && hasSets), 'rest day with set entries.');
    assert(!hasSets || day.trainingMode === 'training', 'set entries without a training day.');
    assert(!day.reviewed.training || ['training','rest','unplanned-rest','rest-unclassified','alternate'].includes(day.trainingMode) || hasSets, 'training review without a log.');
  }
  const weeks = new Set();
  const targets = value.targets.map(pair => {
    assert(Array.isArray(pair) && pair.length === 2 && validDate(pair[0]) && !weeks.has(pair[0]) && Array.isArray(pair[1]), 'target week.'); weeks.add(pair[0]);
    const groups = new Set();
    return [pair[0], pair[1].map(group => {
      assert(group && validGroup(group.id) && !groups.has(group.id) && Number.isInteger(group.target) && group.target >= 0 && group.target <= 1000 && typeof group.name === 'string' && group.name.length <= 50, 'target values.'); groups.add(group.id);
      return { id: group.id, name: group.name, target: group.target };
    })];
  });
  const maxSerial = [...ids].reduce((max, id) => { const match = /^(?:task|gym|routine|child)-(\d+)$/.exec(id); return match ? Math.max(max, Number(match[1])) : max; }, 0);
  assert(value.serial >= maxSerial, 'record counter would reuse an ID.');
  return { version: 2, days, entries, targets, templates, serial: value.serial,...(settings?{settings}:{}),...(groupCatalog.length?{groupCatalog:groupCatalog.map(({id,name})=>({id,name}))}:{}) };
}

export function readLocal(storage) {
  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    return { snapshot: raw === null ? null : validateSnapshot(JSON.parse(raw)), raw, error: null };
  } catch (error) { return { snapshot: null, raw, error: error.message }; }
}

export function writeLocal(storage, snapshot) {
  const serialized = JSON.stringify(validateSnapshot(snapshot));
  storage.setItem(STORAGE_KEY, serialized);
  return serialized;
}

// Called only after the UI's explicit destructive confirmation. Keep an empty
// snapshot so a reset preview stays empty instead of reseeding on refresh.
export function resetLocal(storage, { suffix='', expectedRaw }={}) {
  const key=STORAGE_KEY+suffix, preferenceKey=`homebase.preferences.v1${suffix}`;
  const before=storage.getItem(key), preferences=storage.getItem(preferenceKey);
  if(before!==expectedRaw)throw new Error('Another tab changed the saved data. Reload before resetting.');
  const snapshot=validateSnapshot({version:2,days:[],entries:[],targets:[],templates:[],serial:0});
  const raw=JSON.stringify(snapshot);
  try {
    storage.setItem(key,raw);
    storage.removeItem(preferenceKey);
  } catch(error) {
    try {
      if(before===null)storage.removeItem(key);else storage.setItem(key,before);
      if(preferences===null)storage.removeItem(preferenceKey);else storage.setItem(preferenceKey,preferences);
    } catch { /* The original error is shown; no in-memory records are replaced. */ }
    throw error;
  }
  return {snapshot,raw};
}
