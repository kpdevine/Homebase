import {normalizeSettings,settingsForDay,nutritionScore,trainingReady,sentimentReady,enabledSections,timeScore,LOGGING_SECTIONS} from './customization.mjs';
// Calendar keys stay YYYY-MM-DD. UTC is used only for calendar arithmetic,
// never to infer the date of a personal record from an event timestamp.
export const DEMO_TODAY = '2026-10-15';
import { GROUPS, ALL_GROUPS } from './muscles.mjs';
import {trainingProgress,workoutForDay} from './training.mjs';
export { GROUPS } from './muscles.mjs';

export function dateKey(date) { return date.toISOString().slice(0, 10); }
export function addDays(key, amount) { const date = new Date(`${key}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return dateKey(date); }
export function isEditableDay(key, today) { return key >= addDays(today, -7); }
export function sampleWeekStart(key) { const day = new Date(`${key}T12:00:00Z`).getUTCDay(); return addDays(key, -((day + 6) % 7)); }
export function monthGrid(key) {
  const first = `${key.slice(0, 7)}-01`;
  const start = sampleWeekStart(first);
  const leadingDays = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const daysInMonth = Number(addDays(moveMonth(first, 1), -1).slice(-2));
  const length = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  return Array.from({ length }, (_, index) => addDays(start, index));
}
export function moveMonth(key, amount) {
  const date = new Date(`${key.slice(0, 7)}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return dateKey(date);
}
export function scoreFromPoint(x, y, centerX, centerY, {min=1,max=10,step=.1}={}) {
  if (Math.hypot(x - centerX, y - centerY) < 10) return null;
  const angle = Math.atan2(y - centerY, x - centerX) * 180 / Math.PI;
  let offset = (angle - 105 + 720) % 360;
  // The small bottom gap snaps to its nearest endpoint.
  if (offset > 330) offset = offset < 345 ? 330 : 0;
  return Number((Math.round((min + offset / 330 * (max-min))/step)*step).toFixed(6));
}
export function meterPoint(score, radius = 82, center = 110) {
  const angle = (105 + (score - 1) / 9 * 330) * Math.PI / 180;
  return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
}
export function meterPath(radius = 82, center = 110) {
  const first = meterPoint(1, radius, center);
  const last = meterPoint(10, radius, center);
  return `M ${first.x} ${first.y} A ${radius} ${radius} 0 1 1 ${last.x} ${last.y}`;
}
export function validateScore(score) { return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 10 && Math.abs(score * 100 - Math.round(score * 100)) < 1e-8; }
export function adjustScore(score, direction) { return score === null ? 0 : Math.max(0, Math.min(10, (direction > 0 ? Math.floor(score * 10 + 1e-8) + 1 : Math.ceil(score * 10 - 1e-8) - 1) / 10)); }
export function scorePercent(score) { return score === null ? null : score * 10; }
// Shared by score rings and completion bars. Missing values remain neutral.
export function progressColor(percent) {
  return scoreColor(percent===null?null:percent/10);
}
const checklist = ['Read for 20 minutes', 'Get outside for a walk', 'Take a stretch break', 'Plan tomorrow'];
export const DAY_SECTIONS = [
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'training', label: 'Training' },
  { id: 'checklists', label: 'To-do list' },
];

function emptyDay(date) {
  return { date, tasks: [], nutrition: null, sampleOverall: null, trainingMode: null, creatine: false, notes: { nutrition:'', training:'' }, comment:'', sentiments:{notes:'',rating:null},
    bodyWeight:null, checklistTouched:false, skippedTemplates:[], reviewed: { nutrition: false, training: false, checklists: false }, completedAt: null };
}

function invalidateReview(day, section) {
  day.reviewed[section] = false;
  day.completedAt = null;
}

import { validateSnapshot } from './persistence.mjs';
import { FREQUENCIES, isDue, occurrence } from './tasks.mjs';
import { scoreColor } from './scoring.mjs';
import {taskDates,taskState,datedTaskForDay,updateDatedTask} from './task-dates.mjs';

export function createStore(options = {}) {
  const days = new Map();
  const entries = [];
  const targets = new Map();
  const templates = [];
  const groupCatalog=new Map((options.snapshot?.groupCatalog||[]).map(group=>[group.id,group.name]));
  const sampleScores = [7.4, 6.8, 8.2, 7.1, 8.8, 8, 6.5, null, 6, 8, 7, null, 7, 8, 7];
  const sampleDailyScores = [7.1, 6.9, 8.4, 7.8, 8.6, 8, 7.3, null, 6.4, 7.2, 7, null, 7.5, 8.1, 7.6];
  let serial = 0;
  let settings=options.snapshot?.settings?normalizeSettings(options.snapshot.settings):options.settings?normalizeSettings(options.settings):null;
  if(options.clientId&&!/^[A-Za-z0-9_-]{1,32}$/.test(options.clientId))throw new Error('Invalid device ID.');
  const nextId=prefix=>{serial++;return options.clientId?`${prefix}-${options.clientId}-${serial}`:`${prefix}-${serial}`;};
  const today = options.today || DEMO_TODAY;
  for (let index = 0; options.seed !== false && index < sampleScores.length; index++) {
    const key = addDays(today, index - sampleScores.length + 1);
    days.set(key, {
      ...emptyDay(key),
      nutrition: sampleScores[index],
      // Illustrative only: this is intentionally independent of checklist/rating edits.
      sampleOverall: sampleDailyScores[index],
      checklistTouched:true,
      tasks: checklist.map((name, taskIndex) => ({ id: `sample-${index}-${taskIndex}`, name, done: index === sampleScores.length - 1 ? taskIndex < 2 : taskIndex < (index % 4) + 1, children:[] })),
    });
  }
  const week = sampleWeekStart(today);
  if (options.seed !== false) targets.set(week, GROUPS.map(group => ({ ...group })));
  for (const [index, group] of (options.seed === false ? [] : GROUPS).entries()) {
    entries.push({ id: nextId('gym'), date: addDays(week, 1), groupId: group.id, sets: [5, 6, 3, 3, 4, 5, 3, 2][index] });
    entries.push({ id: nextId('gym'), date: addDays(week, 2), groupId: group.id, sets: [3, 4, 2, 2, 2, 3, 3, 2][index] });
  }
  for (const entry of entries) {
    if (!days.has(entry.date)) days.set(entry.date, emptyDay(entry.date));
    days.get(entry.date).trainingMode = 'training';
  }
  if (options.snapshot) {
    const snapshot = validateSnapshot(options.snapshot);
    days.clear(); targets.clear(); entries.length = 0;
    for (const day of snapshot.days) days.set(day.date, day);
    for (const [key, groups] of snapshot.targets) targets.set(key, groups);
    entries.push(...snapshot.entries); templates.push(...snapshot.templates); serial = snapshot.serial;
  }
  // Older versions stored new future plans on their planned day. Make pending
  // plans available from today without adding copies or changing earlier history.
  if(options.editableToday)for(const day of days.values())for(const task of day.tasks){
    const now=options.editableToday();
    if(!task.templateId&&!task.taskEvents&&!task.done&&day.date>now){
      task.displayDate=task.displayDate===undefined?day.date:task.displayDate;
      task.taskEvents=[{date:now,value:taskState(task)}];
    }
    const first=task.taskEvents?.[0];
    if(first&&first.date>now&&!first.value.done&&!first.value.removedOn)first.date=now;
  }
  function loadDay(key) {
    const day = structuredClone(days.get(key) || emptyDay(key));
    day.tasks=day.tasks.filter(task=>!task.taskEvents);
    for(const [sourceDate,source] of days)for(const task of source.tasks){
      if(task.taskEvents){const visible=datedTaskForDay(task,sourceDate,key);if(visible)day.tasks.push(visible);}
      else if(!task.templateId&&sourceDate<key&&!task.done)day.tasks.push({...structuredClone(task),displayDate:task.displayDate===undefined?sourceDate:task.displayDate,_taskSource:sourceDate});
    }
    if(!day.configuration&&settings&&key>=settings.effectiveFrom){day.configuration=structuredClone(settings);if(!days.has(key))day.creatine=false;}
    for (const template of templates) if (isDue(template,key) && !day.skippedTemplates.includes(template.id) && !day.tasks.some(task=>task.templateId===template.id)) day.tasks.push(occurrence(template,key));
    return day;
  }
  function saveDay(day) {
    const key=day.date,owned=days.get(key)?.tasks.filter(task=>task.taskEvents)||[];
    day.tasks=day.tasks.filter(task=>!task._taskSource).concat(owned);
    days.set(key,day);return day;
  }
  function writableDay(key) {return saveDay(loadDay(key));}
  function datedSource(key,id) {
    const visible=loadDay(key).tasks.find(task=>task.id===id||task.children.some(child=>child.id===id));
    if(!visible?._taskSource)return null;
    return {visible,task:days.get(visible._taskSource).tasks.find(task=>task.id===visible.id)};
  }
  function saveDated(key,task,state) {
    const {_taskSource,...clean}=state;
    const sourceDate=[...days].find(([,day])=>day.tasks.includes(task))?.[0]??key;
    if(!task.taskEvents)task.taskEvents=[{date:sourceDate,value:taskState(task)}];
    const before=new Map([...days.keys()].filter(date=>date>=key).map(date=>[date,JSON.stringify(datedTaskForDay(task,sourceDate,date))]));
    updateDatedTask(task,key,clean);
    for(const [date,value] of before)if(value!==JSON.stringify(datedTaskForDay(task,sourceDate,date)))invalidateReview(days.get(date),'checklists');
    invalidateReview(writableDay(key),'checklists');
  }
  function effectiveTargets(key) {
    const start=sampleWeekStart(key),source=[...targets.keys()].filter(week=>week<=start).sort().at(-1);
    const day=loadDay(key),frozen=day.configuration&&settings&&key<settings.effectiveFrom;
    const saved=frozen?day.configuration.training.groups:targets.get(source);
    return {source:source||null,groups:settingsForDay(loadDay(key)).training.groups.map(group=>({...group,target:saved?saved.find(value=>value.id===group.id)?.target??0:group.target}))};
  }
  function loadWeek(key) {
    const start=sampleWeekStart(key),end=addDays(start,6),effective=effectiveTargets(key);
    const weekEntries=entries.filter(entry=>entry.date>=start&&entry.date<=end);
    return {start,end,targetSource:effective.source,groups:effective.groups.map(group=>({...group,completed:weekEntries.filter(entry=>entry.groupId===group.id).reduce((sum,entry)=>sum+entry.sets,0)})),entries:structuredClone(weekEntries),days:structuredClone([...days.values()].filter(day=>day.date>=start&&day.date<=end))};
  }
  function trainingScores() {return new Map([...days.values()].map(day=>[day.date,trainingProgress(day,loadWeek(day.date)).score]));}
  function restoreDraftTraining(day){if(day.draftTrainingEntries){entries.push(...day.draftTrainingEntries);delete day.draftTrainingEntries;}}
  function pauseTraining(day){const draft=entries.filter(entry=>entry.date===day.date);if(draft.length){day.draftTrainingEntries=draft;for(let index=entries.length-1;index>=0;index--)if(entries[index].date===day.date)entries.splice(index,1);}}
  function startWorkout(day) {
    if(day.workoutPlan)return;
    const plan=workoutForDay(day,loadWeek(day.date));
    day.workoutPlan={sets:plan.sets,groups:plan.groups.map(({id,sets})=>({id,sets})),targetMet:plan.targetMet,goalsMet:plan.goalsMet};
  }
  function reopenChangedTraining(before) {
    for(const day of days.values())if(before.has(day.date)&&before.get(day.date)!==trainingProgress(day,loadWeek(day.date)).score)invalidateReview(day,'training');
  }
  function taskDraft(task,changes) {
    const name=typeof changes.name==='string'?changes.name.trim():'';
    if(!name||name.length>100)throw new RangeError('Use a task name between 1 and 100 characters.');
    const children=changes.children??task.children,ids=new Set();
    if(!Array.isArray(children)||children.length>20)throw new RangeError('Use up to 20 subtasks.');
    return {name,children:children.map(child=>{
      if(!child||typeof child.name!=='string'||!child.name.trim()||child.name.trim().length>100)throw new RangeError('Use subtask names of 1–100 characters.');
      if(child.id&&(!task.children.some(old=>old.id===child.id)||ids.has(child.id)))throw new Error('Subtask no longer exists. Reopen the editor.');
      if(child.id)ids.add(child.id);
      return {id:child.id||null,name:child.name.trim()};
    })};
  }
  const taskCreationDate=()=>options.editableToday?.()??options.today??null;
  const planningLimit=()=>options.editableToday?addDays(options.editableToday(),7):null;
  function validatePlannedDate(date,previous) {
    if(!date||date===previous)return;
    if(options.editableToday&&!isEditableDay(date,options.editableToday()))throw new Error('Days more than a week ago are summary only.');
    if(planningLimit()&&date>planningLimit())throw new RangeError('Plan tasks up to seven days ahead.');
  }
  const store = {
    loadDay,
    exportSnapshot() { return structuredClone({ version: 2, days: [...days.values()], entries, targets: [...targets], templates, serial, ...(settings?{settings}:{}),...(groupCatalog.size?{groupCatalog:[...groupCatalog].map(([id,name])=>({id,name}))}:{}) }); },
    getSettings() {const config=normalizeSettings(settings||undefined);if(settings)config.training.groups=effectiveTargets(options.editableToday?.()||(today>=settings.effectiveFrom?today:settings.effectiveFrom)).groups;return config;},
    setAccountPreferences(accountPreferences) {
      settings=normalizeSettings({...normalizeSettings(settings||undefined),accountPreferences});
      options.onChange?.(store.exportSnapshot());
    },
    setSettings(value,key=today) {
      const next=normalizeSettings({...value,setupComplete:true,effectiveFrom:key});
      const previous=normalizeSettings(settings||undefined),changed=LOGGING_SECTIONS.filter(({id})=>previous.tabs[id]!==next.tabs[id]||id!=='checklists'&&JSON.stringify(previous[id])!==JSON.stringify(next[id])).map(({id})=>id);
      for(const day of days.values())if(day.date<key){const groups=effectiveTargets(day.date).groups;if(!day.configuration){day.configuration=settingsForDay(loadDay(day.date));if(day.creatine===undefined)day.configuration.training.creatine=false;}day.configuration.training.groups=structuredClone(groups);}
      for(const group of [...(settings?.training.groups||[]),...next.training.groups])groupCatalog.set(group.id,group.name);
      settings=next;
      for(const day of days.values())if(day.date>=key){day.configuration=structuredClone(next);if(next.training.mode==='gym'&&entries.some(entry=>entry.date===day.date))day.trainingMode='training';for(const id of changed)invalidateReview(day,id);}
      targets.set(sampleWeekStart(key),structuredClone(next.training.groups));
      options.onChange?.(store.exportSnapshot());
    },
    updateFood(key,changes) {
      const day=writableDay(key),food={protein:null,calories:null,...day.food,...changes};
      if(Object.keys(changes).some(key=>!['protein','calories'].includes(key))||Object.values(food).some(value=>value!==null&&(!Number.isFinite(value)||value<0||value>50000)))throw new RangeError('Enter nonnegative calories and protein, or leave blank.');
      day.food=food;invalidateReview(day,'nutrition');
    },
    updateTrainingMinutes(key,value) {
      if(value!==null&&(!Number.isFinite(value)||value<0||value>1440))throw new RangeError('Enter 0–1440 minutes.');
      const day=writableDay(key);day.trainingMinutes=value;invalidateReview(day,'training');
    },
    updateTime(key,section,minutes) {
      if(!['sleep','prayer'].includes(section)||minutes!==null&&(!Number.isInteger(minutes)||minutes<0||minutes>1440))throw new RangeError('Enter hours and minutes up to 24 hours, or leave blank.');
      const day=writableDay(key);if(day[section]?.minutes!==minutes){day[section]={minutes};invalidateReview(day,section);}
    },
    groupName(key,id){return effectiveTargets(key).groups.find(g=>g.id===id)?.name||groupCatalog.get(id)||ALL_GROUPS.find(g=>g.id===id)?.name||id;},
    loadTemplates() { return structuredClone(templates); },
    hasEntry(key) { return days.has(key) || entries.some(entry => entry.date === key); },
    updateRating(key, score) {
      if (score !== null && !validateScore(score)) throw new RangeError('Enter a rating from 0 to 10 with at most two decimal places, or leave it unentered.');
      const day = writableDay(key);
      if (day.nutrition !== score) { day.nutrition = score; invalidateReview(day, 'nutrition'); }
    },
    toggleTask(key, id) {
      const dated=datedSource(key,id);
      if(dated){
        const parent=dated.visible,action=parent.id===id?parent:parent.children.find(child=>child.id===id);
        if(parent.id===id&&parent.children.length)throw new Error('Complete each subtask first.');
        action.done=!action.done;if(parent.children.length)parent.done=parent.children.every(child=>child.done);
        parent.completedOn=parent.done?key:null;saveDated(key,dated.task,parent);writableDay(key).checklistTouched=true;return;
      }
      const day = writableDay(key), parent=day.tasks.find(task=>task.id===id || task.children.some(child=>child.id===id));
      if (!parent) throw new Error('Task not found.');
      if (parent.id===id && parent.children.length) throw new Error('Complete each subtask first.');
      const task=parent.id===id ? parent : parent.children.find(child=>child.id===id);
      task.done=!task.done;
      if(parent.children.length) parent.done=parent.children.every(child=>child.done);
      day.checklistTouched=true; invalidateReview(day,'checklists');
    },
    updateNotes(key, section, value) {
      if (!['nutrition','training'].includes(section) || typeof value !== 'string' || value.length > 5000) throw new RangeError('Use up to 5000 characters for nutrition or training notes.');
      const day = writableDay(key);
      if (day.notes[section] !== value) { day.notes[section] = value; invalidateReview(day, section); }
    },
    updateDayComment(key, value) {
      if(typeof value!=='string'||value.length>5000)throw new RangeError('Use up to 5000 characters for your day comment.');
      writableDay(key).comment=value;
    },
    updateBodyWeight(key, value) {
      if(value!==null&&(!value||!['lb','kg'].includes(value.unit)||typeof value.value!=='number'||!Number.isFinite(value.value)||value.value<1||value.value>(value.unit==='kg'?700:1500)||Math.abs(value.value*10-Math.round(value.value*10))>1e-8))throw new RangeError('Enter a body weight in 0.1 steps, using lb or kg.');
      const day=writableDay(key);
      if(JSON.stringify(day.bodyWeight)!==JSON.stringify(value)){day.bodyWeight=value?{value:value.value,unit:value.unit}:null;invalidateReview(day,'training');}
    },
    updateSentiments(key, changes) {
      if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).some(key=>!['notes','rating'].includes(key)))throw new RangeError('Use sentiment notes and an optional rating.');
      if('notes' in changes && (typeof changes.notes!=='string'||changes.notes.length>5000))throw new RangeError('Use up to 5000 characters for sentiments.');
      if('rating' in changes && changes.rating!==null && (typeof changes.rating!=='number'||!Number.isFinite(changes.rating)||changes.rating<0||changes.rating>10||Math.abs(changes.rating*10-Math.round(changes.rating*10))>1e-8))throw new RangeError('Enter a sentiment rating from 0 to 10 in steps of 0.1, or leave it blank.');
      const day=writableDay(key),next={...day.sentiments,...changes};
      if(next.notes!==day.sentiments.notes||next.rating!==day.sentiments.rating) {day.sentiments=next;delete day.reviewed.sentiments;day.completedAt=null;}
    },
    addTask(key, name, options = {}) {
      const dates=taskDates(options,key);
      validatePlannedDate(dates.displayDate);
      if(planningLimit()&&key>planningLimit())throw new RangeError('Plan tasks up to seven days ahead.');
      const clean = String(name).trim();
      if (!clean || clean.length > 100) throw new RangeError('Use a task name between 1 and 100 characters.');
      const children=options.children || [];
      if(!Array.isArray(children) || children.length>20 || children.some(name=>typeof name!=='string' || !name.trim() || name.trim().length>100)) throw new RangeError('Use up to 20 subtasks, each with a name of 1–100 characters.');
      const recurrence=options.recurrence;
      if(recurrence && (!FREQUENCIES.includes(recurrence.frequency) || !Array.isArray(recurrence.weekdays) || recurrence.weekdays.some(day=>!Number.isInteger(day)||day<1||day>7) || recurrence.frequency==='custom'&&!recurrence.weekdays.length)) throw new RangeError('Choose a frequency and at least one day for a custom schedule.');
      if(loadDay(key).tasks.length>=1000 || recurrence&&templates.length>=5000) throw new RangeError('Task limit reached.');
      let task;
      if(recurrence) {
        const template={id:nextId('routine'),name:clean,children:children.map(name=>({id:nextId('child'),name:name.trim()})),startDate:key,endDate:null,frequency:recurrence.frequency,weekdays:[...new Set(recurrence.weekdays)].sort(),...(dates.dueDate?{dueOffset:Math.round((Date.parse(dates.dueDate)-Date.parse(key))/86400000)}:{})};
        templates.push(template);
        // A new schedule affects existing open/future records, never earlier history.
        for(const day of days.values()) if(isDue(template,day.date)) invalidateReview(day,'checklists');
        task=isDue(template,key)?occurrence(template,key):null;
      } else {
        task={id:nextId('task'),name:clean,done:false,children:children.map(name=>({id:nextId('task'),name:name.trim(),done:false,children:[]})),...dates};
        task.taskEvents=[{date:key,value:taskState(task)}];
      }
      const created=taskCreationDate()??key;
      if(task?.taskEvents&&key>created){key=created;task.taskEvents[0].date=created;}
      const day=writableDay(key);
      if(task && !day.tasks.some(item=>item.id===task.id)) day.tasks.push(task);
      if(task) invalidateReview(day,'checklists');
      if(task?.taskEvents)for(const future of days.values())if(future.date>key&&datedTaskForDay(task,key,future.date))invalidateReview(future,'checklists');
      return task?.id ?? null;
    },
    editTask(key,id,changes) {
      const current=loadDay(key),task=current.tasks.find(task=>task.id===id);
      if(!task)throw new Error('Task no longer exists. Reopen the list.');
      const dates=taskDates({...task,...changes,displayDate:changes.displayDate!==undefined?changes.displayDate:changes.date??(task.displayDate===undefined?key:task.displayDate)},changes.date??key);
      validatePlannedDate(dates.displayDate,task.displayDate);
      const draft=taskDraft(task,changes),date=changes.date??key;
      if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||addDays(date,0)!==date)throw new RangeError('Choose a valid task date.');
      if(options.editableToday&&!isEditableDay(date,options.editableToday()))throw new Error('Days more than a week ago are summary only.');
      if(planningLimit()&&date>planningLimit())throw new RangeError('Plan tasks up to seven days ahead.');
      if(task.templateId&&date!==key)throw new Error('Edit a recurring task on its scheduled day.');
      if(date!==key&&loadDay(date).tasks.length>=1000)throw new RangeError('Task limit reached for that day.');
      const next={...task,...dates,name:draft.name,children:draft.children.map(child=>({...child,id:child.id||nextId('task'),done:task.children.find(old=>old.id===child.id)?.done??false,children:[]}))};
      if(next.children.length)next.done=next.children.every(child=>child.done);
      if(!task.templateId&&(task._taskSource||dates.displayDate!==undefined)){
        const source=datedSource(key,id);
        next.completedOn=next.done?(task.completedOn??key):null;
        if(source&&JSON.stringify({...taskState(task),completedOn:task.completedOn??null})===JSON.stringify(next))return id;
        if(source){
          const effectiveDate=date<key?date:key;
          if(date<key){
            if(!source.task.taskEvents)source.task.taskEvents=[{date:source.visible._taskSource,value:taskState(source.task)}];
            source.task.taskEvents=source.task.taskEvents.filter(event=>event.date!==key);
            if(next.done&&next.completedOn>effectiveDate)next.completedOn=effectiveDate;
          }
          saveDated(effectiveDate,source.task,next);return id;
        }
        const owner=days.get(key)?.tasks.find(item=>item.id===id);
        // Promote a legacy dated task without changing its ID or checks.
        const canonical=taskState(task);canonical.taskEvents=[{date:key,value:taskState(task)}];
        if(owner)Object.assign(owner,canonical);else writableDay(key).tasks.push(canonical);
        saveDated(key,owner||canonical,next);return id;
      }
      if(date===key&&JSON.stringify(next)===JSON.stringify(task))return id;
      if(date===key)current.tasks[current.tasks.findIndex(task=>task.id===id)]=next;
      else {current.tasks=current.tasks.filter(task=>task.id!==id);const target=writableDay(date);target.tasks.push(next);invalidateReview(target,'checklists');}
      saveDay(current);invalidateReview(current,'checklists');return id;
    },
    editRoutine(key,id,changes) {
      const current=loadDay(key),task=current.tasks.find(task=>task.id===id),template=templates.find(template=>template.id===task?.templateId);
      if(!task||!template||!isDue(template,key))throw new Error('Recurring task no longer exists on that date.');
      const draft=taskDraft(task,changes),recurrence=changes.recurrence;
      if(!recurrence||!FREQUENCIES.includes(recurrence.frequency)||!Array.isArray(recurrence.weekdays)||recurrence.weekdays.some(day=>!Number.isInteger(day)||day<1||day>7)||recurrence.frequency==='custom'&&!recurrence.weekdays.length)throw new RangeError('Choose a repeat frequency and at least one selected day.');
      if(templates.length>=5000)throw new RangeError('Recurring task limit reached.');
      const dates=taskDates({...task,...changes},key);
      const schedule={name:draft.name,startDate:key,endDate:template.endDate,frequency:recurrence.frequency,weekdays:[...new Set(recurrence.weekdays)].sort(),...(dates.dueDate?{dueOffset:Math.round((Date.parse(dates.dueDate)-Date.parse(key))/86400000)}:{})};
      for(const day of days.values())if(day.date>=key&&isDue(schedule,day.date)&&!day.tasks.some(item=>item.templateId===template.id)&&!day.skippedTemplates.includes(template.id)&&day.tasks.length>=1000)throw new RangeError('Task limit reached on an affected date.');
      const links=draft.children.map(child=>template.children.find(old=>child.id?.endsWith('-'+old.id))?.id??null);
      const next={...schedule,id:nextId('routine'),children:draft.children.map(child=>({id:nextId('child'),name:child.name}))};
      template.endDate=addDays(key,-1);templates.push(next);saveDay(current);
      for(const day of days.values())if(day.date>=key) {
        const old=day.tasks.find(item=>item.templateId===template.id),skipped=day.skippedTemplates.includes(template.id);
        day.tasks=day.tasks.filter(item=>item.templateId!==template.id);
        if(skipped&&isDue(next,day.date))day.skippedTemplates.push(next.id);
        if(!skipped&&isDue(next,day.date)) {
          const replacement=occurrence(next,day.date);
          replacement.children.forEach((child,index)=>{child.done=old?.children.find(item=>links[index]&&item.id.endsWith('-'+links[index]))?.done??false;});
          replacement.done=replacement.children.length?replacement.children.every(child=>child.done):old?.done??false;
          day.tasks.push(replacement);invalidateReview(day,'checklists');
        } else if(old)invalidateReview(day,'checklists');
      }
      return loadDay(key).tasks.find(item=>item.templateId===next.id)?.id??null;
    },
    removeTask(key, id) {
      const dated=datedSource(key,id);
      if(dated){const task={...dated.visible,_taskSource:dated.visible._taskSource};saveDated(key,dated.task,{...dated.visible,removedOn:key});return {task,index:0};}
      const day = writableDay(key);
      const index = day.tasks.findIndex(task => task.id === id);
      if (index < 0) throw new Error('Task not found.');
      const [task] = day.tasks.splice(index, 1);
      if(task.templateId) day.skippedTemplates.push(task.templateId);
      invalidateReview(day, 'checklists');
      return { task: structuredClone(task), index };
    },
    restoreTask(key, task, index) {
      if(task?._taskSource){
        if(loadDay(key).tasks.some(item=>item.id===task.id))throw new Error('Task already exists.');
        const canonical=days.get(task._taskSource)?.tasks.find(item=>item.id===task.id);
        if(!canonical)throw new Error('Task no longer exists.');
        saveDated(key,canonical,task);return;
      }
      if (!task || typeof task.id !== 'string' || typeof task.name !== 'string' || !task.name.trim() || task.name.length > 100 || typeof task.done !== 'boolean') throw new Error('Invalid task.');
      if ([...days.values()].some(day => day.tasks.some(item => item.id === task.id))) throw new Error('Task already exists.');
      const day = writableDay(key);
      if(task.templateId) { day.skippedTemplates=day.skippedTemplates.filter(id=>id!==task.templateId); day.tasks=day.tasks.filter(item=>item.templateId!==task.templateId); }
      day.tasks.splice(Math.max(0, Math.min(day.tasks.length, index)), 0, structuredClone(task));
      invalidateReview(day, 'checklists');
    },
    stopTemplate(id, afterDate) {
      const template=templates.find(item=>item.id===id);
      if(!template) throw new Error('Recurring task not found.');
      template.endDate=afterDate;
      for(const day of days.values()) if(day.date>afterDate && day.tasks.some(task=>task.templateId===id)) {
        day.tasks=day.tasks.filter(task=>task.templateId!==id);invalidateReview(day,'checklists');
      }
    },
    setWeekTargets(key, values) {
      const groups=effectiveTargets(key).groups;
      if(!Array.isArray(values)||values.length!==groups.length||new Set(values.map(g=>g.id)).size!==groups.length||groups.some(g=>!values.some(v=>v.id===g.id))||values.some(g=>!Number.isInteger(g.target)||g.target<0||g.target>20))throw new RangeError('Enter a whole target from 0 to 20 for each group.');
      const before=trainingScores();
      const start=sampleWeekStart(key);
      targets.set(start,groups.map(group=>({...group,target:values.find(v=>v.id===group.id).target})));
      for(const day of days.values())if(day.configuration&&day.date>=start&&day.date<=addDays(start,6))for(const group of day.configuration.training.groups){const edited=values.find(v=>v.id===group.id);if(edited)group.target=edited.target;}
      reopenChangedTraining(before);
    },
    loadWeek,
    trainingProgress(key) {return trainingProgress(loadDay(key),loadWeek(key));},
    idealWorkout(key) {return workoutForDay(loadDay(key),loadWeek(key));},
    addGymEntry(date, groupId, sets) {
      if (!(settings?effectiveTargets(date).groups:ALL_GROUPS).some(group => group.id === groupId)) throw new RangeError('Choose a known muscle group.');
      if (!Number.isInteger(sets) || sets < 1 || sets > 100) throw new RangeError('Enter a whole number from 1 to 100 sets.');
      const before=trainingScores(),entry = { id: nextId('gym'), date, groupId, sets },day=writableDay(date);
      restoreDraftTraining(day);
      if(day.creatine===undefined)day.creatine=false;
      startWorkout(day);
      entries.push(entry);
      day.trainingMode = 'training';
      invalidateReview(day, 'training');
      reopenChangedTraining(before);
      return entry.id;
    },
    updateGymEntry(id,sets) {
      const entry=entries.find(entry=>entry.id===id);
      if(!entry)throw new Error('This set entry is no longer available.');
      if(!Number.isInteger(sets)||sets<1||sets>100)throw new RangeError('Enter a whole number from 1 to 100 sets.');
      if(entry.sets===sets)return;
      const before=trainingScores(),day=writableDay(entry.date);
      entry.sets=sets;invalidateReview(day,'training');reopenChangedTraining(before);
    },
    removeGymEntry(id) {
      const index = entries.findIndex(entry => entry.id === id);
      if (index >= 0) {
        const before=trainingScores(),[entry] = entries.splice(index, 1);
        // UI-14: removing set volume does not reverse the lifting answer.
        const day=writableDay(entry.date);if(day.creatine===undefined)day.creatine=false;
        invalidateReview(day, 'training');reopenChangedTraining(before);
      }
    },
    loadTrainingDay(key) { return structuredClone(entries.filter(entry => entry.date === key)); },
    setCreatine(key, taken) {
      if(typeof taken!=='boolean')throw new RangeError('Choose whether you took creatine.');
      const day=writableDay(key);
      if(day.creatine!==taken){day.creatine=taken;invalidateReview(day,'training');}
    },
    setTrainingMode(key, mode) {
      if (!['training', 'rest', 'unplanned-rest', 'rest-unclassified'].includes(mode)) throw new RangeError('Choose lifting or rest.');
      const before=trainingScores(),day = writableDay(key),newPolicy=day.creatine===undefined;
      if(newPolicy)day.creatine=false;
      if(mode==='training'){restoreDraftTraining(day);startWorkout(day);}
      else if(settingsForDay(day).training.mode==='gym')pauseTraining(day);
      if (day.trainingMode !== mode || newPolicy) { day.trainingMode = mode; invalidateReview(day, 'training');reopenChangedTraining(before); }
    },
    setAlternateWorkout(key, description) {
      if(typeof description!=='string'||!description.trim()||description.trim().length>1000)throw new RangeError('Describe your workout in 1–1000 characters.');
      const before=trainingScores(),day=writableDay(key),text=description.trim();
      if(day.trainingMode==='alternate'&&day.alternateWorkout===text)return;
      pauseTraining(day);
      if(day.creatine===undefined)day.creatine=false;
      day.trainingMode='alternate';day.alternateWorkout=text;
      invalidateReview(day,'training');reopenChangedTraining(before);
    },
    dayProgress(key) {
      const day = loadDay(key);
      const dailyEntries = this.loadTrainingDay(key);
      const ready = { nutrition: nutritionScore(day) !== null,
        training: trainingReady(day,dailyEntries) && (['rest','unplanned-rest','rest-unclassified','alternate'].includes(day.trainingMode) ? (settingsForDay(day).training.mode==='other'||dailyEntries.length === 0) : day.trainingMode === 'training'),
        checklists: true, sentiments:sentimentReady(day),sleep:timeScore(day,'sleep')!==null,prayer:timeScore(day,'prayer')!==null };
      const sections = enabledSections(day).map(section => ({ ...section, ready: ready[section.id], reviewed: !!(ready[section.id]&&(day.reviewed[section.id]===true||section.id==='sentiments'&&day.reviewed.sentiments===undefined&&day.completedAt)) }));
      return { sections, reviewedCount: sections.filter(section => section.reviewed).length,
        canComplete: sections.length>0&&sections.every(section => section.reviewed), completedAt: day.completedAt };
    },
    confirmSection(key, section) {
      const progress = this.dayProgress(key).sections.find(item => item.id === section);
      if (!progress) throw new Error('Unknown day section.');
      if (!progress.ready) throw new Error(['sleep','prayer'].includes(section)?'Enter the hours and minutes before confirming.':section==='sentiments'?'Add the required sentiment rating.':section==='nutrition'?'Finish your nutrition log before confirming.':'Answer training and enter minutes if applicable.');
      writableDay(key).reviewed[section] = true;
      if(section==='checklists') writableDay(key).checklistTouched=true;
    },
    completeDay(key) {
      if (!this.dayProgress(key).canComplete) throw new Error('Confirm every active section review before completing this day.');
      writableDay(key).completedAt = new Date().toISOString();
    },
  };
  for (const method of ['updateTime','updateFood','updateTrainingMinutes','updateRating', 'updateNotes', 'updateDayComment', 'updateBodyWeight', 'updateSentiments', 'toggleTask', 'addTask', 'editTask', 'editRoutine', 'removeTask', 'restoreTask', 'stopTemplate', 'setWeekTargets', 'addGymEntry', 'updateGymEntry','removeGymEntry', 'setTrainingMode', 'setAlternateWorkout', 'setCreatine', 'confirmSection', 'completeDay']) {
    const original = store[method];
    store[method] = (...args) => {
      const date=['removeGymEntry','updateGymEntry'].includes(method)?entries.find(entry=>entry.id===args[0])?.date:method==='stopTemplate'?args[1]:args[0];
      if(options.editableToday&&date&&!isEditableDay(date,options.editableToday()))throw new Error('Days more than a week ago are summary only.');
      const result = original.apply(store, args); options.onChange?.(store.exportSnapshot()); return result;
    };
  }
  return store;
}
