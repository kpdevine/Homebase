
import { GROUPS, DAY_SECTIONS, addDays, adjustScore, createStore, meterPath, meterPoint, monthGrid, moveMonth, scoreFromPoint } from './model.mjs';
import { summarizeDay, scoreColor, scoreGlow, scoreReward, localDateKey, averageDays, timeGreeting, loggingStreak } from './scoring.mjs';
import { taskProgress, scheduleLabel } from './tasks.mjs';
import { handwritingCarets } from './handwriting-caret.mjs';
import { dailyRecap } from './recap.mjs';
import { mountCloud } from './cloud-ui.mjs';
import { muscleName } from './muscles.mjs';
import { reveal, acknowledge, checkOff, setMeter, setMotionPreference } from './motion.mjs';
import { STORAGE_KEY, readLocal, writeLocal, validateSnapshot, resetLocal } from './persistence.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const refreshNoteCarets=handwritingCarets($$('[data-notes]'));
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
const scoreText = score => score === null ? '—' : score === 10 ? '10' : score.toFixed(2).replace(/(\.\d)0$/, '$1');
const scoreMarkup = score => { const [whole,fraction]=scoreText(score).split('.'); return `<span class="score-whole">${whole}</span>${fraction?`<span class="score-fraction">.${fraction}</span>`:''}`; };
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const timeZone = 'America/Chicago';
const preview = new URLSearchParams(location.search).get('preview') === '1';
const suffix = preview ? '.preview' : '';
const preferencesKey = `homebase.preferences.v1${suffix}`;
const storage = { getItem: key => localStorage.getItem(key + suffix), setItem: (key, value) => localStorage.setItem(key + suffix, value) };
const loaded = readLocal(storage);
let lastSavedRaw = loaded.raw;
let storageError = loaded.error;
let blockedSave = !!loaded.error;
let pendingSnapshot = null;
let saveTimer;
let toastTimer;
let undoAction = null;
let pendingImport = null;
let cloud=null,cloudLabel='';
const clientId=Array.from(crypto.getRandomValues(new Uint8Array(8)),value=>value.toString(16).padStart(2,'0')).join('');
let view = 'today';
let selectedDate = localDateKey(new Date(), timeZone);
let calendarMonth = selectedDate;
let reviewSessionDate = null;
let dragging = false;
let recapDate = null;
let targetScope=null,targetSignature='',targetDraft=new Map(),targetBaseline=[],targetDrag=null;
let taskComposerTrigger;
const expandedTasks = new Set();
let displayName = 'Kieran';
let preferences={},motionPreference='system';
try {const saved=JSON.parse(localStorage.getItem(preferencesKey));if(saved&&typeof saved==='object'&&!Array.isArray(saved))preferences=saved;}catch{}
if(typeof preferences.name==='string'&&preferences.name.trim()&&preferences.name.length<=30)displayName=preferences.name;
motionPreference=setMotionPreference(preferences.motion);
let store = createStore({ clientId, today: selectedDate, seed: preview, snapshot: loaded.snapshot, onChange: queueSave });
const dateFormat = (key, options) => new Intl.DateTimeFormat('en-US', { ...options, timeZone:'UTC' }).format(new Date(`${key}T12:00:00Z`));
const shortDate = key => dateFormat(key, { month:'short', day:'numeric' });
const longDate = key => dateFormat(key, { weekday:'long', month:'long', day:'numeric', year:'numeric' });
const viewLabels = { today:'Overview', nutrition:'Nutrition', training:'Daily training', checklists:'Checklists', sentiments:'Sentiments', history:'Calendar' };
const panelIds = { today:'dashboard-view', nutrition:'nutrition-view', training:'training-view', checklists:'checklists-view', sentiments:'sentiments-view', history:'history-view' };

function queueSave(snapshot) {
  pendingSnapshot = snapshot;
  clearTimeout(saveTimer);
  $('#save-message').textContent = blockedSave ? 'Changes not saved · see backups' : 'Saving on this device…';
  saveTimer = setTimeout(flushSave, 100);
}
function renderSaveStatus() {
  $('#save-status').classList.toggle('has-error', !!storageError);
  $('#save-message').textContent = storageError ? 'Changes not saved · see backups' : pendingSnapshot ? 'Saving on this device…' : preview ? 'Preview · saved separately' : cloudLabel||'Saved on this device';
  $('#storage-warning').hidden = !storageError;
  $('#storage-warning').textContent = storageError ? `Local saving needs attention. ${storageError} Your current changes remain in this tab; open Settings to download a backup.` : '';
}
function flushSave() {
  clearTimeout(saveTimer);
  if (!pendingSnapshot || blockedSave) { renderSaveStatus(); return; }
  try {
    if (storage.getItem(STORAGE_KEY) !== lastSavedRaw) {
      blockedSave = true; throw new Error('Another tab changed the saved data. Export this tab’s changes before reloading.');
    }
    lastSavedRaw = writeLocal(storage, pendingSnapshot);
    pendingSnapshot = null; storageError = null; cloud?.changed();cloud?.resume();
  } catch (error) { storageError = error.message; }
  renderSaveStatus();
}
function announce(message, undo = null) {
  clearTimeout(toastTimer); undoAction = undo;
  $('#status-message').textContent = message;
  $('#undo-action').hidden = !undo;
  $('#status').classList.add('visible');
  toastTimer = setTimeout(() => { $('#status').classList.remove('visible'); undoAction = null; }, undo ? 12000 : 3200);
}
function summaryFor(date = selectedDate) { return summarizeDay(store.loadDay(date), store.loadTrainingDay(date),store.loadWeek(date)); }
function circle(score,reward=false) {
  return `<span class="score-circle ${score === null ? 'no-score' : ''} ${reward?scoreReward(score):''}" style="--score-color:${scoreColor(score)};--score-glow:${reward?scoreGlow(score)/2:0}px" aria-hidden="true"><svg viewBox="0 0 48 48">${reward&&score===10?'<circle class="reward-halo" cx="24" cy="24" r="23"/>':''}<circle class="score-circle-track" cx="24" cy="24" r="20"/><circle class="score-circle-fill" cx="24" cy="24" r="20" pathLength="100" stroke-dasharray="${score === null ? 0 : score * 10} 100" transform="rotate(-90 24 24)"/></svg><span>${scoreText(score)}</span></span>`;
}
function renderHeader() {
  document.body.classList.toggle('is-overview', view === 'today');
  const now = new Date();
  const greeting = timeGreeting(now,timeZone);
  const isToday = selectedDate === localDateKey(now, timeZone);
  const past = selectedDate < localDateKey(now, timeZone);
  document.body.classList.toggle('viewing-other-day',!isToday);
  $('#selected-day-notice').hidden=isToday;
  $('#selected-day-label').textContent=`${past?'Past':'Future'} day · ${longDate(selectedDate)}`;
  $('#selected-day-help').textContent=`Entries on this screen belong to ${shortDate(selectedDate)}.`;
  $('#page-title').innerHTML = view === 'today' ? `<strong class="time-greeting">${greeting}</strong>, ${escapeHtml(displayName)}<span class="greeting-dot">.</span>` : escapeHtml(viewLabels[view]);
  $('#greeting-date').textContent = longDate(selectedDate);
  $('#date-short').textContent = dateFormat(selectedDate, { month:'long', day:'numeric' });
  $('#date-short').setAttribute('aria-label', `Choose date. Selected ${longDate(selectedDate)}`);
  const completed = !!store.loadDay(selectedDate).completedAt;
  $('#day-state').textContent = completed ? '✓ Day complete' : isToday ? 'Day in progress' : 'Open day';
  $('#day-state').classList.toggle('complete', completed);
  $('#calendar-day-number').textContent = Number(selectedDate.slice(-2));
  $('#overall-title').textContent = isToday ? "Today's score" : 'Daily score';
  $('#overview-tasks-title').textContent = isToday ? "TODAY'S TASKS" : 'DAILY TASKS';
  $('#tasks-title').textContent = isToday ? "TODAY'S TASKS" : 'DAILY TASKS';
  document.title = `Homebase · ${viewLabels[view]}`;
  for (const [key, panel] of Object.entries(panelIds)) $('#' + panel).hidden = view !== key;
  $$('[data-tab]').forEach(button => {
    const active = button.dataset.tab === view;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active || view==='history'&&button.dataset.tab==='today' ? 0 : -1;
  });
}
function renderTasks() {
  const day = store.loadDay(selectedDate), {done,total}=taskProgress(day.tasks);
  const taskHtml = editable => day.tasks.length ? day.tasks.map(task => {
    const children=task.children||[], expanded=expandedTasks.has(task.id), listId=`subtasks-${editable?'edit':'home'}-${task.id}`;
    const progress=taskProgress([task]);
    return `<li class="task-group"><div class="task-row"><label class="${children.length?'parent-task':''}" ${children.length?`data-expand-task="${task.id}"`:''}><input type="checkbox" data-task-id="${task.id}" ${task.done?'checked':''} ${children.length?'disabled':''}><span>${escapeHtml(task.name)}${task.templateId?'<small class="recurring-label">Repeats</small>':''}</span></label>${children.length?`<button class="expand-task" data-expand-task="${task.id}" aria-expanded="${expanded}" aria-controls="${listId}" aria-label="${expanded?'Collapse':'Expand'} ${escapeHtml(task.name)} subtasks"><span>${progress.done}/${progress.total}</span> ${expanded?'▾':'▸'}</button>`:''}${editable?`<button class="remove-task" data-remove-task="${task.id}" aria-label="Remove task${task.templateId?' for this day':''}: ${escapeHtml(task.name)}">×</button>`:''}</div>${children.length?`<ul id="${listId}" class="child-tasks" ${expanded?'':'hidden'}>${children.map(child=>`<li><label><input type="checkbox" data-task-id="${child.id}" ${child.done?'checked':''}><span>${escapeHtml(child.name)}</span></label></li>`).join('')}</ul>`:''}</li>`;
  }).join('') : '<li class="empty-tasks"><strong>No tasks yet.</strong><span>Add a task or a recurring routine.</span></li>';
  const scroll = $('.task-scroll').scrollTop;
  $('#overview-task-list').innerHTML = taskHtml(false);
  $('.task-scroll').scrollTop = scroll;
  $('#task-list').innerHTML = taskHtml(true);
  $('#overview-task-count').textContent = `${done}/${total}`;
  $('#task-count').textContent = `${done} / ${total}`;
  $('#task-summary').textContent = total ? `${done} of ${total} tasks checked off · ${total-done} remaining` : 'No tasks added for this date.';
  const fraction = total ? done / total : 0;
  $('#task-progress-fill').style.width = `${fraction * 100}%`;
  $('#task-progress-fill').style.backgroundColor = scoreColor(fraction * 10);
  const today=localDateKey(new Date(),timeZone),templates=store.loadTemplates();
  $('#recurring-tasks').innerHTML=templates.length?templates.map(template=>`<li><span><strong>${escapeHtml(template.name)}</strong><small>${scheduleLabel(template)} · from ${shortDate(template.startDate)}${template.endDate?` · ends ${shortDate(template.endDate)}`:''}</small></span>${!template.endDate?`<button class="text-button" data-stop-template="${template.id}">Stop after ${shortDate(today)}</button>`:'<small>Stopped</small>'}</li>`).join(''):'<li class="hint">Your recurring tasks will appear here.</li>';
  $('#routine-count').textContent=templates.filter(template=>!template.endDate).length;
}
function renderScore() {
  const summary = summaryFor();
  const day = store.loadDay(selectedDate), progress = store.dayProgress(selectedDate);
  const meter = $('#overall-meter');
  const reward=scoreReward(summary.score);
  meter.classList.toggle('score-high',!!reward);
  meter.classList.toggle('score-perfect',summary.score===10);
  meter.style.setProperty('--score-glow',`${scoreGlow(summary.score)}px`);
  const path = meterPath(93, 120);
  meter.querySelector('.meter-track').setAttribute('d', path);
  meter.querySelector('.meter-fill').setAttribute('d', path);
  setMeter(meter.querySelector('.meter-fill'),summary.score===null?0:summary.score*10,{immediate:dragging||document.activeElement===$('#rating-value')});
  meter.querySelector('.meter-number').innerHTML = scoreMarkup(summary.score);
  meter.style.setProperty('--score-soft', summary.score === null ? '#f2f4ef' : `${scoreColor(summary.score)}0a`);
  $('#day-gradient-start').setAttribute('stop-color',scoreColor(summary.score));
  $('#day-gradient-start').setAttribute('stop-opacity', '.45');
  $('#day-gradient-end').setAttribute('stop-color',scoreColor(summary.score));
  meter.setAttribute('aria-label', summary.score === null ? 'No daily score yet. Log a category to get started.' : `${summary.provisional ? 'Provisional ' : ''}Daily score ${scoreText(summary.score)} out of 10. ${summary.logged} of ${summary.sections.length} categories logged.`);
  const rewardLabel=reward?(summary.provisional?'High so far':summary.score===10?'Perfect score':'High score'):'';
  $('#score-status').textContent = [rewardLabel,day.completedAt ? 'Day complete' : summary.provisional ? `Provisional · ${summary.logged}/${summary.sections.length} logged` : 'All categories logged'].filter(Boolean).join(' · ');
  $('#overall-description').textContent = day.completedAt ? 'Day completed and saved.' : `${progress.reviewedCount} of 3 section reviews confirmed.`;
  const button = $('#complete-day');
  const missing = progress.sections.find(section => !section.ready);
  button.disabled = false;
  button.classList.toggle('needs-input', !day.completedAt && !!missing);
  button.classList.toggle('is-complete', !!day.completedAt);
  button.innerHTML = day.completedAt ? `View day summary ${icon('arrow')}` : progress.canComplete ? `Review full day ${icon('arrow')}` : `${progress.reviewedCount || reviewSessionDate === selectedDate ? 'Continue' : 'Start'} day review ${icon('arrow')}`;
  $('#overview-sections').innerHTML = summary.sections.map(section => {
    const state = progress.sections.find(item => item.id === section.id) || {ready:true,reviewed:false};
    const missing = section.score === null&&!section.excluded || !state.ready;
    return `<button class="breakdown-item ${section.id}" data-open-section="${section.id}" aria-label="Open ${section.label}. ${section.detail}. ${section.optional ? 'Optional rating included' : missing ? 'Not logged yet' : state.reviewed ? 'Reviewed' : 'Needs review'}">${circle(section.score)}<span class="breakdown-copy"><strong>${section.label}</strong><small>${escapeHtml(section.detail)}</small><span class="breakdown-state ${missing?'is-missing':''} ${state.reviewed ? 'reviewed' : ''}">${icon(section.optional ? 'check' : missing ? 'warning' : state.reviewed ? 'check' : 'arrow')}${section.optional ? 'Included in score' : missing ? 'Not logged yet' : state.reviewed ? 'Reviewed' : 'Ready to review'}</span></span><span class="breakdown-chevron" aria-hidden="true">›</span></button>`;
  }).join('');
  $('#overview-note').textContent = day.completedAt ? 'Day completed. Editing an entry reopens its review.' : progress.canComplete ? 'All three reviews confirmed. Check your full-day summary before completing the day.' : 'Check off individual tasks, confirm each section’s review, then review the full day.';
}
function renderRating() {
  const score = store.loadDay(selectedDate).nutrition, meter = $('#nutrition-meter');
  meter.style.setProperty('--score-color', scoreColor(score));
  meter.querySelector('.meter-track').setAttribute('d', meterPath());
  meter.querySelector('.meter-fill').setAttribute('d', meterPath());
  setMeter(meter.querySelector('.meter-fill'),score===null?0:(score-1)/9*100,{immediate:dragging||document.activeElement===$('#rating-value')});
  const point = meterPoint(score ?? 1), knob = meter.querySelector('.meter-knob');
  knob.setAttribute('cx', point.x); knob.setAttribute('cy', point.y); knob.style.opacity = score === null ? '.4' : '1';
  meter.querySelector('.meter-number').innerHTML = scoreMarkup(score);
  meter.querySelector('.meter-out-of').textContent = score === null ? 'not rated yet' : 'out of 10';
  meter.setAttribute('aria-valuenow', score ?? 1);
  meter.setAttribute('aria-valuetext', score === null ? 'Not rated. Adjust to enter a rating from 1 to 10 in steps of 0.1.' : `${scoreText(score)} out of 10`);
  if (document.activeElement !== $('#rating-value')) $('#rating-value').value = score === null ? '' : scoreText(score);
  $('#rating-description').textContent = score === null ? 'No rating entered yet.' : `Your rating: ${scoreText(score)} / 10`;
  $('#clear-rating').disabled = score === null;
  $('#rating-minus').disabled = score === 1; $('#rating-plus').disabled = score === 10;
}
function renderSentiments() {
  const {rating}=store.loadDay(selectedDate).sentiments,input=$('#sentiments-rating'),meter=$('#sentiments-meter');
  if(document.activeElement!==input)input.value=rating===null?'':rating;
  meter.style.setProperty('--score-color',scoreColor(rating));
  meter.querySelector('.meter-track').setAttribute('d',meterPath());
  const fill=meter.querySelector('.meter-fill');fill.setAttribute('d',meterPath());
  setMeter(fill,rating===null?0:rating*10,{immediate:sentimentPointer!==-1||document.activeElement===input});
  const point=meterPoint(1+(rating??0)*.9),knob=meter.querySelector('.meter-knob');
  knob.setAttribute('cx',point.x);knob.setAttribute('cy',point.y);knob.style.opacity=rating===null?'.4':'1';
  meter.querySelector('.meter-number').innerHTML=scoreMarkup(rating);
  meter.querySelector('.meter-out-of').textContent=rating===null?'not rated yet':'out of 10';
  meter.setAttribute('aria-valuenow',rating??0);meter.setAttribute('aria-valuetext',rating===null?'Not rated. Optional rating from 0 to 10.':`${scoreText(rating)} out of 10`);
  $('#sentiments-minus').disabled=rating===0;$('#sentiments-plus').disabled=rating===10;
  $('#clear-sentiments-rating').disabled=rating===null;
  $('#sentiments-score-hint').textContent=rating===null?'Not rated · excluded from the daily score.':`${scoreText(rating)} / 10 · included in the daily score.`;
}
function updateSentiments(changes) {
  store.updateSentiments(selectedDate,changes);
  renderSentiments();renderScore();renderReview();renderHeader();
}
$('#sentiments-notes').addEventListener('input',event=>updateSentiments({notes:event.target.value}));
$('#sentiments-rating').addEventListener('input',event=>{
  const input=event.target;input.setCustomValidity('');
  if(input.validity.valid)updateSentiments({rating:input.value===''?null:Number(input.value)});
});
$('#sentiments-rating').addEventListener('blur',()=>{
  if(!$('#sentiments-rating').checkValidity()) {$('#sentiments-rating').value=store.loadDay(selectedDate).sentiments.rating??'';}
});
let sentimentPointer=-1;
function adjustSentiments(direction) {const value=store.loadDay(selectedDate).sentiments.rating;updateSentiments({rating:value===null?0:Math.max(0,Math.min(10,Math.round(value*10+direction)/10))});}
$('#sentiments-minus').addEventListener('click',()=>adjustSentiments(-1));
$('#sentiments-plus').addEventListener('click',()=>adjustSentiments(1));
const sentimentMeter=$('#sentiments-meter');
function dragSentiments(event) {
  const rect=sentimentMeter.querySelector('svg').getBoundingClientRect();
  const score=scoreFromPoint((event.clientX-rect.left)*220/rect.width,(event.clientY-rect.top)*210/rect.height,110,110,{min:0,max:10});
  if(score!==null&&score!==store.loadDay(selectedDate).sentiments.rating)updateSentiments({rating:score});
}
sentimentMeter.addEventListener('pointerdown',event=>{
  if(!event.isPrimary||event.pointerType==='mouse'&&event.button!==0)return;
  const rect=sentimentMeter.querySelector('svg').getBoundingClientRect();
  sentimentMeter.focus({preventScroll:true});
  if(Math.hypot((event.clientX-rect.left)*220/rect.width-110,(event.clientY-rect.top)*210/rect.height-110)<43)return;
  event.preventDefault();sentimentPointer=event.pointerId;sentimentMeter.setPointerCapture(event.pointerId);sentimentMeter.classList.add('dragging');dragSentiments(event);
});
sentimentMeter.addEventListener('pointermove',event=>{if(sentimentPointer===event.pointerId)dragSentiments(event);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])sentimentMeter.addEventListener(type,event=>{if(sentimentPointer!==event.pointerId)return;sentimentPointer=-1;sentimentMeter.classList.remove('dragging');if(sentimentMeter.hasPointerCapture(event.pointerId))sentimentMeter.releasePointerCapture(event.pointerId);});
sentimentMeter.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  const direction={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[event.key];
  if(direction) {event.preventDefault();adjustSentiments(direction);}
  else if(event.key==='Home'||event.key==='End') {event.preventDefault();updateSentiments({rating:event.key==='Home'?0:10});}
});
$('#clear-sentiments-rating').addEventListener('click',()=>{ $('#sentiments-rating').setCustomValidity('');updateSentiments({rating:null}); });
function renderTargetEditor(week,reset=false) {
  const values=[...GROUPS.map(group=>({...group,target:week.groups.find(item=>item.id===group.id)?.target??group.target})),...week.groups.filter(group=>!GROUPS.some(active=>active.id===group.id))];
  const signature=JSON.stringify(week.groups.map(group=>[group.id,group.target]));
  if(!reset&&targetScope===week.start&&targetSignature===signature)return;
  targetScope=week.start;targetSignature=signature;targetBaseline=values;
  targetDraft=new Map(values.map(group=>[group.id,Math.min(20,group.target)]));
  $('#target-inputs').innerHTML=values.map(group=>`<div class="target-control"><h4 id="target-label-${group.id}">${escapeHtml(group.name)}</h4><div class="target-meter" data-target-meter="${group.id}" role="slider" tabindex="0" aria-label="${escapeHtml(group.name)} weekly set target" aria-describedby="target-meter-help" aria-valuemin="0" aria-valuemax="20"><svg viewBox="0 0 220 210" aria-hidden="true"><path class="meter-track" d="${meterPath()}"/><path class="meter-fill" d="${meterPath()}" pathLength="100"/><circle class="meter-knob" r="7"/></svg><div class="target-number" aria-hidden="true"><strong></strong><small>sets / week</small></div><span class="target-endpoint start" aria-hidden="true">0</span><span class="target-endpoint end" aria-hidden="true">20</span></div><div class="target-adjustments"><button type="button" class="adjust-button" data-adjust-target="${group.id}" data-direction="-1" aria-label="Decrease ${escapeHtml(group.name)} target">−</button><button type="button" class="adjust-button" data-adjust-target="${group.id}" data-direction="1" aria-label="Increase ${escapeHtml(group.name)} target">+</button></div></div>`).join('');
  const larger=values.filter(group=>group.target>20);
  $('#target-legacy-notice').hidden=!larger.length;
  $('#target-legacy-notice').textContent=larger.length?`Previously saved: ${larger.map(group=>`${escapeHtml(group.name)} ${group.target}`).join(', ')}. These remain saved until you save the displayed 0–20 targets.`:'';
  for(const group of values)paintTarget(group.id);
}
function paintTarget(id) {
  const meter=$(`[data-target-meter="${id}"]`),value=targetDraft.get(id),point=meterPoint(1+value/20*9);
  meter.setAttribute('aria-valuenow',value);meter.setAttribute('aria-valuetext',value===0?'0 sets. No goal for this muscle.':`${value} sets per week`);
  meter.querySelector('.target-number strong').textContent=value;
  setMeter(meter.querySelector('.meter-fill'),value*5,{immediate:targetDrag!==null});
  const knob=meter.querySelector('.meter-knob');knob.setAttribute('cx',point.x);knob.setAttribute('cy',point.y);
  $(`[data-adjust-target="${id}"][data-direction="-1"]`).disabled=value===0;
  $(`[data-adjust-target="${id}"][data-direction="1"]`).disabled=value===20;
  const total=[...targetDraft.values()].reduce((sum,value)=>sum+value,0),dirty=targetBaseline.some(group=>group.target!==targetDraft.get(group.id));
  $('#target-draft-status').textContent=`${total} goal sets per week · ${dirty?'Unsaved changes':'Targets ready to edit'}`;
}
function changeTarget(id,value) {targetDraft.set(id,Math.max(0,Math.min(20,Math.round(value))));paintTarget(id);}
$('#target-inputs').addEventListener('click',event=>{
  const button=event.target.closest('[data-adjust-target]');if(!button)return;
  changeTarget(button.dataset.adjustTarget,targetDraft.get(button.dataset.adjustTarget)+Number(button.dataset.direction));
});
$('#target-inputs').addEventListener('keydown',event=>{
  const meter=event.target.closest('[data-target-meter]');if(!meter||event.altKey||event.ctrlKey||event.metaKey)return;
  const id=meter.dataset.targetMeter,direction={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[event.key];
  if(direction){event.preventDefault();changeTarget(id,targetDraft.get(id)+direction);}
  else if(event.key==='Home'||event.key==='End'){event.preventDefault();changeTarget(id,event.key==='Home'?0:20);}
});
function pointTarget(event,meter) {
  const rect=meter.querySelector('svg').getBoundingClientRect();
  return scoreFromPoint((event.clientX-rect.left)*220/rect.width,(event.clientY-rect.top)*210/rect.height,110,110,{min:0,max:20,step:1});
}
$('#target-inputs').addEventListener('pointerdown',event=>{
  const meter=event.target.closest('[data-target-meter]');
  if(!meter||!event.isPrimary||event.pointerType==='mouse'&&event.button!==0)return;
  meter.focus({preventScroll:true});
  const rect=meter.querySelector('svg').getBoundingClientRect();
  if(Math.hypot((event.clientX-rect.left)*220/rect.width-110,(event.clientY-rect.top)*210/rect.height-110)<43)return;
  event.preventDefault();targetDrag={id:meter.dataset.targetMeter,pointer:event.pointerId};meter.setPointerCapture(event.pointerId);meter.classList.add('dragging');
  const value=pointTarget(event,meter);if(value!==null)changeTarget(targetDrag.id,value);
});
$('#target-inputs').addEventListener('pointermove',event=>{
  if(!targetDrag||targetDrag.pointer!==event.pointerId)return;
  const meter=$(`[data-target-meter="${targetDrag.id}"]`),value=pointTarget(event,meter);
  if(value!==null&&value!==targetDraft.get(targetDrag.id))changeTarget(targetDrag.id,value);
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('#target-inputs').addEventListener(type,event=>{
  if(!targetDrag||targetDrag.pointer!==event.pointerId)return;
  const meter=$(`[data-target-meter="${targetDrag.id}"]`);targetDrag=null;meter.classList.remove('dragging');
  if(meter.hasPointerCapture(event.pointerId))meter.releasePointerCapture(event.pointerId);
});
$('#cancel-targets').addEventListener('click',()=>{renderTargetEditor(store.loadWeek(selectedDate),true);cloud?.resume();announce('Target edits discarded. Saved targets are unchanged.');});
function renderGym() {
  const day = store.loadDay(selectedDate), entries = store.loadTrainingDay(selectedDate), week = store.loadWeek(selectedDate),pace=store.trainingProgress(selectedDate);
  $('#training-date').textContent = `Entries for ${longDate(selectedDate)}.`;
  const noLift=['rest','unplanned-rest','rest-unclassified'].includes(day.trainingMode);
  $$('[name="training-mode"]').forEach(input => { input.checked=input.value==='no'?noLift:day.trainingMode==='training';input.disabled=input.value==='no'&&entries.length>0; });
  $('#gym-form').hidden=day.trainingMode!=='training';
  $('#training-rest-hint').textContent=entries.length?'4 points for attendance. Goal sets earn the remaining 6; non-goal sets count at 25%.':noLift?'Rest is logged. Credits are assigned in date order; no advance planning needed.':day.trainingMode==='training'?'Attendance logged · 4 points. Add sets to earn up to 6 more.':'Answer Yes or No to log this day. Unanswered dates stay unlogged.';
  const restReason=pace.goalsComplete?'All weekly goals met · rest covered':pace.restCreditUsed?'Rest day covered':'Weekly rest allowance used up';
  $('#training-pace').innerHTML=`${circle(pace.score,true)}<div><strong>${pace.logged&&!pace.target?'No targets · not scored':pace.logged?`Gym score · ${scoreText(pace.score)} / 10`:'Gym score · not logged'}</strong><span>${pace.rest?(pace.target?restReason:'Rest recorded · gym not scored'):`${pace.useful} goal set${pace.useful===1?"":"s"}${pace.nonUseful?` · ${pace.nonUseful} non-goal set${pace.nonUseful===1?"":"s"}`:""}`}</span><small>${pace.target?`Daily target · ${pace.dailyTarget} sets for all 6 set points`:'Set muscle targets below to include gym in the daily average.'}</small></div>`;
  $('#muscle-suggestions').innerHTML=`<h4 id="muscle-suggestions-title">Most needed for your goal</h4>${pace.suggestions.length?`<div>${pace.suggestions.map(group=>`<span><strong>${escapeHtml(group.name)}</strong><small>${group.remaining} sets remaining · ${group.credited}/${group.target}</small></span>`).join('')}</div><p>Based on progress through this date.${pace.rest?' Saved for your next lifting day.':''}</p>`:pace.target?'<p>Every muscle target is met. Non-goal sets earn 25% daily credit; further rest is covered without using credits.</p>':'<p>No muscle targets set. Your total sets still stay in your log.</p>'}`;
  $('#daily-training-entries').innerHTML = entries.length ? `<ul>${entries.map(entry => {const credit=pace.classifications.find(value=>value.id===entry.id);return `<li><span><strong>${muscleName(entry.groupId)}</strong><small>${credit.useful} goal set${credit.useful===1?"":"s"}${credit.nonUseful?` · ${credit.nonUseful} non-goal set${credit.nonUseful===1?"":"s"}`:""}</small></span><button class="text-button" data-remove-entry="${entry.id}" aria-label="Remove ${entry.sets} ${entry.groupId} sets from ${shortDate(entry.date)}">Remove</button></li>`;}).join('')}</ul>` : `<div class="training-empty"><strong>${noLift?'Rest day':day.trainingMode==='training'?'Gym attendance logged':'No sets logged.'}</strong><p>${noLift?'No sets recorded for this date.':'Your sets will appear here.'}</p></div>`;
  const total = week.entries.reduce((sum, entry) => sum + entry.sets, 0), target = week.groups.reduce((sum, group) => sum + group.target, 0);
  const weekCredit=week.groups.reduce((sum,group)=>sum+Math.min(group.completed,group.target),0);
  $('#gym-summary').textContent = `${weekCredit} / ${target}`;
  $('#gym-total-sets').textContent=total;
  $('#gym-credit-summary').textContent=`${total} total sets logged · ${weekCredit} count toward muscle targets.${total>weekCredit?` ${total-weekCredit} non-goal set${total-weekCredit===1?" remains":"s remain"} in your log.`:''}`;
  $('#weekly-rest-credits').innerHTML=`<div><span class="eyebrow">Weekly rest credits</span><strong>${pace.restCredits}<small> / 2 left</small></strong></div><p>Remaining through ${shortDate(selectedDate)}<br>Resets every Monday</p>`;
  $('#gym-week-label').textContent = `${shortDate(week.start)} – ${shortDate(week.end)} · Monday–Sunday · ${week.targetSource?'targets repeat until edited':'default targets · edit below'}`;
  const volumeGroups=[...week.groups];
  for(const entry of week.entries.filter(entry=>entry.groupId!=='legs')) if(!volumeGroups.some(group=>group.id===entry.groupId)) volumeGroups.push({id:entry.groupId,name:muscleName(entry.groupId),target:null,completed:week.entries.filter(item=>item.groupId===entry.groupId).reduce((sum,item)=>sum+item.sets,0)});
  $('#gym-groups').innerHTML = volumeGroups.length ? volumeGroups.map(group => `<div><div class="gym-group-heading"><span>${escapeHtml(group.name)}</span><span>${group.completed} <small>${group.target ? `/ ${group.target} sets` : 'sets · no target'}</small></span></div>${group.target?`<div class="gym-progress" role="img" aria-label="${escapeHtml(group.name)}: ${group.completed} of ${group.target} sets"><span style="width:${Math.min(100, group.completed / group.target * 100)}%;background:${scoreColor(group.completed / group.target * 10)}"></span></div>${group.completed > group.target ? `<p class="over-target">${group.completed - group.target} over target</p>` : ''}`:''}</div>`).join('') : '<p class="hint">No targets for this week yet. Add them below; your sets are still saved.</p>';
  renderTargetEditor(week);
  $('#gym-log').innerHTML = week.entries.length ? `<ul>${week.entries.map(entry => `<li><span>${shortDate(entry.date)} · ${muscleName(entry.groupId)} · ${entry.sets} sets</span><button class="text-button" data-remove-entry="${entry.id}" aria-label="Remove ${entry.sets} ${entry.groupId} sets from ${shortDate(entry.date)}">Remove</button></li>`).join('')}</ul>` : '<p class="hint">No entries this week.</p>';
}
function renderReview() {
  const progress = store.dayProgress(selectedDate), reviewing = reviewSessionDate === selectedDate && !progress.completedAt;
  $('#review-banner').hidden = !reviewing || view === 'history' || view === 'today';
  $('#review-title').textContent = progress.canComplete ? 'All section reviews confirmed' : 'Review each section';
  $('#review-description').textContent = `${shortDate(selectedDate)} · ${progress.reviewedCount} of 3 confirmed. Full-day summary follows.`;
  $('#review-steps').innerHTML = progress.sections.map((section, index) => `<button data-open-section="${section.id}" class="review-step ${section.reviewed ? 'reviewed' : ''} ${view === section.id ? 'current' : ''}"><span>${section.reviewed ? '✓' : index + 1}</span>${section.label}</button>`).join('');
  $$('[data-start-review]').forEach(button => { button.textContent = progress.completedAt ? 'View day summary →' : progress.canComplete ? 'Review full day →' : `${progress.reviewedCount || reviewing ? 'Continue' : 'Start'} day review →`; });
  for (const section of progress.sections) {
    const button = $(`[data-confirm="${section.id}"]`), invalidRating = section.id === 'nutrition' && !$('#rating-value').validity.valid;
    const label = {nutrition:'nutrition',training:'training',checklists:'checklist'}[section.id];
    const next = progress.sections.find(item => item.id !== section.id && !item.reviewed);
    button.disabled = !section.ready || section.reviewed || invalidRating;
    button.textContent = section.reviewed ? `✓ ${label[0].toUpperCase()+label.slice(1)} reviewed` : `Confirm ${label} review${reviewing ? ' →' : ''}`;
    button.classList.toggle('is-reviewed', section.reviewed);
    const purpose = section.id === 'checklists' ? 'Unfinished tasks stay unchecked.' : 'Confirms this section’s review.';
    $(`#${section.id}-review-hint`).textContent = invalidRating ? 'Enter a rating from 1 to 10 in steps of 0.1.' : !section.ready ? section.id === 'nutrition' ? 'Enter a nutrition rating first.' : 'Answer Yes to record gym attendance, or No to record rest.' : section.reviewed ? section.id === 'checklists' ? 'Review confirmed. Unfinished tasks stay unchecked.' : 'Review confirmed.' : `${purpose} ${reviewing ? next ? `Next: ${next.label}.` : 'Next: full-day summary.' : 'A full-day summary comes before completion.'}`;
    $(`#tab-${section.id} .tab-check`).textContent = section.reviewed ? '✓' : '';
    $(`#tab-${section.id}`).setAttribute('aria-label', `${viewLabels[section.id]}${section.reviewed ? ', reviewed' : ''}`);
  }
}
function renderNotes() {
  const notes = store.loadDay(selectedDate).notes;
  $$('[data-notes]').forEach(input => { const value=input.dataset.notes==='day'?store.loadDay(selectedDate).comment:input.dataset.notes==='sentiments'?store.loadDay(selectedDate).sentiments.notes:notes[input.dataset.notes];if(input.value!==value)input.value=value; });
  refreshNoteCarets();
}
$$('[data-notes]').filter(input=>!['day','sentiments'].includes(input.dataset.notes)).forEach(input => input.addEventListener('input', () => {
  store.updateNotes(selectedDate, input.dataset.notes, input.value);
  renderReview(); renderHeader(); renderScore();
}));
function renderHistory() {
  $('#calendar-month').textContent = dateFormat(calendarMonth, { month:'long', year:'numeric' });
  const today = localDateKey(new Date(), timeZone);
  const dates = monthGrid(calendarMonth);
  const monthDates = dates.filter(date => date.slice(0,7) === calendarMonth.slice(0,7));
  const monthly = averageDays(monthDates, summaryFor);
  $('#monthly-score').innerHTML = circle(monthly.score,true)+`<span><strong>Month average</strong><small>${monthly.count} of ${monthly.total} days logged${monthly.provisional?' · partial':''}</small></span>`;
  $('#monthly-score').setAttribute('aria-label',`Month average ${scoreText(monthly.score)} out of 10. ${monthly.count} of ${monthly.total} days logged${monthly.provisional?', partial':''}.`);
  const streak=loggingStreak(today,summaryFor);
  $('#calendar-streak').innerHTML=`<strong>${streak.count}<small> day${streak.count===1?'':'s'}</small></strong><span>Logging streak<small>All 3 categories logged${streak.count&&!streak.includesToday?' · through yesterday':''}</small></span>`;
  $('#calendar').innerHTML = dates.map((date, index) => {
    const summary = summaryFor(date), day = store.loadDay(date), reward=scoreReward(summary.score);
    let cell = `<button class="calendar-day ${reward} ${date.slice(0,7) === calendarMonth.slice(0,7) ? '' : 'outside-month'} ${date === selectedDate ? 'selected' : ''} ${date === today ? 'is-today' : ''}" data-calendar-date="${date}" aria-label="${longDate(date)}, ${summary.score === null ? 'no score' : `${summary.provisional ? 'provisional ' : ''}daily score ${scoreText(summary.score)} out of 10${reward?summary.score===10?', perfect score':', high score':''}`}${day.completedAt ? ', day complete' : ''}" aria-pressed="${date === selectedDate}" ${date === today ? 'aria-current="date"' : ''}><span class="calendar-date">${Number(date.slice(-2))}</span>${circle(summary.score,true)}${day.completedAt ? '<span class="calendar-complete" aria-hidden="true">✓</span>' : ''}</button>`
    if (index % 7 === 6) {
      const weekDates = dates.slice(index - 6, index + 1);
      const weekly = averageDays(weekDates, summaryFor);
      cell += '<div class="calendar-week-score" role="img" aria-label="Week of ' + shortDate(weekDates[0]) + ', Monday to Sunday average ' + scoreText(weekly.score) + ' out of 10, ' + weekly.count + ' of 7 days logged' + (weekly.provisional ? ', partial' : '') + '">' + circle(weekly.score,true) + '<small>' + weekly.count + '/7' + (weekly.provisional ? ' · partial' : '') + '</small></div>';
    }
    return cell;
  }).join('');
  renderRecap();
}
function recapMarkup({final=false}={}) {
  const day=store.loadDay(selectedDate),recap=dailyRecap(day,store.loadTrainingDay(selectedDate),store.loadWeek(selectedDate));
  const status=recap.completed?'✓ '+recap.state:recap.state;
  const training=recap.training.rest?`Rest<small> ${scoreText(recap.training.score)} / 10</small>`:recap.training.score!==null?`${scoreText(recap.training.score)}<small> / 10 · ${recap.training.sets} sets</small>`:'—';
  const tasks=recap.checklistLogged?`${recap.done}<small> / ${recap.total}</small>`:recap.total?`—<small> / ${recap.total}</small>`:'—';
  const taskLine=(task,child=false)=>`<li class="${task.done?'is-done':''} ${child?'recap-child':''}"><span class="recap-check" aria-hidden="true">${task.done?'✓':'·'}</span><span><span class="sr-only">${task.done?'Completed: ':'Unfinished: '}</span>${escapeHtml(task.name)}</span></li>`;
  return `
    <div class="recap-score" role="group" aria-label="${recap.score===null?'No daily score yet':`Daily score ${scoreText(recap.score)} out of 10`}">
      ${circle(recap.score,true)}<div><span class="state-pill ${recap.completed?'complete':''}">${status}</span><p>${recap.logged} of ${recap.sections.length} logged <span>·</span> ${recap.reviewed} reviewed</p>${recap.provisional&&recap.score!==null?'<small>Provisional score</small>':''}</div>
    </div>
    <div class="recap-metrics">
      <button data-open-section="nutrition" aria-label="Open nutrition for this day"><span>Nutrition</span><strong>${scoreText(day.nutrition)}<small>${day.nutrition===null?'':' / 10'}</small></strong></button>
      <button data-open-section="training" aria-label="Open daily training for this day"><span>Training</span><strong>${training}</strong></button>
      <button data-open-section="checklists" aria-label="Open checklist for this day"><span>Tasks</span><strong>${tasks}</strong></button>
    </div>
    ${!recap.hasActivity?`<div class="recap-empty"><strong>Nothing logged for this day.</strong><p>Open the day to add an entry.${recap.tasks.length?' Scheduled tasks appear below.':''}</p></div>`:''}
    ${recap.tasks.length?`<details class="recap-section" open><summary>Checklist <span>${recap.checklistLogged?`${recap.done} / ${recap.total} done`:'Not checked in'}</span></summary><ul class="recap-tasks">${recap.tasks.map(task=>taskLine(task)+task.children.map(child=>taskLine(child,true)).join('')).join('')}</ul></details>`:recap.checklistLogged?'<p class="recap-no-tasks">No tasks due · reviewed</p>':''}
    ${recap.training.groups.length?`<section class="recap-section"><h4>Training <span>${recap.training.sets} sets</span></h4><ul class="recap-training">${recap.training.groups.map(group=>`<li><span>${escapeHtml(muscleName(group.id))}</span><strong>${group.sets}</strong></li>`).join('')}</ul></section>`:''}
    ${recap.notes.filter(note=>!final||note.section!=='nutrition').map(note=>`<section class="recap-section recap-note"><h4>${note.section==='nutrition'?'Nutrition':'Training'} notes</h4><p>${escapeHtml(note.text)}</p></section>`).join('')}
    ${day.sentiments.notes.trim()||day.sentiments.rating!==null?`<section class="recap-section recap-note sentiment-recap"><h4><button class="text-button" data-open-section="sentiments">Sentiments</button><span>${day.sentiments.rating===null?'Notes only · not scored':`${scoreText(day.sentiments.rating)} / 10 · included in score`}</span></h4>${day.sentiments.notes.trim()?`<p>${escapeHtml(day.sentiments.notes)}</p>`:''}</section>`:''}
    ${!final&&day.comment?.trim()?`<section class="recap-section recap-note"><h4>Day comment</h4><p>${escapeHtml(day.comment)}</p></section>`:''}`;
}
function renderRecap() {
  $('#history-date').textContent=dateFormat(selectedDate,{weekday:'short',month:'short',day:'numeric'});
  $('#history-content').innerHTML=recapMarkup();
  if(recapDate&&recapDate!==selectedDate)reveal($('#history-content'));
  recapDate=selectedDate;
}
function render() { renderHeader(); renderTasks(); renderScore(); renderRating(); renderGym(); renderSentiments(); renderNotes(); renderReview(); if (view === 'history') renderHistory(); renderSaveStatus(); }
function setView(next, focus = false) {
  if (!Object.hasOwn(viewLabels, next)) return;
  const changed=view!==next;
  view = next; render();
  if(changed)reveal($('#'+panelIds[view]));
  $('#main').scrollTo({top:0,behavior:'instant'});
  if (focus) ($('#tab-' + view)||$('#main')).focus({preventScroll:true});
}
function navigateDay(date, changeMonth = true) {
  if (date !== selectedDate) reviewSessionDate = null;
  selectedDate = date; if (changeMonth) calendarMonth = date;
  $('#task-name').value = ''; $('#rating-value').setCustomValidity(''); $('#gym-sets').setCustomValidity('');
  $('#gym-log').hidden = true; $('#toggle-gym-log').setAttribute('aria-expanded','false'); $('#toggle-gym-log').textContent = "View week's entries";
  render();
}
function startReview() {
  const progress = store.dayProgress(selectedDate);
  if (progress.completedAt) { showFinalReview(); return; }
  if (progress.canComplete) { showFinalReview(); return; }
  reviewSessionDate = selectedDate;
  setView((progress.sections.find(section => !section.ready) || progress.sections.find(section => !section.reviewed)).id, true);
}
function startCompletion() {
  const progress = store.dayProgress(selectedDate);
  if (progress.completedAt) { showFinalReview(); return; }
  if (!progress.canComplete) { startReview(); return; }
  showFinalReview();
}
function showFinalReview() {
  const progress=store.dayProgress(selectedDate);
  if(!progress.canComplete)return;
  setView('today');
  $('#final-review-date').textContent=longDate(selectedDate);
  $('#final-review-content').innerHTML=recapMarkup({final:true});
  $('#day-comment').value=store.loadDay(selectedDate).comment;
  $('#submit-day').disabled=!!progress.completedAt;
  $('#submit-day').textContent=progress.completedAt?'✓ Day complete':'Complete entire day';
  $('#final-review-intro').textContent=progress.completedAt?'This day is complete. Day comments save as you type. Tap a category to make a change.':'All three section reviews are confirmed. Take one last look. Tap a category to make a change.';
  showDialog($('#final-review-dialog'));
  refreshNoteCarets();
}
function updateRating(score, notify = false) {
  store.updateRating(selectedDate, score);
  renderRating(); renderScore(); renderReview(); renderHeader();
  if (notify) announce(score === null ? 'Nutrition rating cleared.' : `Nutrition set to ${scoreText(score)}.`);
}
function updateClock() {
  const now = new Date(), parts = new Intl.DateTimeFormat('en-US', { timeZone, hour:'numeric', minute:'2-digit', hour12:true }).formatToParts(now);
  const value = type => parts.find(part => part.type === type)?.value ?? '';
  $('#clock-time').innerHTML = `${value('hour')}:${value('minute')}<small>${value('dayPeriod').toLowerCase()}</small>`;
  $('#clock-time').dateTime = now.toISOString();
  $('#clock-date').textContent = new Intl.DateTimeFormat('en-US', { timeZone, weekday:'long', month:'short', day:'numeric' }).format(now);
}

$$('[data-tab]').forEach(button => {
  button.addEventListener('click', () => {if(view!==button.dataset.tab)setView(button.dataset.tab);});
  button.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const tabs = $$('[data-tab]'), index = tabs.indexOf(button);
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); setView(tabs[next].dataset.tab, true);
  });
});
$('#previous-day').addEventListener('click', () => navigateDay(addDays(selectedDate, -1)));
$('#next-day').addEventListener('click', () => navigateDay(addDays(selectedDate, 1)));
$('#go-today').addEventListener('click', () => navigateDay(localDateKey(new Date(), timeZone)));
$('#notice-go-today').addEventListener('click', () => navigateDay(localDateKey(new Date(), timeZone)));
for (const id of ['date-short', 'open-calendar']) $('#' + id).addEventListener('click', () => { calendarMonth = selectedDate; setView('history', true); });
$('#history-today').addEventListener('click', () => navigateDay(localDateKey(new Date(), timeZone)));
$('#open-selected-day').addEventListener('click', () => setView('today', true));
$('#previous-month').addEventListener('click', () => { calendarMonth = moveMonth(calendarMonth, -1); renderHistory(); });
$('#next-month').addEventListener('click', () => { calendarMonth = moveMonth(calendarMonth, 1); renderHistory(); });
$('#calendar').addEventListener('click', event => {
  const button = event.target.closest('[data-calendar-date]'); if (!button) return;
  navigateDay(button.dataset.calendarDate, false);
  $(`[data-calendar-date="${selectedDate}"]`).focus({preventScroll:true});
});
$('#calendar').addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  const button=event.target.closest('[data-calendar-date]');if(!button)return;
  const day=new Date(button.dataset.calendarDate+'T12:00:00Z').getUTCDay(),monday=(day+6)%7;
  const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-monday,End:6-monday}[event.key];
  if(offset===undefined)return;
  event.preventDefault();navigateDay(addDays(button.dataset.calendarDate,offset));
  $(`[data-calendar-date="${selectedDate}"]`).focus({preventScroll:true});
});
for (const id of ['overview-sections', 'review-steps','history-content','final-review-content']) $('#' + id).addEventListener('click', event => {
  const button = event.target.closest('[data-open-section]');
  if(button) { if(id==='final-review-content')closeDialog($('#final-review-dialog'));setView(button.dataset.openSection, true); }
});
$('#open-checklist').addEventListener('click', () => { setView('checklists'); $('#open-task-composer').focus(); });
for (const id of ['overview-task-list', 'task-list']) $('#' + id).addEventListener('click',event=>{
  const button=event.target.closest('[data-expand-task]');if(!button)return;
  const taskId=button.dataset.expandTask;
  if(expandedTasks.has(taskId))expandedTasks.delete(taskId);else expandedTasks.add(taskId);
  renderTasks();$(`#${id} button[data-expand-task="${taskId}"]`).focus({preventScroll:true});
});
for (const id of ['overview-task-list', 'task-list']) $('#' + id).addEventListener('change', event => {
  const input = event.target.closest('[data-task-id]'); if (!input) return;
  const taskId = input.dataset.taskId, checked = input.checked;
  store.toggleTask(selectedDate, taskId); render();
  $(`#${id} [data-task-id="${taskId}"]`).focus({preventScroll:true});
  if(checked)checkOff($(`#${id} [data-task-id="${taskId}"]`));
  announce(checked ? 'Task checked off.' : 'Task marked incomplete.');
});
$('#task-list').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-task]'); if (!button) return;
  const date = selectedDate, removed = store.removeTask(date, button.dataset.removeTask);
  render(); $('#open-task-composer').focus({preventScroll:true});
  announce('Task removed.', () => { store.restoreTask(date, removed.task, removed.index); render(); announce('Task restored.'); });
});
$('#undo-action').addEventListener('click', () => undoAction?.());
const taskTextMeasure=document.createElement('canvas').getContext('2d');
function fitTaskField(field) {
  if(!field.clientWidth)return;
  const style=getComputedStyle(field),size=Number.parseFloat(style.fontSize);
  if(taskTextMeasure)taskTextMeasure.font=`${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
  const metrics=taskTextMeasure?.measureText(field.value||field.placeholder||'M');
  const caps=taskTextMeasure?.measureText('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
  const fontAscent=metrics?.fontBoundingBoxAscent??size*.75,fontDescent=metrics?.fontBoundingBoxDescent??size*.25;
  const ascent=caps?.actualBoundingBoxAscent??size*.7,descent=metrics?.actualBoundingBoxDescent??size*1.15;
  const borders=Number.parseFloat(style.borderTopWidth)+Number.parseFloat(style.borderBottomWidth);
  function measure(lineHeight) {
    const leading=(lineHeight-fontAscent-fontDescent)/2;
    const top=Math.ceil(Math.max(0,ascent-fontAscent-leading)+1);
    const bottom=Math.ceil(Math.max(0,descent-fontDescent-leading)+1);
    field.style.lineHeight=`${lineHeight}px`;
    field.style.paddingTop=`${top}px`;field.style.paddingBottom=`${bottom}px`;
    // Let the underline follow the ink without shifting the surrounding layout.
    field.style.marginBottom=`-${bottom-1}px`;
    field.style.height='0px';
    return {height:Math.ceil(field.scrollHeight+borders),lines:Math.round((field.scrollHeight-top-bottom)/lineHeight)};
  }
  let fitted=measure(size);
  if(fitted.lines>1)fitted=measure(Math.ceil(size*1.5));
  field.style.height=`${fitted.height}px`;
}
function fitTaskFields() { if($('#task-dialog').open)$$('#task-name,[data-child-name]').forEach(fitTaskField); }
document.fonts.ready.then(fitTaskFields);
document.fonts.addEventListener('loadingdone',fitTaskFields);
window.addEventListener('resize',fitTaskFields);
function updateFrequency() { $('#custom-weekdays').hidden=$('#task-frequency').value!=='custom';fitTaskFields(); }
$('#task-frequency').addEventListener('change',updateFrequency);
for(const id of ['open-task-composer','overview-add-task'])$('#'+id).addEventListener('click',event=>{
  taskComposerTrigger=event.currentTarget;
  $('#add-task-form').reset();$('#subtask-inputs').innerHTML='';$('#task-composer-error').textContent='';
  $('#task-name').style.height='';
  $('#task-start-date').textContent=longDate(selectedDate);updateFrequency();showDialog($('#task-dialog'));$('#task-name').focus();fitTaskFields();
});
$('#cancel-task').addEventListener('click',()=>closeDialog($('#task-dialog')));
$('#add-subtask').addEventListener('click',()=>{
  if($$('[data-child-name]').length>=20){$('#task-composer-error').textContent='Use up to 20 subtasks.';return;}
  const row=document.createElement('div');row.className='subtask-input-row';
  row.innerHTML='<textarea data-child-name rows="1" maxlength="100" placeholder="Subtask name" aria-label="Subtask name" autocomplete="off" required></textarea><button class="remove-task" type="button" data-remove-subtask aria-label="Remove subtask">×</button>';
  $('#subtask-inputs').append(row);row.querySelector('textarea').focus();fitTaskFields();
});
$('#add-task-form').addEventListener('input',event=>{
  $('#task-composer-error').textContent='';
  const field=event.target.closest('#task-name,[data-child-name]');if(!field)return;
  if(/[\r\n]/.test(field.value))field.value=field.value.replace(/[\r\n]+/g,' ');
  fitTaskField(field);
});
$('#add-task-form').addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.isComposing&&event.target.matches('#task-name,[data-child-name]')) {event.preventDefault();$('#add-task-form').requestSubmit();}
});
$('#subtask-inputs').addEventListener('click',event=>{const button=event.target.closest('[data-remove-subtask]');if(button){button.parentElement.remove();$('#add-subtask').focus();fitTaskFields();}});
$('#add-task-form').addEventListener('submit', event => {
  event.preventDefault(); const input = $('#task-name');
  const frequency=$('#task-frequency').value;
  const options={children:$$('[data-child-name]').map(input=>input.value),recurrence:frequency==='once'?null:{frequency,weekdays:$$('[name="repeat-day"]:checked').map(input=>Number(input.value))}};
  try { const id=store.addTask(selectedDate,input.value,options);if(id&&options.children.length)expandedTasks.add(id); }
  catch(error){$('#task-composer-error').textContent=error.message;return;}
  closeDialog($('#task-dialog'));render();taskComposerTrigger.focus({preventScroll:true});acknowledge($(view==='today'?'.overview-tasks':'.checklist-editor'));announce(frequency==='once'?'Task added for this day.':'Recurring task added.');
});
$('#task-name').addEventListener('input', event => event.target.setCustomValidity(''));
$('#recurring-tasks').addEventListener('click',event=>{
  const button=event.target.closest('[data-stop-template]');if(!button)return;
  store.stopTemplate(button.dataset.stopTemplate,localDateKey(new Date(),timeZone));render();announce('Recurring task stopped after today. Earlier days are kept.');
});
$('#rating-minus').addEventListener('click', () => { $('#rating-value').setCustomValidity(''); updateRating(adjustScore(store.loadDay(selectedDate).nutrition, -1), true); });
$('#rating-plus').addEventListener('click', () => { $('#rating-value').setCustomValidity(''); updateRating(adjustScore(store.loadDay(selectedDate).nutrition, 1), true); });
function commitRatingInput() {
  const input = $('#rating-value'); input.setCustomValidity('');
  if (!input.checkValidity()) { renderReview(); input.reportValidity(); return; }
  try { updateRating(input.value === '' ? null : Number(input.value), true); }
  catch (error) { input.setCustomValidity(error.message); renderReview(); input.reportValidity(); }
}
$('#rating-form').addEventListener('submit', event => { event.preventDefault(); commitRatingInput(); });
$('#rating-value').addEventListener('change', commitRatingInput);
$('#rating-value').addEventListener('input', event => {
  const input = event.target; input.setCustomValidity('');
  if (input.validity.valid) updateRating(input.value === '' ? null : Number(input.value)); else renderReview();
});
$('#clear-rating').addEventListener('click', () => { $('#rating-value').setCustomValidity(''); updateRating(null, true); $('#nutrition-meter').focus({preventScroll:true}); });
const nutritionMeter = $('#nutrition-meter');
nutritionMeter.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const current = store.loadDay(selectedDate).nutrition; let next;
  if (['ArrowUp','ArrowRight'].includes(event.key)) next = adjustScore(current, 1);
  else if (['ArrowDown','ArrowLeft'].includes(event.key)) next = adjustScore(current, -1);
  else if (event.key === 'Home') next = 1;
  else if (event.key === 'End') next = 10;
  else return;
  event.preventDefault(); updateRating(next);
});
function pointRating(event) {
  const rectangle = nutritionMeter.querySelector('svg').getBoundingClientRect();
  const value = scoreFromPoint((event.clientX - rectangle.left) * 220 / rectangle.width, (event.clientY - rectangle.top) * 210 / rectangle.height, 110, 110);
  if (value !== null && store.loadDay(selectedDate).nutrition !== value) updateRating(value);
}
nutritionMeter.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.pointerType === 'mouse' && event.button !== 0) return;
  const rectangle = nutritionMeter.querySelector('svg').getBoundingClientRect();
  const distance = Math.hypot((event.clientX - rectangle.left) * 220 / rectangle.width - 110, (event.clientY - rectangle.top) * 210 / rectangle.height - 110);
  if (distance < 43) { nutritionMeter.focus({preventScroll:true}); return; }
  event.preventDefault(); dragging = true; nutritionMeter.classList.add('dragging'); nutritionMeter.setPointerCapture(event.pointerId); nutritionMeter.focus({preventScroll:true}); pointRating(event);
});
nutritionMeter.addEventListener('pointermove', event => { if (dragging && nutritionMeter.hasPointerCapture(event.pointerId)) pointRating(event); });
function finishDragging(event) {
  if (!dragging) return;
  dragging = false; nutritionMeter.classList.remove('dragging');
  if (nutritionMeter.hasPointerCapture(event.pointerId)) nutritionMeter.releasePointerCapture(event.pointerId);
  const score = store.loadDay(selectedDate).nutrition;
  if (score !== null) announce(`Nutrition set to ${scoreText(score)}.`);
}
for (const type of ['pointerup','pointercancel','lostpointercapture']) nutritionMeter.addEventListener(type, finishDragging);

$('#gym-muscles').innerHTML = `<legend>Muscle group</legend><div class="muscle-choices">${GROUPS.map((group,index)=>`<label><input type="radio" name="muscle-group" value="${group.id}" ${index===0?'checked':''} required><span>${escapeHtml(group.name)}</span></label>`).join('')}</div>`;
function renderLogButton() { $('#log-sets').textContent=`+ Log ${muscleName($('[name="muscle-group"]:checked')?.value || '')} sets`; }
$('#gym-muscles').addEventListener('change',renderLogButton);
renderLogButton();
$('#gym-form').addEventListener('submit', event => {
  event.preventDefault(); const input = $('#gym-sets');
  try { store.addGymEntry(selectedDate, $('[name="muscle-group"]:checked')?.value, Number(input.value)); }
  catch (error) { input.setCustomValidity(error.message); input.reportValidity(); return; }
  render(); announce(`${input.value} sets logged for ${shortDate(selectedDate)}.`);
});
$('#gym-sets').addEventListener('input', event => event.target.setCustomValidity(''));
$$('[name="training-mode"]').forEach(input => input.addEventListener('change', () => {
  try { store.setTrainingMode(selectedDate, input.value==='no'?'rest':input.value); render(); }
  catch (error) { announce(error.message); renderGym(); }
}));
for (const id of ['daily-training-entries','gym-log']) $('#' + id).addEventListener('click', event => {
  const button = event.target.closest('[data-remove-entry]'); if (!button) return;
  store.removeGymEntry(button.dataset.removeEntry); render(); $('#gym-sets').focus({preventScroll:true}); announce('Set entry removed.');
});
$('#toggle-gym-log').addEventListener('click', () => {
  const log = $('#gym-log'); log.hidden = !log.hidden;
  $('#toggle-gym-log').setAttribute('aria-expanded', String(!log.hidden));
  $('#toggle-gym-log').textContent = log.hidden ? "View week's entries" : 'Hide entries';
});
$('#targets-form').addEventListener('submit', event => {
  event.preventDefault();
  const values = [...targetDraft].map(([id,target])=>({id,target}));
  try { store.setWeekTargets(selectedDate, values); $('.target-editor').open=false; render(); $('.target-editor summary').focus({preventScroll:true}); cloud?.resume(); announce('Targets saved. They repeat from this week until edited.'); }
  catch (error) { announce(error.message); }
});
$('#complete-day').addEventListener('click', startCompletion);
$$('[data-start-review]').forEach(button => button.addEventListener('click', startReview));
$('#finish-later').addEventListener('click', () => { reviewSessionDate = null; renderReview(); announce('Review paused. Your entries are saved.'); });
$$('[data-confirm]').forEach(button => button.addEventListener('click', () => {
  const section = button.dataset.confirm;
  if (section === 'nutrition' && !$('#rating-value').checkValidity()) { $('#rating-value').reportValidity(); return; }
  try { store.confirmSection(selectedDate, section); }
  catch (error) { announce(error.message); return; }
  if (reviewSessionDate === selectedDate) setView(store.dayProgress(selectedDate).sections.find(item => !item.reviewed)?.id || 'today', true);
  else render();
  if(store.dayProgress(selectedDate).canComplete) { showFinalReview(); announce('All sections reviewed. Check the full-day summary before completing the day.'); }
  else announce(`${viewLabels[section]} review confirmed.`);
}));
$('#submit-day').addEventListener('click',()=>{
  try { store.completeDay(selectedDate); }
  catch(error) { closeDialog($('#final-review-dialog'));render();announce(error.message);return; }
  closeDialog($('#final-review-dialog'));reviewSessionDate=null;setView('today',true);
  announce(`${shortDate(selectedDate)}: entire day completed and saved.`);
});
$('#day-comment').addEventListener('input',()=>store.updateDayComment(selectedDate,$('#day-comment').value));

function showDialog(dialog) { if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open','');reveal(dialog); }
function closeDialog(dialog) { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
$('#score-info').addEventListener('click', () => { closeDialog($('#settings-dialog')); showDialog($('#score-dialog')); });
$('#open-score-info').addEventListener('click',()=>showDialog($('#score-dialog')));
function openSettings() {
  $('#profile-name').value = displayName;
  $('#motion-setting').value=motionPreference;renderMotionSetting();
  $('#settings-message').textContent = storageError ? `Local storage issue: ${storageError}` : preview ? 'This preview saves separately from your personal Homebase data.' : '';
  $('#export-backup').textContent = 'Download local backup';
  $('#export-recovery').hidden = !(loaded.error && loaded.raw);
  showDialog($('#settings-dialog'));
}
$('#open-settings').addEventListener('click', openSettings);
$('#save-status').addEventListener('click', openSettings);
$('#preferences-form').addEventListener('submit', event => {
  event.preventDefault(); const input = $('#profile-name'), name = input.value.trim();
  if (!name) { input.setCustomValidity('Enter a name.'); input.reportValidity(); return; }
  displayName = name;
  try {preferences={...preferences,name,motion:motionPreference};localStorage.setItem(preferencesKey, JSON.stringify(preferences)); $('#settings-message').textContent = 'Your name is saved on this device.'; }
  catch { $('#settings-message').textContent = 'Name updated for this session. Browser storage is unavailable.'; }
  renderHeader();
});
$('#profile-name').addEventListener('input', event => event.target.setCustomValidity(''));
function renderMotionSetting() {
  const on=document.documentElement.dataset.motion==='full';
  $('#motion-description').textContent=motionPreference==='system'?`Following device setting: animations ${on?'on':'reduced'}.`:on?'Stepped transitions and score sweeps are on.':'Transitions and score sweeps are off.';
  $('#preview-motion').disabled=!on;
}
$('#motion-setting').addEventListener('change',event=>{
  motionPreference=setMotionPreference(event.target.value);renderMotionSetting();
  preferences={...preferences,name:displayName,motion:motionPreference};
  try {localStorage.setItem(preferencesKey,JSON.stringify(preferences));$('#settings-message').textContent='Motion preference saved on this device.';}
  catch {$('#settings-message').textContent='Motion updated for this session. Browser storage is unavailable.';}
  reveal($('#motion-preview'));
});
$('#preview-motion').addEventListener('click',()=>reveal($('#motion-preview')));
function downloadBackup() {
  flushSave();
  const content = JSON.stringify(store.exportSnapshot(), null, 2);
  const url = URL.createObjectURL(new Blob([content], { type:'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `homebase-backup-${localDateKey(new Date(), timeZone)}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  $('#settings-message').textContent = 'Backup download requested. Keep the file somewhere you can find again.';
}
$('#export-backup').addEventListener('click',downloadBackup);
$('#reset-backup').addEventListener('click',()=>{downloadBackup();$('#reset-message').textContent='Backup download requested. Confirm that you have the file before resetting.';});
$('#open-reset').addEventListener('click',()=>{
  $('#reset-scope').textContent=preview?'This resets preview data only. Personal Homebase data is separate.':cloud?.isEnabled()?'This clears your personal records here and syncs the reset to Firebase and your other signed-in devices.':'This resets Homebase data in this browser on this device.';
  $('#reset-message').textContent='';
  showDialog($('#reset-dialog'));
});
$('#confirm-reset').addEventListener('click',()=>{
  let reset;
  try {reset=resetLocal(localStorage,{suffix,expectedRaw:lastSavedRaw});}
  catch(error) {$('#reset-message').textContent=`Reset failed. ${error.message}`;return;}
  clearTimeout(saveTimer);pendingSnapshot=null;pendingImport=null;
  store=createStore({clientId,snapshot:reset.snapshot,seed:false,onChange:queueSave});
  lastSavedRaw=reset.raw;storageError=null;blockedSave=false;
  loaded.raw=null;loaded.error=null;loaded.snapshot=null;
  preferences={};displayName='Kieran';motionPreference=setMotionPreference('system');
  reviewSessionDate=null;recapDate=null;expandedTasks.clear();undoAction=null;
  $('#import-preview').hidden=true;$('#import-file').value='';$('#export-recovery').hidden=true;
  $('#add-task-form').reset();$('#subtask-inputs').innerHTML='';$('#custom-weekdays').hidden=true;
  $$('input,textarea').forEach(input=>input.setCustomValidity(''));$('#gym-sets').value='3';$('#task-composer-error').textContent='';
  $$('details').forEach(details=>details.open=false);$('#gym-log').hidden=true;$('#toggle-gym-log').setAttribute('aria-expanded','false');$('#toggle-gym-log').textContent="View week's entries";
  closeDialog($('#reset-dialog'));closeDialog($('#settings-dialog'));
  selectedDate=localDateKey(new Date(),timeZone);calendarMonth=selectedDate;
  setView('today',true);
  cloud?.changed();
  announce(`All ${preview?'preview':'Homebase'} data and preferences reset${cloud?.isEnabled()?' and queued to sync':' on this device'}.`);
});
$('#export-recovery').addEventListener('click', () => {
  if (!loaded.raw) return;
  const url = URL.createObjectURL(new Blob([loaded.raw], { type:'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `homebase-recovery-${localDateKey(new Date(), timeZone)}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  $('#settings-message').textContent = 'Original saved data downloaded for recovery. Your current entries can be downloaded separately above.';
});
$('#import-file').addEventListener('change', async event => {
  pendingImport = null; $('#import-preview').hidden = true;
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose a backup smaller than 10 MB.');
    pendingImport = validateSnapshot(JSON.parse(await file.text()));
    $('#import-summary').textContent = `${pendingImport.days.length} days, ${pendingImport.entries.length} training entries, and ${pendingImport.templates.length} recurring schedules. Import replaces this browser’s local records${cloud?.isEnabled()?' and syncs that replacement to your other devices':''}. Download your current backup first.`;
    $('#import-preview').hidden = false; $('#settings-message').textContent = '';
  } catch (error) { $('#settings-message').textContent = `Backup not imported. ${error.message}`; }
});
$('#cancel-import').addEventListener('click', () => { pendingImport = null; $('#import-preview').hidden = true; $('#import-file').value = ''; });
$('#confirm-import').addEventListener('click', () => {
  if (!pendingImport) return;
  try {
    clearTimeout(saveTimer);
    lastSavedRaw = writeLocal(storage, pendingImport);
    store = createStore({ clientId, snapshot:pendingImport, seed:false, onChange:queueSave });
    loaded.error = null; loaded.raw = null; storageError = null; blockedSave = false; pendingSnapshot = null; pendingImport = null;
    $('#import-preview').hidden = true; $('#import-file').value = ''; reviewSessionDate = null;
    cloud?.changed();
    $('#settings-message').textContent = 'Backup restored and saved on this device.';
    $('#export-backup').textContent = 'Download local backup';
    $('#export-recovery').hidden = true;
    navigateDay(localDateKey(new Date(), timeZone));
  } catch (error) { $('#settings-message').textContent = `Backup not imported. ${error.message}`; }
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY + suffix || event.newValue === lastSavedRaw) return;
  blockedSave = true; storageError = 'Another tab changed the saved data. Export this tab’s changes before reloading.';
  renderSaveStatus();
});
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
updateClock();
setInterval(() => { updateClock(); renderHeader(); }, 15000);
render();
reveal($('#'+panelIds[view]));
if (!loaded.snapshot && !loaded.error) queueSave(store.exportSnapshot());

cloud=mountCloud({
  preview,readLocal:()=>store.exportSnapshot(),
  flushLocal:()=>{flushSave();return !storageError&&!blockedSave;},
  canApply:()=>!blockedSave&&!pendingSnapshot&&!document.activeElement?.matches('input,textarea,select,[role="slider"]')&&!targetDrag&&!($('.target-editor').open&&targetBaseline.some(group=>group.target!==targetDraft.get(group.id))),
  applyLocal:snapshot=>{
    if(storage.getItem(STORAGE_KEY)!==lastSavedRaw)throw new Error('Another local tab changed your records. Reload after downloading a backup.');
    const raw=writeLocal(storage,snapshot);
    store=createStore({clientId,snapshot,seed:false,onChange:queueSave});lastSavedRaw=raw;pendingSnapshot=null;storageError=null;
    closeDialog($('#final-review-dialog'));reviewSessionDate=null;render();
  },
  onStatus:state=>{cloudLabel=state.label;renderSaveStatus();}
});
