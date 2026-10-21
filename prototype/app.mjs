
import { GROUPS, DAY_SECTIONS, addDays, adjustScore, createStore, isEditableDay, meterPath, meterPoint, monthGrid, moveMonth, scoreFromPoint } from './model.mjs';
import { summarizeDay, taskScoreRange, categorySummary, scoreColor as blueScoreColor, scoreGlow, scoreReward, averageDays, loggingStreak } from './scoring.mjs';
import {appDateKey, timeGreeting, lateCheckInWindow, createDayRollover} from './day-clock.mjs';
import { taskProgress, scheduleLabel, orderedTasks, activeTemplates } from './tasks.mjs';
import { handwritingCarets } from './handwriting-caret.mjs';
import { dailyRecap } from './recap.mjs';
import { mountCloud } from './cloud-ui.mjs';
import {mountReminders} from './reminders.mjs';
import { muscleName } from './muscles.mjs';
import { bindMeterDrag } from './meter-drag.mjs';
import { buildAchievements,sortAchievements,firstAchievementUnlocks } from './achievements.mjs';
import { achievementIcon } from './achievement-icons.mjs';
import {needsWelcome,profileName} from './onboarding.mjs';
import {snapshotRecords} from './cloud-records.mjs';
import {createRecordEdits} from './record-edits.mjs';
import {workspaceBusy} from './interaction-guard.mjs';
import {weightHistory,weightPlot,weightPointContext,weightDayChange,nearestWeightPoint} from './weight-history.mjs';
import { reveal, acknowledge, checkOff, setMeter, setMotionPreference } from './motion.mjs';
import { STORAGE_KEY, readLocal, writeLocal, validateSnapshot, resetLocal } from './persistence.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const refreshNoteCarets=handwritingCarets($$('[data-notes],#task-name'));
const nutritionNotesHeading=document.createElement('div');nutritionNotesHeading.className='nutrition-notes-heading';
$('.nutrition-notes>label').before(nutritionNotesHeading);nutritionNotesHeading.append($('.nutrition-notes>label'),$('#clear-rating'));
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
const scoreText = score => score === null ? '—' : score === 10 ? '10' : score.toFixed(2).replace(/(\.\d)0$/, '$1');
const scoreMarkup = score => { const [whole,fraction]=scoreText(score).split('.'); return `<span class="score-whole">${whole}</span>${fraction?`<span class="score-fraction">.${fraction}</span>`:''}`; };
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const scoreColor=score=>window.pocketTheme.color(blueScoreColor(score));
const preview = new URLSearchParams(location.search).get('preview') === '1';
const suffix = preview ? '.preview' : '';
const preferencesKey = `homebase.preferences.v1${suffix}`;
const storage = { getItem: key => localStorage.getItem(key + suffix), setItem: (key, value) => localStorage.setItem(key + suffix, value) };
const loaded = readLocal(storage);
let lastSavedRaw = loaded.raw;
let storageError = loaded.error;
let blockedSave = !!loaded.error;
let pendingSnapshot = null;
let pendingEditTime=null;
let saveTimer;
let maxSaveTimer;
let toastTimer;
let undoAction = null;
let pendingImport = null;
let cloud=null,reminders=null,cloudLabel='';
const clientId=Array.from(crypto.getRandomValues(new Uint8Array(8)),value=>value.toString(16).padStart(2,'0')).join('');
let view = 'today';
let selectedDate = appDateKey();
const dayRollover = createDayRollover(selectedDate);
let calendarMonth = selectedDate;
let calendarFilter='all',bodyWeightUnit='lb';
let achievementFilter='all',achievementOrder='recent',unlockedOnly=false,achievementData=null;
const categoryLabels={all:'Overall',nutrition:'Nutrition',training:'Training',checklists:'To-do list',sentiments:'Sentiments'};
const weightText=weight=>weight?`${weight.value} ${weight.unit}`:'';
let reviewSessionDate = null;
let dragging = false;
let recapDate = null;
let targetScope=null,targetSignature='',targetDraft=new Map(),targetBaseline=[],targetDrag=null;
let taskComposerTrigger;
let taskComposeDate;
let taskEdit=null;
let weightHistoryDays=90;
let weightChartUnit='lb';
let weightPointPinned=false;
$('#body-weight-form').insertAdjacentHTML('afterbegin','<div class="weight-highlight"><div><span>Body weight</span><strong id="body-weight-current">—</strong></div></div>');
const calendarTools=document.createElement('div');calendarTools.className='calendar-tools';
$('#calendar-filters').before(calendarTools);calendarTools.append($('#calendar-filters'));
calendarTools.insertAdjacentHTML('beforeend','<button id="open-weight-history" type="button" class="calendar-weight-launch quiet-button" hidden>Weight graph ↗</button>');
// UI-10: selecting a calendar day on phone reveals its recap instead of changing it off screen.
$('.history-detail').insertAdjacentHTML('afterbegin','<button id="back-to-calendar" class="text-button" type="button">↑ Back to calendar</button>');
$('.history-detail').tabIndex=-1;
const phoneLayout=()=>matchMedia('(max-width:1000px)').matches;
$('#back-to-calendar').addEventListener('click',()=>{$('.calendar-card').scrollIntoView({block:'start',behavior:'instant'});$('#calendar-month').tabIndex=-1;$('#calendar-month').focus({preventScroll:true});});

$('#body-weight-form>label').innerHTML='Log weight <small>(optional)</small>';
$('#training-pace').after($('#body-weight-form'));
// UI-04: keep saved weight prominent without permanently expanding its editor.
const weightEditor=document.createElement('details');weightEditor.className='weight-entry-editor';
weightEditor.innerHTML='<summary id="weight-editor-label">Log weight</summary>';
$('#body-weight-form').append(weightEditor);
for(const field of [...$('#body-weight-form').children])if(field!==weightEditor&&!field.classList.contains('weight-highlight'))weightEditor.append(field);
let weightEditorDate=null;
// UI-05: recommendations precede logging; optional supporting detail stays available.
$('#gym-form').before($('#ideal-workout'));
const gapsDetails=document.createElement('details');gapsDetails.className='training-gaps';
gapsDetails.innerHTML='<summary>Weekly muscle gaps</summary>';$('#muscle-suggestions').before(gapsDetails);gapsDetails.append($('#muscle-suggestions'));
const notesDetails=document.createElement('details');notesDetails.className='training-notes-details';
notesDetails.innerHTML='<summary>Training notes (optional)</summary>';$('.training-notes').before(notesDetails);notesDetails.append($('.training-notes'));
let trainingNotesDate=null;

$('#checklists-view').insertAdjacentHTML('beforeend','<section class="panel later-plan" aria-labelledby="later-title"><div class="panel-heading"><div><p id="later-dates" class="eyebrow"></p><h3 id="later-title">Later This Week</h3></div><span id="later-count" class="count-pill"></span></div><ul id="later-tasks"></ul><div class="tomorrow-actions"><button id="add-later-task" class="quiet-button">+ Plan a task</button></div></section>');
const todayTaskHeading=document.createElement('div');
$('#tasks-title').before(todayTaskHeading);todayTaskHeading.innerHTML='<p id="tasks-date" class="eyebrow"></p>';todayTaskHeading.append($('#tasks-title'));
$('.task-date-shortcuts').insertAdjacentHTML('beforeend','<button type="button" class="quiet-button" data-task-when="2" aria-pressed="false">Later this week</button>');
$('.task-date-shortcuts').insertAdjacentHTML('afterend','<div id="task-week-options" class="task-week-options" role="group" aria-label="Choose a date later this week" hidden></div>');
const expandedTasks = new Set();
let displayName = 'Kieran';
let preferences={},motionPreference='system';
try {const saved=JSON.parse(localStorage.getItem(preferencesKey));if(saved&&typeof saved==='object'&&!Array.isArray(saved))preferences=saved;}catch{}
if(profileName(preferences.name))displayName=profileName(preferences.name);
const welcomeRequired=needsWelcome({preview,preferences,snapshot:loaded.snapshot,error:loaded.error});
if(welcomeRequired)displayName='';
let welcomeGoogleAttempt=!!preferences.welcomeGooglePending;
motionPreference=setMotionPreference(preferences.motion);
window.pocketTheme.apply(preferences.theme);
const editableToday=()=>appDateKey();
const archivedDay=(date=selectedDate)=>!isEditableDay(date,editableToday());
let store = createStore({ clientId, editableToday, today: selectedDate, seed: preview, snapshot: loaded.snapshot, onChange: queueSave });
const achievementNotified=new Set(Array.isArray(preferences.achievementNotified)?preferences.achievementNotified.filter(id=>typeof id==='string'):[]);
for(const card of buildAchievements(store,editableToday()).cards)if(card.count&&(card.first<editableToday()||store.loadDay(card.first).completedAt))achievementNotified.add(card.id);
const editsKey=`homebase.record-edits.v1${suffix}`;
let initialSyncRecords=new Map();try{initialSyncRecords=snapshotRecords(store.exportSnapshot());}catch{}
const recordEdits=createRecordEdits({records:initialSyncRecords,load:()=>JSON.parse(localStorage.getItem(editsKey)),save:value=>localStorage.setItem(editsKey,JSON.stringify(value))});
function captureRecordEdits(snapshot,at=Date.now()){try{recordEdits.capture(snapshotRecords(snapshot),at);}catch{/* Timestamp metadata must never prevent local saving. */}}
const dateFormat = (key, options) => new Intl.DateTimeFormat('en-US', { ...options, timeZone:'UTC' }).format(new Date(`${key}T12:00:00Z`));
const shortDate = key => dateFormat(key, { month:'short', day:'numeric' });
const longDate = key => dateFormat(key, { weekday:'long', month:'long', day:'numeric', year:'numeric' });
const viewLabels = { today:'Overview', nutrition:'Nutrition', training:'Daily training', checklists:'To-do list', sentiments:'Sentiments', history:'Calendar', achievements:'Achievements' };
const panelIds = { today:'dashboard-view', nutrition:'nutrition-view', training:'training-view', checklists:'checklists-view', sentiments:'sentiments-view', history:'history-view', achievements:'achievements-view' };

function queueSave(snapshot) {
  const wasPending = !!pendingSnapshot;
  pendingSnapshot = snapshot;
  pendingEditTime=Date.now();
  clearTimeout(saveTimer);
  if (!wasPending) renderSaveStatus();
  const editingText = document.activeElement?.matches('textarea,[contenteditable="true"]');
  saveTimer = setTimeout(flushSave, editingText ? 2500 : 350);
  if (!maxSaveTimer) maxSaveTimer = setTimeout(flushSave, 10000);
}
function renderSaveStatus() {
  $('#save-status').classList.toggle('has-error', !!storageError);
  $('#save-message').textContent = storageError ? 'Changes not saved · see backups' : pendingSnapshot ? 'Saving on this device…' : preview ? 'Preview · saved separately' : cloudLabel||'Saved on this device';
  $('#storage-warning').hidden = !storageError;
  $('#storage-warning').textContent = storageError ? `Local saving needs attention. ${storageError} Your current changes remain in this tab; open Settings to download a backup.` : '';
}
function flushSave() {
  clearTimeout(saveTimer);
  clearTimeout(maxSaveTimer);
  saveTimer = maxSaveTimer = null;
  if (!pendingSnapshot || blockedSave) { renderSaveStatus(); return; }
  try {
    if (storage.getItem(STORAGE_KEY) !== lastSavedRaw) {
      blockedSave = true; throw new Error('Another tab changed the saved data. Export this tab’s changes before reloading.');
    }
    lastSavedRaw = writeLocal(storage, pendingSnapshot);
    captureRecordEdits(pendingSnapshot,pendingEditTime);
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
  const arc=`d="${meterPath(20,24)}" pathLength="100" stroke-dasharray="${score === null ? 0 : score * 10} 100"`;
  return `<span class="score-circle ${score === null ? 'no-score' : ''} ${reward?scoreReward(score):''}" style="--score-color:${scoreColor(score)};--score-glow:${reward?scoreGlow(score)/2:0}px" aria-hidden="true"><svg viewBox="0 0 48 48">${reward&&score===10?'<circle class="reward-halo" cx="24" cy="24" r="23"/>':''}<path class="score-circle-track" d="${meterPath(20,24)}"/><path class="score-circle-fill score-circle-outline" ${arc}/><path class="score-circle-fill" ${arc}/></svg><span>${scoreText(score)}</span></span>`;
}
function drawScoreMeter(meter,score,{immediate=false}={}) {
  meter.classList.add('standard-score-meter');
  const svg=meter.querySelector('svg'),size=Number(svg.getAttribute('viewBox').split(/\s+/)[2]),unit=size/240,center=size/2,radius=86*unit;
  let halo=svg.querySelector('.score-halo');
  if(!halo){halo=document.createElementNS('http://www.w3.org/2000/svg','circle');halo.setAttribute('class','score-halo');svg.insertBefore(halo,svg.querySelector('.meter-track'));}
  for(const [name,value] of Object.entries({cx:center,cy:center,r:101*unit}))halo.setAttribute(name,value);
  for(const name of ['meter-track','meter-fill']){const path=svg.querySelector('.'+name);path.setAttribute('d',meterPath(radius,center));path.style.strokeWidth=10*unit;}
  meter.style.setProperty('--score-color',scoreColor(score));meter.style.setProperty('--score-glow',`${scoreGlow(score)}px`);
  meter.classList.toggle('score-high',!!scoreReward(score));meter.classList.toggle('score-perfect',score===10);
  setMeter(svg.querySelector('.meter-fill'),score===null?0:score*10,{immediate});
  const knob=svg.querySelector('.meter-knob');
  if(knob){const point=meterPoint(1+(score??0)*.9,radius,center);knob.setAttribute('cx',point.x);knob.setAttribute('cy',point.y);knob.setAttribute('r',4*unit);knob.style.removeProperty('opacity');}
  meter.querySelectorAll('.sentiment-endpoint').forEach(endpoint=>endpoint.classList.add('meter-endpoint'));
  if(!meter.querySelector('.meter-endpoint'))meter.insertAdjacentHTML('beforeend','<span class="meter-endpoint start" aria-hidden="true">0</span><span class="meter-endpoint end" aria-hidden="true">10</span>');
}
function renderHeaderShortcuts() {
  const settings=$('#settings-dialog').hasAttribute('open'),info=$('#score-dialog').hasAttribute('open'),modal=settings||info;
  for(const [id,active] of [['open-home',view==='today'&&!modal],['mobile-calendar',view==='history'&&!modal],['open-achievements',view==='achievements'&&!modal],['open-settings',settings],['open-score-info',info]])
    $('#'+id).setAttribute('aria-pressed',String(active));
}
function renderHeader() {
  const archived=archivedDay();
  if(archived&&view!=='achievements')view='history';
  document.body.classList.toggle('summary-only',archived);
  document.body.classList.toggle('is-overview', view === 'today');
  renderHeaderShortcuts();
  const now = new Date();
  const greeting = timeGreeting(now);
  const isToday = selectedDate === appDateKey(now);
  const past = selectedDate < appDateKey(now);
  document.body.classList.toggle('viewing-other-day',!isToday);
  $('#selected-day-notice').hidden=isToday||view==='achievements';
  $('#selected-day-label').textContent=`${past?'Past':'Future'} day · ${longDate(selectedDate)}`;
  $('#selected-day-help').textContent=archived?'Summary only · days more than a week ago cannot be edited.':`Entries on this screen belong to ${shortDate(selectedDate)}.`;
  $('#page-title').innerHTML = view === 'today' ? `<strong class="time-greeting">${greeting}</strong>${displayName?`, ${escapeHtml(displayName)}`:''}<span class="greeting-dot">.</span>` : escapeHtml(viewLabels[view]);
  $('#greeting-date').textContent = longDate(selectedDate);
  $('#date-short').textContent = dateFormat(selectedDate, { month:'long', day:'numeric' });
  $('#date-short').setAttribute('aria-label', `Choose date. Selected ${longDate(selectedDate)}`);
  const completed = !!store.loadDay(selectedDate).completedAt;
  $('#day-state').textContent = view==='achievements'?'All-time record':archived?'Summary only':completed ? '✓ Day complete' : isToday ? 'Day in progress' : 'Open day';
  $('#day-state').classList.toggle('complete', completed&&view!=='achievements');
  $('#calendar-day-number').textContent = Number(selectedDate.slice(-2));
  $('#overall-title').textContent = isToday ? "Today's score" : 'Daily score';
  $('#overview-tasks-title').textContent = 'TO-DO LIST';
  // Keep one writer for this heading; dates belong in its separate eyebrow.
  $('#tasks-title').textContent = isToday ? 'TODAY' : 'TO-DO LIST';
  $('#tasks-date').textContent = longDate(selectedDate);
  document.title = `Pocket Planet · ${viewLabels[view]}`;
  for (const [key, panel] of Object.entries(panelIds)) $('#' + panel).hidden = view !== key;
  $$('[data-tab]').forEach(button => {
    button.disabled=archived;
    const active = button.dataset.tab === view;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active || ['history','achievements'].includes(view)&&button.dataset.tab==='today' ? 0 : -1;
  });
}
function renderTasks() {
  const day = store.loadDay(selectedDate), {done,total}=taskProgress(day.tasks);
  const taskHtml = editable => day.tasks.length ? orderedTasks(day.tasks).map(task => {
    const children=task.children||[], expanded=expandedTasks.has(task.id), listId=`subtasks-${editable?'edit':'home'}-${task.id}`;
    const progress=taskProgress([task]);
    const editButton=child=>`<button class="edit-task" data-edit-task="${task.id}" ${child?`data-edit-child="${child.id}"`:''} aria-label="Edit ${escapeHtml(child?.name??task.name)}" title="Edit task">${icon('edit')}</button>`;
    return `<li class="task-group"><div class="task-row"><label class="${children.length?'parent-task':''}" ${children.length?`data-expand-task="${task.id}"`:''}><input type="checkbox" data-task-id="${task.id}" ${task.done?'checked':''} ${children.length?'disabled':''}><span>${escapeHtml(task.name)}${task.templateId?'<small class="recurring-label">Repeats</small>':''}</span></label>${children.length?`<button class="expand-task" data-expand-task="${task.id}" aria-expanded="${expanded}" aria-controls="${listId}" aria-label="${expanded?'Collapse':'Expand'} ${escapeHtml(task.name)} subtasks"><span>${progress.done}/${progress.total}</span> ${expanded?'▾':'▸'}</button>`:''}${editButton()}${editable?`<button class="remove-task" data-remove-task="${task.id}" aria-label="Remove task${task.templateId?' for this day':''}: ${escapeHtml(task.name)}">×</button>`:''}</div>${children.length?`<ul id="${listId}" class="child-tasks" ${expanded?'':'hidden'}>${children.map(child=>`<li><label><input type="checkbox" data-task-id="${child.id}" ${child.done?'checked':''}><span>${escapeHtml(child.name)}</span></label>${editButton(child)}</li>`).join('')}</ul>`:''}</li>`;
  }).join('') : '<li class="empty-tasks"><strong>No tasks yet.</strong><span>Add a task or a recurring routine.</span></li>';
  const scroll = $('.task-scroll').scrollTop;
  $('#overview-task-list').innerHTML = taskHtml(false);
  $('.task-scroll').scrollTop = scroll;
  $('#task-list').innerHTML = taskHtml(true);
  $('#overview-task-count').textContent = `${done}/${total}`;
  $('#task-count').textContent = `${done} / ${total}`;
  $('#task-summary').textContent = total ? `${done} of ${total} actions done · ${total-done} remaining` : 'No tasks added for this date.';
  const fraction = total ? done / total : 0;
  $('#task-progress-fill').style.width = `${fraction * 100}%`;
  $('#task-progress-fill').style.backgroundColor = scoreColor(fraction * 10);
  const today=appDateKey(),templates=activeTemplates(store.loadTemplates(),today);
  $('#recurring-tasks').innerHTML=templates.length?templates.map(template=>`<li><span><strong>${escapeHtml(template.name)}</strong><small>${scheduleLabel(template)} · from ${shortDate(template.startDate)}</small></span><button class="quiet-button" data-stop-template="${template.id}">Stop recurring task</button></li>`).join(''):'<li class="hint">No active recurring tasks.</li>';
  $('#routine-count').textContent=templates.length;
  const tomorrow=addDays(today,1),planned=orderedTasks(store.loadDay(tomorrow).tasks);
  $('#tomorrow-date').textContent=longDate(tomorrow);
  $('#tomorrow-count').textContent=`${planned.length} task${planned.length===1?'':'s'}`;
  const plannedTask=(task,date)=>`<li class="planned-task"><span>${escapeHtml(task.name)}${task.templateId||task.children.length?`<small>${[task.templateId?'Repeats':'',task.children.length?`${task.children.length} subtask${task.children.length===1?'':'s'}`:''].filter(Boolean).join(' · ')}</small>`:''}</span><button class="edit-task" data-edit-planned="${task.id}" data-planned-date="${date}" aria-label="Edit ${escapeHtml(task.name)} for ${shortDate(date)}">${icon('edit')}</button></li>`;
  $('#tomorrow-tasks').innerHTML=planned.length?planned.map(task=>plannedTask(task,tomorrow)).join(''):'<li class="tomorrow-empty">A clear page for tomorrow.</li>';
  const laterDates=Array.from({length:6},(_,index)=>addDays(today,index+2));let laterCount=0;
  $('#later-dates').textContent=`${shortDate(laterDates[0])} – ${shortDate(laterDates.at(-1))}`;
  $('#later-tasks').innerHTML=laterDates.map(date=>{const tasks=store.loadDay(date).tasks.filter(task=>!task.templateId);laterCount+=tasks.length;return `<li class="planning-date"><button class="text-button" data-view-task-date="${date}">${dateFormat(date,{weekday:'short',month:'short',day:'numeric'})} →</button><ul>${tasks.length?tasks.map(task=>plannedTask(task,date)).join(''):'<li class="planning-empty">No tasks planned</li>'}</ul></li>`;}).join('');
  $('#later-count').textContent=String(laterCount);
  $('#plan-tomorrow').setAttribute('aria-label',`Plan tomorrow · ${planned.length} task${planned.length===1?'':'s'} scheduled`);
}
function renderScore() {
  const summary = summaryFor();
  const day = store.loadDay(selectedDate), progress = store.dayProgress(selectedDate);
  const range=selectedDate===editableToday()&&!day.completedAt?taskScoreRange(summary):{score:summary.score,low:summary.score,projected:false},displayScore=range.score;
  const meter = $('#overall-meter');
  const reward=scoreReward(displayScore);
  drawScoreMeter(meter,displayScore,{immediate:dragging||document.activeElement===$('#rating-value')});
  meter.querySelector('.meter-number').innerHTML = scoreMarkup(displayScore);
  meter.style.setProperty('--score-soft', displayScore === null ? '#f2f4ef' : `${scoreColor(displayScore)}0a`);
  $('#day-gradient-start').setAttribute('stop-color',scoreColor(displayScore));
  $('#day-gradient-start').setAttribute('stop-opacity', '1');
  $('#day-gradient-end').setAttribute('stop-color',scoreColor(displayScore));
  meter.setAttribute('aria-label', displayScore === null ? 'No daily score yet. Log a category to get started.' : `${range.projected?'Projected ':summary.provisional ? 'Provisional ' : ''}Daily score ${scoreText(displayScore)} out of 10.${range.projected?` Assuming all tasks completed; as low as ${scoreText(range.low)} if remaining tasks stay unchecked.`:''} ${summary.logged} of ${summary.sections.length} categories logged.`);
  $('#score-range').hidden=!range.projected;
  $('#score-range').innerHTML=range.projected?`As high as <strong>${scoreText(range.score)}</strong> · As low as <strong>${scoreText(range.low)}</strong><span> Tasks assumed done vs. left unchecked. Unlogged nutrition and training are not assumed.</span>`:'';
  const rewardLabel=range.projected?'With all tasks done':reward?(summary.provisional?'High so far':displayScore===10?'Perfect score':'High score'):'';
  $('#score-status').textContent = [rewardLabel,day.completedAt ? 'Day complete' : summary.provisional ? `Provisional · ${summary.logged}/${summary.sections.length} logged` : 'All categories logged'].filter(Boolean).join(' · ');
  $('#overall-description').textContent = day.completedAt ? 'Day completed and saved.' : `${progress.reviewedCount} of ${progress.sections.length} section reviews confirmed.`;
  const button = $('#complete-day');
  const missing = progress.sections.find(section => !section.ready);
  button.disabled = false;
  button.classList.toggle('needs-input', !day.completedAt && !!missing);
  button.classList.toggle('is-complete', !!day.completedAt);
  button.innerHTML = day.completedAt ? `View day summary ${icon('arrow')}` : progress.canComplete ? `Review full day ${icon('arrow')}` : `${progress.reviewedCount || reviewSessionDate === selectedDate ? 'Continue' : 'Start'} day review ${icon('arrow')}`;
  $('#overview-sections').innerHTML = summary.sections.map(section => {
    const state = progress.sections.find(item => item.id === section.id) || {ready:true,reviewed:false};
    const missing = section.score === null&&!section.excluded || !state.ready;
    const status=section.optional && !progress.sections.some(item=>item.id===section.id)?'Included in score':missing?'Not logged yet':state.reviewed?'Reviewed':'Ready to review';
    return `<button class="breakdown-item ${section.id}" data-open-section="${section.id}" aria-label="Open ${section.label}. ${section.detail}. ${status}">${circle(section.score)}<span class="breakdown-copy"><strong>${section.label}</strong><small>${escapeHtml(section.detail)}</small><span class="breakdown-state ${missing?'is-missing':''} ${state.reviewed ? 'reviewed' : ''}">${icon(status==='Included in score'||state.reviewed?'check':missing?'warning':'arrow')}${status}</span></span><span class="breakdown-chevron" aria-hidden="true">›</span></button>`;
  }).join('');
  $('#overview-note').textContent = day.completedAt ? 'Day completed. Editing an entry reopens its review.' : progress.canComplete ? 'All section reviews confirmed. Check your full-day summary before completing the day.' : 'Check off individual tasks, confirm each section’s review, then review the full day.';
}
function renderRating() {
  const score = store.loadDay(selectedDate).nutrition, meter = $('#nutrition-meter');
  drawScoreMeter(meter,score,{immediate:dragging||document.activeElement===$('#rating-value')});
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
  drawScoreMeter(meter,rating,{immediate:sentimentPointer!==-1||document.activeElement===input});
  meter.querySelector('.meter-number').innerHTML=scoreMarkup(rating);
  meter.querySelector('.meter-out-of').textContent=rating===null?'not rated yet':'out of 10';
  meter.setAttribute('aria-valuenow',rating??0);meter.setAttribute('aria-valuetext',rating===null?'Not rated. Optional rating from 0 to 10.':`${scoreText(rating)} out of 10`);
  $('#sentiments-minus').disabled=rating===0;$('#sentiments-plus').disabled=rating===10;
  $('#clear-sentiments-rating').disabled=rating===null;
  $('#sentiments-score-hint').textContent=rating===null?'Not rated · excluded from the daily score.':`${scoreText(rating)} / 10 · included in the daily score.`;
}
function updateSentiments(changes) {
  store.updateSentiments(selectedDate,changes);
  renderSentiments();renderScore();renderReview();renderHeader();renderNotes();
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
bindMeterDrag(sentimentMeter,{read:()=>store.loadDay(selectedDate).sentiments.rating,change:rating=>updateSentiments({rating}),onStart:()=>sentimentPointer=1,onEnd:()=>sentimentPointer=-1});
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
  for(const group of values) {
    paintTarget(group.id);
    bindMeterDrag($('[data-target-meter="'+group.id+'"]'),{read:()=>targetDraft.get(group.id),change:value=>changeTarget(group.id,value),max:20,step:1,onStart:()=>targetDrag=group.id,onEnd:()=>targetDrag=null});
  }
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
$('#cancel-targets').addEventListener('click',()=>{renderTargetEditor(store.loadWeek(selectedDate),true);cloud?.resume();announce('Target edits discarded. Saved targets are unchanged.');});
function renderGym() {
  const day = store.loadDay(selectedDate), entries = store.loadTrainingDay(selectedDate), week = store.loadWeek(selectedDate),pace=store.trainingProgress(selectedDate);
  $('#training-date').textContent = `Entries for ${longDate(selectedDate)}.`;
  if(!weightEditor.open||weightEditorDate!==selectedDate) {
    $('#body-weight').value=day.bodyWeight?.value??'';bodyWeightUnit=day.bodyWeight?.unit??'lb';
    $$('[name="weight-unit"]').forEach(input=>input.checked=input.value===bodyWeightUnit);
    $('#body-weight').max=bodyWeightUnit==='kg'?700:1500;
  }
  updateWeightDraftHint();
  $('#body-weight-current').innerHTML=day.bodyWeight?`${day.bodyWeight.value.toFixed(1)} <small>${day.bodyWeight.unit}</small>`:'<span class="weight-missing">Not logged</span>';
  $('#remove-body-weight').hidden=!day.bodyWeight;
  $('#weight-editor-label').textContent=day.bodyWeight?'Edit weight':'Log weight';
  if(weightEditorDate!==selectedDate){weightEditor.open=false;weightEditorDate=selectedDate;}
  if(trainingNotesDate!==selectedDate){notesDetails.open=!!day.notes.training;trainingNotesDate=selectedDate;}

  $('#creatine-taken').checked=day.creatine===true;
  $('#creatine-taken').disabled=archivedDay();
  $('#creatine-status').textContent=day.creatine===true?'✓ Taken':'Not checked';
  const noLift=['rest','unplanned-rest','rest-unclassified'].includes(day.trainingMode);
  $$('[name="training-mode"]').forEach(input => { input.checked=input.value==='no'?noLift:day.trainingMode==='training';input.disabled=input.value==='no'&&entries.length>0; });
  $('#gym-form').hidden=day.trainingMode!=='training';
  $('#training-mode-hint').hidden=!entries.length;
  $('#ideal-workout').hidden=noLift;
  const restReason=pace.goalsComplete?'All weekly goals met · rest covered':pace.restCreditUsed?'Rest day covered':'Weekly rest allowance used up';
  $('#training-pace').innerHTML=`${circle(pace.score,true)}<div><strong>${pace.logged&&!pace.target?pace.tracksCreatine?'Creatine only':'No targets · not scored':pace.logged?`Training · ${scoreText(pace.score)} / 10`:'Training · not logged'}</strong><span>${pace.rest?(pace.target?restReason:'Rest recorded · gym not scored'):`${pace.useful} goal set${pace.useful===1?"":"s"}${pace.nonUseful?` · ${pace.nonUseful} non-goal set${pace.nonUseful===1?"":"s"}`:""}`}</span><small>${pace.target?`Daily target · ${pace.dailyTarget} sets`:'Set weekly targets to unlock the 9 gym points.'}</small></div>`;
  $('#muscle-suggestions').innerHTML=`<h4 id="muscle-suggestions-title">Most needed for your goal</h4>${pace.suggestions.length?`<div>${pace.suggestions.map(group=>`<span><strong>${escapeHtml(group.name)}</strong><small>${group.remaining} sets remaining</small></span>`).join('')}</div>`:pace.target?'<p>All weekly targets met.</p>':'<p>No muscle targets set. Your total sets still stay in your log.</p>'}`;
  const workout=store.idealWorkout(selectedDate);
  $('#ideal-workout').innerHTML=`<div class="ideal-workout-heading"><h4>Ideal workout today</h4>${workout.sets?`<span>${workout.sets} goal sets planned</span>`:''}</div>${workout.groups.length?`<ul>${workout.groups.map(group=>`<li><span>${escapeHtml(group.name)}</span><strong>${group.sets}<small> set${group.sets===1?'':'s'}</small></strong></li>`).join('')}</ul>`:`<p>${!pace.target?'Set weekly targets to build your plan.':workout.goalsMet?'All weekly goals are complete.':workout.targetMet?'Today’s set target is met.':'No goal sets remaining.'}</p>`}`;
  $('#daily-training-entries').hidden=noLift;
  $('#daily-training-entries').innerHTML = entries.length ? `<ul>${entries.map(entry => {const credit=pace.classifications.find(value=>value.id===entry.id);return `<li><span><strong>${muscleName(entry.groupId)}</strong><small>${credit.useful} goal set${credit.useful===1?"":"s"}${credit.nonUseful?` · ${credit.nonUseful} non-goal set${credit.nonUseful===1?"":"s"}`:""}</small></span><button class="text-button" data-remove-entry="${entry.id}" aria-label="Remove ${entry.sets} ${entry.groupId} sets from ${shortDate(entry.date)}">Remove</button></li>`;}).join('')}</ul>` : `<div class="training-empty"><strong>${noLift?'Rest day':day.trainingMode==='training'?'Gym attendance logged':'No sets logged.'}</strong><p>${noLift?'No sets recorded for this date.':'Your sets will appear here.'}</p></div>`;
  const total = week.entries.reduce((sum, entry) => sum + entry.sets, 0), target = week.groups.reduce((sum, group) => sum + group.target, 0);
  const weekCredit=week.groups.reduce((sum,group)=>sum+Math.min(group.completed,group.target),0);
  $('#gym-summary').textContent = `${weekCredit} / ${target}`;
  $('#gym-total-sets').textContent=total;
  $('#weekly-rest-credits').innerHTML=`<div><span class="eyebrow">Weekly rest credits</span><strong>${pace.restCredits}<small> / 2 left</small></strong></div><p>Remaining through ${shortDate(selectedDate)}<br>Resets every Monday</p>`;
  $('#gym-week-label').textContent = `${shortDate(week.start)} – ${shortDate(week.end)} · Monday–Sunday`;
  const volumeGroups=[...week.groups];
  for(const entry of week.entries.filter(entry=>entry.groupId!=='legs')) if(!volumeGroups.some(group=>group.id===entry.groupId)) volumeGroups.push({id:entry.groupId,name:muscleName(entry.groupId),target:null,completed:week.entries.filter(item=>item.groupId===entry.groupId).reduce((sum,item)=>sum+item.sets,0)});
  $('#gym-groups').innerHTML = volumeGroups.length ? volumeGroups.map(group => `<div><div class="gym-group-heading"><span>${escapeHtml(group.name)}</span><span>${group.completed} <small>${group.target ? `/ ${group.target} sets` : 'sets · no target'}</small></span></div>${group.target?`<div class="gym-progress" role="img" aria-label="${escapeHtml(group.name)}: ${group.completed} of ${group.target} sets"><span style="width:${Math.min(100, group.completed / group.target * 100)}%;background:${scoreColor(group.completed / group.target * 10)}"></span></div>${group.completed > group.target ? `<p class="over-target">${group.completed - group.target} over target</p>` : ''}`:''}</div>`).join('') : '<p class="hint">No targets for this week yet. Add them below; your sets are still saved.</p>';
  renderTargetEditor(week);
  $('#gym-log').innerHTML = week.entries.length ? `<ul>${week.entries.map(entry => `<li><span>${shortDate(entry.date)} · ${muscleName(entry.groupId)} · ${entry.sets} sets</span><button class="text-button" data-remove-entry="${entry.id}" aria-label="Remove ${entry.sets} ${entry.groupId} sets from ${shortDate(entry.date)}">Remove</button></li>`).join('')}</ul>` : '<p class="hint">No entries this week.</p>';
  $$('[data-remove-entry]').forEach(button=>{const entry=week.entries.find(value=>value.id===button.dataset.removeEntry);button.disabled=!!entry&&archivedDay(entry.date);});
}
function renderReview() {
  const progress = store.dayProgress(selectedDate), reviewing = reviewSessionDate === selectedDate && !progress.completedAt;
  $('#review-banner').hidden = !reviewing || ['history','today','achievements'].includes(view);
  $('#review-title').textContent = progress.canComplete ? 'All section reviews confirmed' : 'Review each section';
  $('#review-description').textContent = `${shortDate(selectedDate)} · ${progress.reviewedCount} of ${progress.sections.length} confirmed.`;
  $('#review-steps').innerHTML = progress.sections.map((section, index) => `<button data-open-section="${section.id}" class="review-step ${section.reviewed ? 'reviewed' : ''} ${view === section.id ? 'current' : ''}"><span>${section.reviewed ? '✓' : index + 1}</span>${section.label}</button>`).join('');
  $$('[data-start-review]').forEach(button => { button.hidden=reviewing;button.textContent = progress.completedAt ? 'View day summary →' : progress.canComplete ? 'Review full day →' : `${progress.reviewedCount ? 'Continue' : 'Start'} day review →`; });
  const current=progress.sections.find(section=>section.id===view);
  const invalidRating=current?.id==='nutrition'&&!$('#rating-value').validity.valid||current?.id==='sentiments'&&!$('#sentiments-rating').validity.valid;
  const primary=$('#review-primary');
  primary.textContent=current&&!current.reviewed?`Confirm ${current.id==='checklists'?'to-do list':current.id==='training'?'training':current.id} review`:'Continue day review →';
  primary.disabled=!!current&&!current.reviewed&&(!current.ready||invalidRating);
  $('#review-primary-hint').textContent=invalidRating?'Enter a valid rating first.':current&&!current.ready?current.id==='nutrition'?'Enter a nutrition rating first.':'Log lifting or rest first.':'';
  const now=new Date(),today=appDateKey(now);
  const showLateWarnings=selectedDate<today || selectedDate===today&&lateCheckInWindow(now);
  const scoreSections=summaryFor().sections;
  for (const section of progress.sections) {
    const logged=scoreSections.find(item=>item.id===section.id),warn=section.id!=='sentiments'&&showLateWarnings&&!(logged?.logged??logged?.score!==null);
    const marker=$(`#tab-${section.id} .tab-check`);
    marker.innerHTML=section.reviewed?icon('check'):warn?icon('warning'):'';
    marker.classList.toggle('late-warning',!section.reviewed&&warn);
    $(`#tab-${section.id}`).setAttribute('aria-label', `${viewLabels[section.id]}${section.reviewed ? ', reviewed' : warn ? ', not logged' : ''}`);
  }
  if(!progress.sections.some(section=>section.id==='sentiments')) {
    $('#tab-sentiments .tab-check').textContent='';
    $('#tab-sentiments .tab-check').classList.remove('late-warning');
    $('#tab-sentiments').setAttribute('aria-label','Sentiments');
  }
}
function renderNotes() {
  const notes = store.loadDay(selectedDate).notes;
  $$('[data-notes]').forEach(input => { const value=input.dataset.notes.startsWith('sentiments')?store.loadDay(selectedDate).sentiments.notes:notes[input.dataset.notes];if(input.value!==value)input.value=value; });
  refreshNoteCarets();
}
$$('[data-notes]').filter(input=>['nutrition','training'].includes(input.dataset.notes)).forEach(input => input.addEventListener('input', () => {
  store.updateNotes(selectedDate, input.dataset.notes, input.value);
  renderReview(); renderHeader(); renderScore();
}));
function renderHistory() {
  $('#open-weight-history').hidden=calendarFilter!=='training';
  $('#calendar-month').textContent = dateFormat(calendarMonth, { month:'long', year:'numeric' });
  const today = appDateKey();
  const dates = monthGrid(calendarMonth);
  const monthDates = dates.filter(date => date.slice(0,7) === calendarMonth.slice(0,7));
  const filteredSummary=date=>categorySummary(summaryFor(date),calendarFilter),filterLabel=categoryLabels[calendarFilter];
  $$('[data-calendar-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.calendarFilter===calendarFilter)));
  const monthly = averageDays(monthDates, filteredSummary);
  $('#monthly-score').innerHTML = circle(monthly.score,true)+`<span><strong>Month average</strong><small>${filterLabel} · ${monthly.count}/${monthly.total} days${monthly.provisional?' · partial':''}</small></span>`;
  $('#monthly-score').setAttribute('aria-label',`${filterLabel} month average ${scoreText(monthly.score)} out of 10. ${monthly.count} of ${monthly.total} days logged${monthly.provisional?', partial':''}.`);
  const streak=loggingStreak(today,summaryFor);
  $('#calendar-streak').innerHTML=`<strong>${streak.count}<small> day${streak.count===1?'':'s'}</small></strong><span>Logging streak<small>All 3 categories logged${streak.count&&!streak.includesToday?' · through yesterday':''}</small></span>`;
  $('#calendar').innerHTML = dates.map((date, index) => {
    const summary = filteredSummary(date), day = store.loadDay(date), reward=scoreReward(summary.score);
    let cell = `<button class="calendar-day ${reward} ${date.slice(0,7) === calendarMonth.slice(0,7) ? '' : 'outside-month'} ${date === selectedDate ? 'selected' : ''} ${date === today ? 'is-today' : ''}" data-calendar-date="${date}" aria-label="${longDate(date)}, ${summary.score === null ? 'no score' : `${summary.provisional ? 'provisional ' : ''}daily score ${scoreText(summary.score)} out of 10${reward?summary.score===10?', perfect score':', high score':''}`}${day.completedAt ? ', day complete' : ''}" aria-pressed="${date === selectedDate}" ${date === today ? 'aria-current="date"' : ''}><span class="calendar-date">${Number(date.slice(-2))}</span>${circle(summary.score,true)}${day.completedAt ? '<span class="calendar-complete" aria-hidden="true">✓</span>' : ''}</button>`
    cell=cell.replace('daily score ',`${filterLabel.toLowerCase()} score `);
    const fullyLogged=summaryFor(date).requiredLogged===3;
    cell=cell.replace('class="calendar-day ',`class="calendar-day ${fullyLogged?'is-logged ':''}${day.completedAt?'is-reviewed ':''}`);
    if(fullyLogged)cell=cell.replace('aria-label="','aria-label="All required categories logged, ');
    if(fullyLogged&&!day.completedAt)cell=cell.replace('</button>','<span class="calendar-logged" aria-hidden="true">●</span></button>');
    if(calendarFilter==='training'&&day.bodyWeight)cell=cell.replace('</button>',`<small class="calendar-weight">${weightText(day.bodyWeight)}</small></button>`).replace('aria-label="',`aria-label="${weightText(day.bodyWeight)}, `);
    if (index % 7 === 6) {
      const weekDates = dates.slice(index - 6, index + 1);
      const weekly = averageDays(weekDates, filteredSummary);
      cell += '<div class="calendar-week-score" role="img" aria-label="Week of ' + shortDate(weekDates[0]) + ', Monday to Sunday average ' + scoreText(weekly.score) + ' out of 10, ' + weekly.count + ' of 7 days logged' + (weekly.provisional ? ', partial' : '') + '">' + circle(weekly.score,true) + '<small>' + weekly.count + '/7' + (weekly.provisional ? ' · partial' : '') + '</small></div>';
    }
    return cell;
  }).join('');
  renderRecap();
}
function recapMarkup({final=false}={}) {
  const archived=archivedDay(),openSection=id=>archived?'disabled':`data-open-section="${id}"`;
  const day=store.loadDay(selectedDate),recap=dailyRecap(day,store.loadTrainingDay(selectedDate),store.loadWeek(selectedDate));
  const status=recap.completed?'✓ '+recap.state:recap.state;
  if(!final&&view==='history'&&calendarFilter!=='all')return filteredRecapMarkup(day,recap);
  const training=recap.training.rest?`Rest<small> ${scoreText(recap.training.score)} / 10</small>`:recap.training.score!==null?`${scoreText(recap.training.score)}<small> / 10 · ${recap.training.sets} sets</small>`:'—';
  const tasks=recap.checklistLogged?`${recap.done}<small> / ${recap.total}</small>`:recap.total?`—<small> / ${recap.total}</small>`:'—';
  const taskLine=(task,child=false)=>`<li class="${task.done?'is-done':''} ${child?'recap-child':''}"><span class="recap-check" aria-hidden="true">${task.done?'✓':'·'}</span><span><span class="sr-only">${task.done?'Completed: ':'Unfinished: '}</span>${escapeHtml(task.name)}</span></li>`;
  return `
    <div class="recap-score" role="group" aria-label="${recap.score===null?'No daily score yet':`Daily score ${scoreText(recap.score)} out of 10`}">
      ${circle(recap.score,true)}<div><span class="state-pill ${recap.completed?'complete':''}">${status}</span><p>${recap.logged} of ${recap.sections.length} logged <span>·</span> ${recap.reviewed} reviewed</p>${recap.provisional&&recap.score!==null?'<small>Provisional score</small>':''}</div>
    </div>
    <div class="recap-metrics">
      <button ${openSection('nutrition')} aria-label="Nutrition${archived?' summary':' for this day'}"><span>Nutrition</span><strong>${scoreText(day.nutrition)}<small>${day.nutrition===null?'':' / 10'}</small></strong></button>
      <button ${openSection('training')} aria-label="Training${archived?' summary':' for this day'}"><span>Training</span><strong>${training}</strong></button>
      <button ${openSection('checklists')} aria-label="To-do list${archived?' summary':' for this day'}"><span>To-do list</span><strong>${tasks}</strong></button>
    </div>
    ${!recap.hasActivity?`<div class="recap-empty"><strong>Nothing logged for this day.</strong><p>${archived?'This day is saved as a read-only summary.':'Open the day to add an entry.'}${recap.tasks.length?' Scheduled tasks appear below.':''}</p></div>`:''}
    ${recap.tasks.length?`<details class="recap-section" open><summary>To-do list <span>${recap.checklistLogged?`${recap.done} / ${recap.total} done`:'Not checked in'}</span></summary><ul class="recap-tasks">${recap.tasks.map(task=>taskLine(task)+task.children.map(child=>taskLine(child,true)).join('')).join('')}</ul></details>`:recap.checklistLogged?'<p class="recap-no-tasks">No tasks due · reviewed</p>':''}
    ${recap.training.creatine!==undefined?`<p class="recap-creatine"><span>Daily creatine</span><strong>${recap.training.creatine?'✓ Taken':'Not taken'}</strong></p>`:''}
    ${recap.bodyWeight?`<p class="recap-body-weight"><span>Body weight</span><strong>${weightText(recap.bodyWeight)}</strong></p>`:''}
    ${recap.training.groups.length?`<section class="recap-section"><h4>Training <span>${recap.training.sets} sets</span></h4><ul class="recap-training">${recap.training.groups.map(group=>`<li><span>${escapeHtml(muscleName(group.id))}</span><strong>${group.sets}</strong></li>`).join('')}</ul></section>`:''}
    ${recap.notes.filter(note=>!final||note.section!=='nutrition').map(note=>`<section class="recap-section recap-note"><h4>${note.section==='nutrition'?'Nutrition':'Training'} notes</h4><p>${escapeHtml(note.text)}</p></section>`).join('')}
    ${!final&&(day.sentiments.notes.trim()||day.sentiments.rating!==null)?`<section class="recap-section recap-note sentiment-recap"><h4>${archived?'Sentiments':'<button class="text-button" data-open-section="sentiments">Sentiments</button>'}<span>${day.sentiments.rating===null?'Notes only · not scored':`${scoreText(day.sentiments.rating)} / 10 · included in score`}</span></h4>${day.sentiments.notes.trim()?`<p>${escapeHtml(day.sentiments.notes)}</p>`:''}</section>`:''}`;
}
function filteredRecapMarkup(day,recap) {
  const id=calendarFilter,label=categoryLabels[id],section=recap.sections.find(section=>section.id===id),value=section?.score??null;
  let detail='';
  if(id==='training')detail=`<p class="filtered-training-total">${recap.training.rest?'Rest day':day.trainingMode==='training'?`${recap.training.sets} total sets`:'No workout logged'}</p>${recap.bodyWeight?`<p class="recap-body-weight"><span>Body weight</span><strong>${weightText(recap.bodyWeight)}</strong></p>`:''}${recap.training.groups.length?`<ul class="recap-training">${recap.training.groups.map(group=>`<li><span>${muscleName(group.id)}</span><strong>${group.sets} sets</strong></li>`).join('')}</ul>`:''}${recap.notes.filter(note=>note.section==='training').map(note=>`<section class="recap-note"><h4>Training notes</h4><p>${escapeHtml(note.text)}</p></section>`).join('')}`;
  if(id==='nutrition')detail=recap.notes.filter(note=>note.section==='nutrition').map(note=>`<section class="recap-note"><h4>Nutrition notes</h4><p>${escapeHtml(note.text)}</p></section>`).join('');
  if(id==='checklists')detail=`<p>${recap.done} / ${recap.total} actions completed${recap.checklistLogged?'':' · list not logged'}</p><ul class="recap-tasks">${recap.tasks.map(task=>`<li><span>${task.done?'✓':'·'}</span><span>${escapeHtml(task.name)}</span></li>${task.children.map(child=>`<li class="recap-child"><span>${child.done?'✓':'·'}</span><span>${escapeHtml(child.name)}</span></li>`).join('')}`).join('')}</ul>`;
  if(id==='sentiments')detail=day.sentiments.notes.trim()?`<section class="recap-note"><h4>Sentiments</h4><p>${escapeHtml(day.sentiments.notes)}</p></section>`:'<p>No sentiments notes.</p>';
  return `<div class="recap-score">${circle(value,true)}<div><strong>${label}</strong><p>${value===null?'Not logged':day.reviewed[id]?'Reviewed':'Logged'}${id==='sentiments'&&value===null&&day.sentiments.notes.trim()?' · notes only':''}</p></div></div>${detail}`;
}
function renderRecap() {
  $('#open-selected-day').hidden=archivedDay();
  $('.history-detail>.eyebrow').textContent=calendarFilter==='all'?'DAILY RECAP':`${categoryLabels[calendarFilter].toUpperCase()} RECAP`;
  $('#open-selected-day').innerHTML=`${calendarFilter==='all'?'Open this day':`Open ${categoryLabels[calendarFilter].toLowerCase()}`} ${icon('arrow')}`;
  $('#history-date').textContent=dateFormat(selectedDate,{weekday:'short',month:'short',day:'numeric'});
  $('#history-content').innerHTML=recapMarkup();
  if(recapDate&&recapDate!==selectedDate)reveal($('#history-content'));
  recapDate=selectedDate;
}
function renderAchievements(recompute=true) {
  if(recompute||!achievementData)achievementData=buildAchievements(store,editableToday());
  const data=achievementData;
  $('#achievements-through').textContent=`Your saved history · through ${longDate(editableToday())}`;
  $('#achievements-summary').innerHTML=`<div class="achievement-total">${icon('trophy')}<strong>${data.unlocked}<small> / ${data.total}</small></strong><span>Achievements unlocked</span></div><div><strong>${data.earned}</strong><span>Total times earned</span></div><div><strong>${data.completed}</strong><span>Days completed</span></div>`;
  const streakLabels={logging:'Consecutive days logged',strong:'9+ point days in a row'};
  $('#achievement-streaks').innerHTML=Object.entries(data.streaks).map(([id,streak])=>`<div><span>${streakLabels[id]}</span><strong>${streak.current}<small> day${streak.current===1?'':'s'}</small></strong><small>Best ${streak.best}${streak.current&&!streak.includesToday?' · through yesterday':''}</small></div>`).join('');
  $$('[data-achievement-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.achievementFilter===achievementFilter)));
  $('#achievement-unlocked-only').setAttribute('aria-pressed',String(unlockedOnly));
  const labels={overall:'Overall',nutrition:'Nutrition',training:'Gym',checklists:'To-do list',sentiments:'Sentiments',streaks:'Streaks'};
  $$('[data-achievement-order]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.achievementOrder===achievementOrder)));
  const cards=sortAchievements(data.cards.filter(card=>(achievementFilter==='all'||card.group===achievementFilter)&&(!unlockedOnly||card.count)),achievementOrder);
  $('#achievement-results').textContent=`${cards.length} achievements shown. ${data.unlocked} of ${data.total} unlocked.`;
  $('#achievement-grid').innerHTML=cards.length?cards.map(card=>{
    const progress=card.streak?`Current ${card.streak.current} days · best ${card.streak.best}`:card.unit==='score'?`Best ${scoreText(card.value)} · Goal ${card.target}${card.target<10?'+':''}`:card.id==='weekly-five'?`Best week: ${card.value} days`:card.count?`${card.value} ${card.value===1?card.unit.slice(0,-1):card.unit} recorded`:`${card.value} / ${card.target} ${card.target===1?card.unit.slice(0,-1):card.unit}`;
    return `<article class="achievement-card ${card.count?'is-unlocked':'is-locked'}"><div class="achievement-card-top"><span class="achievement-emblem">${achievementIcon(card.id)}</span><span>${labels[card.group]}</span><strong>${card.count?`${card.count}× earned`:'Locked'}</strong></div><h2>${escapeHtml(card.title)}</h2><p>${escapeHtml(card.description)}</p><div class="achievement-progress"><span>${progress}</span><progress max="${card.target}" value="${Math.min(card.target,card.value)}" aria-label="${escapeHtml(card.title)} progress"></progress></div><small class="achievement-last">${card.first?`First earned ${dateFormat(card.first,{month:'short',day:'numeric',year:'numeric'})}${card.latest!==card.first?`<br>Latest ${dateFormat(card.latest,{month:'short',day:'numeric',year:'numeric'})}`:''}`:'Still ahead of you'}</small></article>`;
  }).join(''):'<p class="achievement-empty">No unlocked achievements in this category yet.</p>';
}
function render() { renderHeader(); renderTasks(); renderScore(); renderRating(); renderGym(); renderSentiments(); renderNotes(); renderReview(); if (view === 'history') renderHistory(); if(view==='achievements')renderAchievements(); if($('#weight-history-dialog').open)renderWeightHistory();renderSaveStatus(); }
function setView(next, focus = false) {
  if (!Object.hasOwn(viewLabels, next)) return;
  if(archivedDay()&&next!=='achievements')next='history';
  const changed=view!==next,mainScroll=$('#main').scrollTop;
  // Keep the navigation at the same viewport height. Deep content starts afresh
  // under the pinned strip rather than leaving a short tab scrolled into blank space.
  const scrollY=Math.min(window.scrollY,$('#tab-scroll-anchor').getBoundingClientRect().top+window.scrollY);
  // Reserve the current document height before hiding a long phone panel.
  if(changed&&phoneLayout())$('#main').style.minHeight=`${Math.max(0,scrollY+window.innerHeight-($('#main').getBoundingClientRect().top+scrollY))}px`;
  view = next; render();
  // UI-03: switching phone sections must reveal the new content, including utility pages.
  if(changed&&phoneLayout()) {
    window.scrollTo({top:scrollY,behavior:'instant'});
  }
  if(changed)reveal($('#'+panelIds[view]));
  $('#main').scrollTo({top:mainScroll,behavior:'instant'});
  if (focus) ($('#tab-' + view)||$('#main')).focus({preventScroll:true});
}
function navigateDay(date, changeMonth = true) {
  flushSave();
  if (date !== selectedDate) reviewSessionDate = null;
  selectedDate = date; dayRollover.select(date, appDateKey()); if (changeMonth) calendarMonth = date;
  $('#task-name').value = ''; $('#rating-value').setCustomValidity(''); $('#gym-sets').setCustomValidity('');
  $('#gym-log').hidden = true; $('#toggle-gym-log').setAttribute('aria-expanded','false'); $('#toggle-gym-log').textContent = "View week's entries";
  render();
}
function startReview() {
  if(archivedDay()){setView('history');return;}
  const progress = store.dayProgress(selectedDate);
  if (progress.completedAt) { showFinalReview(); return; }
  if (progress.canComplete) { showFinalReview(); return; }
  reviewSessionDate = selectedDate;
  setView((progress.sections.find(section => !section.ready) || progress.sections.find(section => !section.reviewed)).id, true);
}
function startCompletion() {
  if(archivedDay()){setView('history');return;}
  const progress = store.dayProgress(selectedDate);
  if (progress.completedAt) { showFinalReview(); return; }
  if (!progress.canComplete) { startReview(); return; }
  showFinalReview();
}
function showFinalReview() {
  if(archivedDay()){setView('history');return;}
  const progress=store.dayProgress(selectedDate);
  if(!progress.canComplete)return;
  setView('today');
  $('#final-review-date').textContent=longDate(selectedDate);
  $('#final-review-content').innerHTML=recapMarkup({final:true});
  const sentiments=store.loadDay(selectedDate).sentiments;
  $('#final-sentiments-notes').value=sentiments.notes;
  renderFinalSentimentsState();
  showDialog($('#final-review-dialog'));
  refreshNoteCarets();
}
function renderFinalSentimentsState() {
  const day=store.loadDay(selectedDate),progress=store.dayProgress(selectedDate),rating=day.sentiments.rating;
  const meter=$('#final-sentiments-meter');
  drawScoreMeter(meter,rating,{immediate:finalSentimentPointer!==-1});
  meter.querySelector('.meter-number').innerHTML=scoreMarkup(rating);
  meter.querySelector('.meter-out-of').textContent=rating===null?'not rated yet':'out of 10';
  meter.setAttribute('aria-valuenow',rating??0);
  meter.setAttribute('aria-valuetext',rating===null?'Not rated. Drag for a score from 0 to 10.':`${scoreText(rating)} out of 10`);
  $('#final-clear-sentiments-rating').disabled=rating===null;
  $('#submit-day').disabled=!!progress.completedAt||!progress.canComplete;
  $('#submit-day').textContent=progress.completedAt?'✓ Day complete':'Complete entire day';
  $('#final-review-intro').textContent=progress.completedAt?'This day is complete. You can update Sentiments below.':'All section reviews are confirmed. Take one last look.';
  $('#final-review-content').innerHTML=recapMarkup({final:true});
}
function updateRating(score, notify = false) {
  store.updateRating(selectedDate, score);
  renderRating(); renderScore(); renderReview(); renderHeader();
  if (notify) announce(score === null ? 'Nutrition rating cleared.' : `Nutrition set to ${scoreText(score)}.`);
}
function updateClock() {
  const now = new Date(), parts = new Intl.DateTimeFormat('en-US', { hour:'numeric', minute:'2-digit', hour12:true }).formatToParts(now);
  const value = type => parts.find(part => part.type === type)?.value ?? '';
  $('#clock-time').innerHTML = `${value('hour')}:${value('minute')}<small>${value('dayPeriod').toLowerCase()}</small>`;
  $('#clock-time').dateTime = now.toISOString();
  $('#clock-date').textContent = dateFormat(appDateKey(now), {weekday:'long', month:'short', day:'numeric'});
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
$('#go-today').addEventListener('click', () => navigateDay(appDateKey()));
$('#notice-go-today').addEventListener('click', () => navigateDay(appDateKey()));
function returnToOverview() {if(archivedDay())navigateDay(editableToday());setView('today',true);}
$('#open-home').addEventListener('click',returnToOverview);
$('#open-achievements').addEventListener('click',()=>view==='achievements'?returnToOverview():setView('achievements',true));
$('#achievements-overview').addEventListener('click',returnToOverview);
$('#achievement-filters').addEventListener('click',event=>{const button=event.target.closest('[data-achievement-filter]');if(!button)return;achievementFilter=button.dataset.achievementFilter;renderAchievements(false);});
$('#achievement-order').addEventListener('click',event=>{const button=event.target.closest('[data-achievement-order]');if(button){achievementOrder=button.dataset.achievementOrder;renderAchievements(false);}});
$('#achievement-unlocked-only').addEventListener('click',()=>{unlockedOnly=!unlockedOnly;renderAchievements(false);});
for (const id of ['date-short', 'open-calendar']) $('#' + id).addEventListener('click', () => { calendarMonth = selectedDate; setView('history', true); });
$('#mobile-calendar').addEventListener('click', () => {
  calendarMonth=selectedDate;setView('history',true);
});
$('#history-today').addEventListener('click', () => navigateDay(appDateKey()));
$('#calendar-filters').addEventListener('click',event=>{const button=event.target.closest('[data-calendar-filter]');if(button&&Object.hasOwn(categoryLabels,button.dataset.calendarFilter)){calendarFilter=button.dataset.calendarFilter;renderHistory();}});
$('#open-selected-day').addEventListener('click', () => setView(calendarFilter==='all'?'today':calendarFilter, true));
$('#previous-month').addEventListener('click', () => { calendarMonth = moveMonth(calendarMonth, -1); renderHistory(); });
$('#next-month').addEventListener('click', () => { calendarMonth = moveMonth(calendarMonth, 1); renderHistory(); });
$('#calendar').addEventListener('click', event => {
  const button = event.target.closest('[data-calendar-date]'); if (!button) return;
  navigateDay(button.dataset.calendarDate, false);
  $(`[data-calendar-date="${selectedDate}"]`).focus({preventScroll:true});
  if(phoneLayout()){$('.history-detail').scrollIntoView({block:'start',behavior:'instant'});$('.history-detail').focus({preventScroll:true});}
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
  const edit=event.target.closest('[data-edit-task]');
  if(edit){openTaskEditor(edit,selectedDate,edit.dataset.editTask,edit.dataset.editChild);return;}
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
let pendingTaskRemoval=null;
function confirmTaskRemoval({title,message,label,action}) {
  pendingTaskRemoval=action;$('#task-removal-title').textContent=title;$('#task-removal-message').textContent=message;$('#confirm-task-removal').textContent=label;
  showDialog($('#task-removal-dialog'));$('#cancel-task-removal').focus();
}
$('#task-removal-dialog').addEventListener('close',()=>{pendingTaskRemoval=null;});
$('#cancel-task-removal').addEventListener('click',()=>closeDialog($('#task-removal-dialog')));
$('#confirm-task-removal').addEventListener('click',()=>{const action=pendingTaskRemoval;closeDialog($('#task-removal-dialog'));action?.();});
$('#task-list').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-task]'); if (!button) return;
  const date=selectedDate,task=store.loadDay(date).tasks.find(task=>task.id===button.dataset.removeTask);if(!task)return;
  const remove=()=>{const removed=store.removeTask(date,task.id);render();$('#open-task-composer').focus({preventScroll:true});announce('Task removed.',()=>{store.restoreTask(date,removed.task,removed.index);render();announce('Task restored.');});};
  if(task.templateId)confirmTaskRemoval({title:'Remove this occurrence?',message:`Remove “${task.name}” for ${longDate(date)} only? Its recurring schedule will continue on other days.`,label:'Remove for this day',action:remove});
  else remove();
});
$('#undo-action').addEventListener('click', () => undoAction?.());
const taskTextMeasure=document.createElement('canvas').getContext('2d');
const taskWrapMeasure=document.createElement('div');
taskWrapMeasure.setAttribute('aria-hidden','true');
taskWrapMeasure.style.cssText='position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;height:auto;min-height:0;border:0;';
document.body.append(taskWrapMeasure);
function fitTaskField(field) {
  if(!field.clientWidth)return;
  const style=getComputedStyle(field),size=Number.parseFloat(style.fontSize);
  if(taskTextMeasure)taskTextMeasure.font=`${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
  const metrics=taskTextMeasure?.measureText('Agypqj');
  const caps=taskTextMeasure?.measureText('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
  const fontAscent=metrics?.fontBoundingBoxAscent??size*.75,fontDescent=metrics?.fontBoundingBoxDescent??size*.25;
  const ascent=caps?.actualBoundingBoxAscent??size*.7,descent=metrics?.actualBoundingBoxDescent??size*1.15;
  const lineHeight=Math.ceil(size*1.12),leading=(lineHeight-fontAscent-fontDescent)/2;
  const top=Math.ceil(Math.max(0,ascent-fontAscent-leading)+1);
  const overhang=Math.ceil(Math.max(0,descent-fontDescent-leading)+1);
  for(const property of ['fontFamily','fontSize','fontStyle','fontWeight','fontKerning','letterSpacing','wordSpacing','wordBreak','tabSize','paddingLeft','paddingRight'])taskWrapMeasure.style[property]=style[property];
  taskWrapMeasure.style.width=`${field.clientWidth}px`;
  taskWrapMeasure.style.lineHeight=`${lineHeight}px`;
  taskWrapMeasure.style.paddingTop=`${top}px`;taskWrapMeasure.style.paddingBottom='1px';
  taskWrapMeasure.textContent=field.value||field.placeholder||' ';
  // Line boxes measure wrapping; scrollHeight also includes the unusually long
  // handwritten descenders. Reserve their ink outside the visible writing box.
  const height=Math.max(lineHeight+top+1,taskWrapMeasure.offsetHeight);
  field.parentElement.style.height=`${height}px`;
  field.style.lineHeight=`${lineHeight}px`;
  field.style.paddingTop=`${top}px`;field.style.paddingBottom=`${overhang+1}px`;
  field.style.marginBottom='0px';field.style.height=`${height+overhang}px`;
}
function fitTaskFields() { if($('#task-dialog').open)$$('#task-name,[data-child-name]').forEach(fitTaskField); }
document.fonts.ready.then(fitTaskFields);
document.fonts.addEventListener('loadingdone',fitTaskFields);
window.addEventListener('resize',fitTaskFields);
function updateFrequency() { $('#custom-weekdays').hidden=$('#task-frequency').value!=='custom';fitTaskFields(); }
$('#task-frequency').addEventListener('change',updateFrequency);
function renderTaskDate() {
  const date=$('#task-date').value,today=editableToday();
  taskComposeDate=date;
  $('#task-start-date').textContent=date?longDate(date):'Choose a date';
  $$('[data-task-when]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.taskWhen)===2?date>=addDays(today,2)&&date<=addDays(today,7):date===addDays(today,Number(button.dataset.taskWhen)))));
  $('#task-week-options').hidden=!date||date<addDays(today,2)||date>addDays(today,7);
  $('#task-week-options').innerHTML=Array.from({length:6},(_,index)=>{const key=addDays(today,index+2);return `<button type="button" class="quiet-button" data-task-date-choice="${key}" aria-pressed="${date===key}">${dateFormat(key,{weekday:'short',day:'numeric'})}</button>`;}).join('');
  $('#task-submit').textContent=taskEdit?'Save changes':date===addDays(today,1)?'Add for tomorrow':'Add task';
}
function renderTaskEditScope() {
  const recurring=!!taskEdit?.templateId,future=recurring&&$('[name="task-edit-scope"]:checked').value==='future';
  $('#task-edit-scope').hidden=!recurring;
  $('.task-date-picker').hidden=recurring;
  $('.task-schedule').hidden=!!taskEdit&&!future;
  $('#custom-weekdays').hidden=(!!taskEdit&&!future)||$('#task-frequency').value!=='custom';
  $('#task-frequency option[value="once"]').disabled=future;
}
function appendSubtaskField(child={name:''}) {
  const row=document.createElement('div');row.className='subtask-input-row';
  row.innerHTML='<div class="task-writing-field"><textarea data-child-name rows="1" maxlength="100" placeholder="Subtask name" aria-label="Subtask name" autocomplete="off" required></textarea></div><button class="remove-task" type="button" data-remove-subtask aria-label="Remove subtask">×</button>';
  const input=row.querySelector('textarea');input.value=child.name;if(child.id)input.dataset.childId=child.id;
  $('#subtask-inputs').append(row);refreshNoteCarets.add([input]);return input;
}
function openTaskComposer(trigger,date=selectedDate) {
  taskEdit=null;
  taskComposerTrigger=trigger;
  $('#add-task-form').reset();$('#subtask-inputs').innerHTML='';$('#task-composer-error').textContent='';
  $('#task-name').style.height='';
  $('#task-date').min=addDays(editableToday(),-7);$('#task-date').max=addDays(editableToday(),7);$('#task-date').value=date;renderTaskDate();
  $('#task-dialog-title').textContent='Add task';renderTaskEditScope();updateFrequency();showDialog($('#task-dialog'));$('#task-name').focus();fitTaskFields();
}
function openTaskEditor(trigger,date,id,childId) {
  const task=store.loadDay(date).tasks.find(task=>task.id===id);if(!task)return;
  openTaskComposer(trigger,date);taskEdit={date,id,templateId:task.templateId};
  $('#task-dialog-title').textContent='Edit task';$('#task-name').value=task.name;
  for(const child of task.children)appendSubtaskField(child);
  if(task.templateId) {
    const template=store.loadTemplates().find(template=>template.id===task.templateId);
    $('#task-frequency').value=template.frequency;
    $$('[name="repeat-day"]').forEach(input=>input.checked=template.weekdays.includes(Number(input.value)));
  }
  renderTaskDate();renderTaskEditScope();fitTaskFields();
  (childId?$$('[data-child-name]').find(input=>input.dataset.childId===childId):$('#task-name'))?.focus();
}
$$('[name="task-edit-scope"]').forEach(input=>input.addEventListener('change',()=>{renderTaskEditScope();fitTaskFields();}));
for(const id of ['open-task-composer','overview-add-task'])$('#'+id).addEventListener('click',event=>openTaskComposer(event.currentTarget));
for(const id of ['plan-tomorrow','add-tomorrow-task'])$('#'+id).addEventListener('click',event=>openTaskComposer(event.currentTarget,addDays(editableToday(),1)));
$('#add-later-task').addEventListener('click',event=>openTaskComposer(event.currentTarget,addDays(editableToday(),2)));
for(const id of ['tomorrow-tasks','later-tasks'])$('#'+id).addEventListener('click',event=>{
  const edit=event.target.closest('[data-edit-planned]');if(edit){openTaskEditor(edit,edit.dataset.plannedDate,edit.dataset.editPlanned);return;}
  const date=event.target.closest('[data-view-task-date]');if(date){navigateDay(date.dataset.viewTaskDate);setView('checklists',true);}
});
$('#view-tomorrow').addEventListener('click',()=>{navigateDay(addDays(editableToday(),1));setView('checklists',true);});
$$('[data-task-when]').forEach(button=>button.addEventListener('click',()=>{$('#task-date').value=addDays(editableToday(),Number(button.dataset.taskWhen));renderTaskDate();}));
$('#task-date').addEventListener('change',renderTaskDate);
$('#task-week-options').addEventListener('click',event=>{const button=event.target.closest('[data-task-date-choice]');if(button){$('#task-date').value=button.dataset.taskDateChoice;renderTaskDate();}});
$('#cancel-task').addEventListener('click',()=>closeDialog($('#task-dialog')));
$('#add-subtask').addEventListener('click',()=>{
  if($$('[data-child-name]').length>=20){$('#task-composer-error').textContent='Use up to 20 subtasks.';return;}
  appendSubtaskField().focus();fitTaskFields();
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
  if(!$('#task-date').checkValidity()){ $('#task-date').reportValidity();return; }
  const editing=!!taskEdit;
  try {
    let id;
    if(taskEdit) {
      const changes={name:input.value,children:$$('[data-child-name]').map(field=>({id:field.dataset.childId||null,name:field.value})),date:taskComposeDate,recurrence:options.recurrence};
      id=taskEdit.templateId&&$('[name="task-edit-scope"]:checked').value==='future'?store.editRoutine(taskEdit.date,taskEdit.id,changes):store.editTask(taskEdit.date,taskEdit.id,changes);
    } else id=store.addTask(taskComposeDate,input.value,options);
    if(id&&options.children.length)expandedTasks.add(id);
  }
  catch(error){$('#task-composer-error').textContent=error.message;return;}
  closeDialog($('#task-dialog'));render();(taskComposerTrigger.isConnected?taskComposerTrigger:$(view==='today'?'#overview-add-task':'#open-task-composer')).focus({preventScroll:true});acknowledge($(view==='today'?'.overview-tasks':'.checklist-editor'));announce(editing?'Task changes saved.':`${frequency==='once'?'Task':'Recurring task'} added ${taskComposeDate===addDays(editableToday(),1)?'for tomorrow':`for ${shortDate(taskComposeDate)}`}.`);taskEdit=null;
});
$('#task-name').addEventListener('input', event => event.target.setCustomValidity(''));
function updateWeightDraftHint() {
  const saved=store.loadDay(selectedDate).bodyWeight,field=$('#body-weight');
  const changed=weightEditor.open&&(field.value!==''?(Number(field.value)!==saved?.value||bodyWeightUnit!==saved?.unit):!!saved);
  $('#body-weight-status').textContent=changed?'Unsaved weight · choose Save weight.':saved?`${weightText(saved)} saved for ${shortDate(selectedDate)}`:'Separate from your gym score.';
}
$('#body-weight').addEventListener('input',updateWeightDraftHint);
weightEditor.addEventListener('toggle',()=>{if(!weightEditor.open){renderGym();cloud?.resume();}});
$('#body-weight-form').addEventListener('submit',event=>{
  event.preventDefault();const input=$('#body-weight');
  if(!input.checkValidity()){input.reportValidity();return;}
  try {store.updateBodyWeight(selectedDate,{value:Number(input.value),unit:bodyWeightUnit});render();weightEditor.open=false;$('#weight-editor-label').focus();announce('Body weight saved.');}
  catch(error){announce(error.message);}
});
$$('[name="weight-unit"]').forEach(input=>input.addEventListener('change',()=>{
  const field=$('#body-weight'),value=Number(field.value),unit=input.value;
  if(field.value&&Number.isFinite(value)&&unit!==bodyWeightUnit)field.value=(unit==='kg'?value/2.2046226218:value*2.2046226218).toFixed(1);
  bodyWeightUnit=unit;field.max=unit==='kg'?700:1500;updateWeightDraftHint();
}));
$('#remove-body-weight').addEventListener('click',()=>{store.updateBodyWeight(selectedDate,null);render();announce('Body weight removed.');});
function renderWeightHistory() {
  weightPointPinned=false;
  const points=weightHistory(store.exportSnapshot(),{unit:weightChartUnit,through:editableToday(),days:weightHistoryDays}),plot=weightPlot(points);
  $$('[data-weight-range]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.weightRange)===weightHistoryDays)));
  $$('[data-chart-unit]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.chartUnit===weightChartUnit)));
  $('#weight-chart-summary').textContent=points.length?`${points.at(-1).value.toFixed(1)} ${weightChartUnit} latest · ${points.length} weigh-in${points.length===1?'':'s'}${points.length>1?` · change ${points.at(-1).value-points[0].value>0?'+':''}${(points.at(-1).value-points[0].value).toFixed(1)} ${weightChartUnit}`:''}`:'No weights recorded in this period.';
  $('#weight-chart-records').innerHTML=[...points].reverse().map(point=>`<tr><td>${longDate(point.date)}</td><td>${point.value.toFixed(1)} ${weightChartUnit}</td></tr>`).join('');
  $('.weight-chart-data').hidden=!points.length;
  if(!plot){$('#weight-chart').innerHTML='<p class="weight-chart-empty">Log your body weight on the training tab to start your graph.</p>';return;}
  const ticks=Array.from({length:5},(_,index)=>({value:plot.min+(plot.max-plot.min)*index/4,y:225-index*190/4}));
  $('#weight-chart').innerHTML=`<svg viewBox="0 0 700 280" role="group" aria-label="Body weight in ${weightChartUnit}, ${shortDate(points[0].date)} to ${shortDate(points.at(-1).date)}. Hover, focus, or tap a reading for the previous day's nutrition and training.">${ticks.map(tick=>`<line class="weight-gridline" x1="70" x2="630" y1="${tick.y}" y2="${tick.y}"/><text x="58" y="${tick.y+4}" text-anchor="end">${tick.value.toFixed(1)}</text>`).join('')}<polyline class="weight-line" points="${plot.points.map(point=>`${point.x},${point.y}`).join(' ')}"/>${plot.points.map(point=>`<g class="weight-reading" data-weight-date="${point.date}" tabindex="0" role="button" aria-label="${longDate(point.date)}, ${point.value.toFixed(1)} ${weightChartUnit}. Show previous day's scores."><circle class="weight-hit-area" cx="${point.x}" cy="${point.y}" r="4"/><circle class="weight-point" cx="${point.x}" cy="${point.y}" r="4"/></g>`).join('')}<text x="70" y="255">${shortDate(points[0].date)}</text>${points.length>1?`<text x="630" y="255" text-anchor="end">${shortDate(points.at(-1).date)}</text>`:''}<text x="630" y="20" text-anchor="end">${weightChartUnit}</text></svg><div id="weight-day-card" class="weight-day-card" role="status" aria-live="polite" hidden></div>`;
}
$('#open-weight-history').addEventListener('click',()=>{weightChartUnit=bodyWeightUnit;renderWeightHistory();showDialog($('#weight-history-dialog'));});
function hideWeightPointCard() {
  const card=$('#weight-day-card');if(card)card.hidden=true;weightPointPinned=false;
  $$('#weight-chart [data-weight-date]').forEach(point=>{point.classList.remove('is-active');point.setAttribute('aria-expanded','false');});
}
function showWeightPointCard(point) {
  const card=$('#weight-day-card');if(!card||!point)return;
  const context=weightPointContext(point.dataset.weightDate,summaryFor);
  const change=weightDayChange(store.exportSnapshot(),context.date,weightChartUnit);
  const changeLabel=change===null?'No previous-day weight':`${change>0?'+':change<0?'−':''}${Math.abs(change).toFixed(1)} ${weightChartUnit} vs previous day`;
  $$('#weight-chart [data-weight-date]').forEach(item=>{item.classList.toggle('is-active',item===point);item.setAttribute('aria-expanded',String(item===point));});
  card.innerHTML=`<strong>${dateFormat(context.date,{month:'short',day:'numeric',year:'numeric'})} weigh-in</strong><span class="weight-day-change">${changeLabel}</span><span>Previous day · ${shortDate(context.previousDate)}</span><div class="weight-day-scores">${[['Nutrition',context.nutrition],['Training',context.training]].map(([label,score])=>`<div>${circle(score,true)}<strong>${label}</strong><small>${score===null?'Not logged':'out of 10'}</small></div>`).join('')}</div>`;
  card.hidden=false;
  const chart=$('#weight-chart'),origin=chart.getBoundingClientRect(),anchor=point.querySelector('.weight-point').getBoundingClientRect(),scale=origin.width/chart.offsetWidth;
  const x=(anchor.left+anchor.width/2-origin.left)/scale-chart.clientLeft,y=(anchor.top+anchor.height/2-origin.top)/scale-chart.clientTop;
  card.style.left=`${Math.max(8,Math.min(chart.clientWidth-card.offsetWidth-8,x-card.offsetWidth/2))}px`;
  const preferred=y-card.offsetHeight-14;
  card.style.top=`${Math.max(8,Math.min(chart.clientHeight-card.offsetHeight-8,preferred>=8?preferred:y+14))}px`;
}
function weightReadingAtPointer(event) {
  if(!event.target.closest('[data-weight-date]'))return null;
  const points=$$('#weight-chart [data-weight-date]').map(element=>{const bounds=element.querySelector('.weight-point').getBoundingClientRect();return {element,x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2};});
  return nearestWeightPoint(points,event.clientX,event.clientY)?.element??null;
}
$('#weight-chart').addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse')return;
  const point=weightReadingAtPointer(event);
  if(!point){if(!weightPointPinned)hideWeightPointCard();return;}
  if(point.classList.contains('is-active'))return;
  weightPointPinned=false;showWeightPointCard(point);
});
$('#weight-chart').addEventListener('pointerover',event=>{
  const point=weightReadingAtPointer(event);if(!point||event.pointerType==='touch')return;
  weightPointPinned=false;showWeightPointCard(point);
});
$('#weight-chart').addEventListener('pointerout',event=>{
  const point=event.target.closest('[data-weight-date]');if(!point||weightPointPinned||point.contains(event.relatedTarget))return;
  hideWeightPointCard();
});
$('#weight-chart').addEventListener('pointerdown',event=>{
  const point=weightReadingAtPointer(event);if(!point)return;
  event.preventDefault();point.focus({preventScroll:true});
  weightPointPinned=event.pointerType!=='mouse';showWeightPointCard(point);
});
$('#weight-chart').addEventListener('focusin',event=>{const point=event.target.closest('[data-weight-date]');if(point)showWeightPointCard(point);});
$('#weight-chart').addEventListener('focusout',event=>{if(!weightPointPinned&&!event.relatedTarget?.closest?.('[data-weight-date]'))hideWeightPointCard();});
$('#weight-chart').addEventListener('keydown',event=>{
  const point=event.target.closest('[data-weight-date]');if(!point)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hideWeightPointCard();}
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();weightPointPinned=true;showWeightPointCard(point);}
});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('#weight-chart [data-weight-date]'))hideWeightPointCard();});
$('#weight-history-dialog').addEventListener('close',hideWeightPointCard);
$$('[data-weight-range]').forEach(button=>button.addEventListener('click',()=>{weightHistoryDays=Number(button.dataset.weightRange);renderWeightHistory();}));
$$('[data-chart-unit]').forEach(button=>button.addEventListener('click',()=>{weightChartUnit=button.dataset.chartUnit;renderWeightHistory();}));
$('#recurring-tasks').addEventListener('click',event=>{
  const button=event.target.closest('[data-stop-template]');if(!button)return;
  const template=store.loadTemplates().find(template=>template.id===button.dataset.stopTemplate);if(!template)return;
  const stopAfter=appDateKey();
  confirmTaskRemoval({title:'Stop this recurring task?',message:`Stop “${template.name}” after today? Future occurrences will be removed. Today and earlier history will be kept.`,label:'Stop recurring schedule',action:()=>{store.stopTemplate(template.id,stopAfter);render();announce('Recurring task stopped after today. Earlier days are kept.');}});
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
bindMeterDrag(nutritionMeter,{min:1,scaleMin:0,read:()=>store.loadDay(selectedDate).nutrition,change:updateRating,onStart:()=>dragging=true,onEnd:()=>{
  dragging=false;
  const score=store.loadDay(selectedDate).nutrition;
  if(score!==null)announce(`Nutrition set to ${scoreText(score)}.`);
}});

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
$('#creatine-taken').addEventListener('change',event=>{store.setCreatine(selectedDate,event.target.checked);render();});
$('#gym-sets').addEventListener('input', event => event.target.setCustomValidity(''));
$$('[name="training-mode"]').forEach(input => input.addEventListener('change', () => {
  try { store.setTrainingMode(selectedDate, input.value==='no'?'rest':input.value); render(); }
  catch (error) { announce(error.message); renderGym(); }
}));
for (const id of ['daily-training-entries','gym-log']) $('#' + id).addEventListener('click', event => {
  const button = event.target.closest('[data-remove-entry]'); if (!button) return;
  store.removeGymEntry(button.dataset.removeEntry); render(); $('#gym-sets').focus({preventScroll:true}); announce('Set entry removed. Lifting status is unchanged.');
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
$('#review-primary').addEventListener('click', () => {
  const progress=store.dayProgress(selectedDate),section=progress.sections.find(item=>item.id===view);
  if(!section||section.reviewed){startReview();return;}
  if (section.id === 'nutrition' && !$('#rating-value').checkValidity()) { $('#rating-value').reportValidity(); return; }
  if (section.id === 'sentiments' && !$('#sentiments-rating').checkValidity()) { $('#sentiments-rating').reportValidity(); return; }
  try { store.confirmSection(selectedDate, section.id); }
  catch (error) { announce(error.message); return; }
  if (reviewSessionDate === selectedDate) setView(store.dayProgress(selectedDate).sections.find(item => !item.reviewed)?.id || 'today', true);
  else render();
  if(store.dayProgress(selectedDate).canComplete) { showFinalReview(); announce('All sections reviewed. Check the full-day summary before completing the day.'); }
  else announce(`${viewLabels[section.id]} review confirmed.`);
});
$('#submit-day').addEventListener('click',()=>{
  const before=buildAchievements(store,editableToday());
  try { store.completeDay(selectedDate); }
  catch(error) { closeDialog($('#final-review-dialog'));render();announce(error.message);return; }
  closeDialog($('#final-review-dialog'));reviewSessionDate=null;setView('today',true);
  const after=buildAchievements(store,editableToday()),earned=firstAchievementUnlocks(before,after,{date:selectedDate,notified:achievementNotified});
  for(const card of earned)achievementNotified.add(card.id);
  preferences={...preferences,achievementNotified:[...achievementNotified]};
  try{localStorage.setItem(preferencesKey,JSON.stringify(preferences));}catch{}
  celebrateDayCompletion();
  announce(`${shortDate(selectedDate)}: entire day completed and saved.`);
  queueAchievementCelebration(earned);
});
function updateFinalSentiments(changes){
  store.updateSentiments(selectedDate,changes);
  if(store.dayProgress(selectedDate).sections.some(section=>section.id==='sentiments'))store.confirmSection(selectedDate,'sentiments');
  renderSentiments();renderScore();renderReview();renderHeader();renderNotes();renderFinalSentimentsState();
}
$('#final-sentiments-notes').addEventListener('input',event=>updateFinalSentiments({notes:event.target.value}));
$('#final-clear-sentiments-rating').addEventListener('click',()=>updateFinalSentiments({rating:null}));
let finalSentimentPointer=-1;
const finalSentimentMeter=$('#final-sentiments-meter');
bindMeterDrag(finalSentimentMeter,{read:()=>store.loadDay(selectedDate).sentiments.rating,change:rating=>updateFinalSentiments({rating}),onStart:()=>finalSentimentPointer=1,onEnd:()=>finalSentimentPointer=-1});
finalSentimentMeter.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  const direction={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[event.key];
  if(direction){event.preventDefault();const rating=store.loadDay(selectedDate).sentiments.rating;updateFinalSentiments({rating:rating===null?0:Math.max(0,Math.min(10,Math.round(rating*10+direction)/10))});}
  else if(event.key==='Home'||event.key==='End'){event.preventDefault();updateFinalSentiments({rating:event.key==='Home'?0:10});}
});
let completionAnimationTimer;
function celebrateDayCompletion(){
  const overlay=$('#day-complete-overlay');
  clearTimeout(completionAnimationTimer);
  $('#completion-score').textContent=`${scoreText(summaryFor().score)} / 10`;
  overlay.hidden=true;void overlay.offsetWidth;overlay.hidden=false;
  completionAnimationTimer=setTimeout(()=>{overlay.hidden=true;},document.documentElement.dataset.motion==='reduced'?1100:1850);
}
let achievementCelebrationTimer,achievementDismissTimer;
function closeAchievementCelebration() {
  clearTimeout(achievementCelebrationTimer);clearTimeout(achievementDismissTimer);
  $('#achievement-unlock').hidden=true;
}
function queueAchievementCelebration(earned) {
  closeAchievementCelebration();
  if(!earned.length)return;
  // The day-complete overlay and its 3.2-second save toast finish first.
  achievementCelebrationTimer=setTimeout(()=>{
    $('#achievement-unlock-title').textContent=earned.length===1?'Achievement unlocked':`${earned.length} achievements unlocked`;
    $('#achievement-unlock-badges').innerHTML=earned.map(card=>`<div><span>${achievementIcon(card.id)}</span><strong>${escapeHtml(card.title)}</strong><small>${card.count}× earned</small></div>`).join('');
    $('#achievement-unlock').hidden=false;reveal($('#achievement-unlock'));acknowledge($('#open-achievements'));
    achievementDismissTimer=setTimeout(closeAchievementCelebration,earned.length>3?12000:8000);
  },3400);
}
$('#dismiss-achievement-unlock').addEventListener('click',closeAchievementCelebration);
$('#view-unlocked-achievements').addEventListener('click',()=>{closeAchievementCelebration();achievementFilter='all';unlockedOnly=true;setView('achievements',true);});

function showDialog(dialog) { if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open','');reveal(dialog);renderHeaderShortcuts(); }
function closeDialog(dialog) { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');renderHeaderShortcuts(); }
$$('dialog').forEach(dialog=>dialog.addEventListener('close',renderHeaderShortcuts));
$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
$('#score-info').addEventListener('click', () => { closeDialog($('#settings-dialog')); showDialog($('#score-dialog')); });
$('#open-score-info').addEventListener('click',()=>showDialog($('#score-dialog')));
function openSettings() {
  $('#profile-name').value = displayName;renderThemeOptions();
  $('#motion-setting').value=motionPreference;$('#motion-preview').hidden=true;renderMotionSetting();
  $('#settings-message').textContent = storageError ? `Local storage issue: ${storageError}` : preview ? 'This preview saves separately from your personal Pocket Planet data.' : '';
  $('#export-backup').textContent = 'Download local backup';
  $('#export-recovery').hidden = !(loaded.error && loaded.raw);
  showDialog($('#settings-dialog'));
}
$('#open-settings').addEventListener('click', openSettings);
$('#save-status').addEventListener('click', openSettings);
$('#preferences-form').addEventListener('submit', event => {
  event.preventDefault(); const input = $('#profile-name'), name = input.value.trim();
  if (!name) { input.setCustomValidity('Enter a name.'); input.reportValidity(); return; }
  const nextPreferences={...preferences,name,motion:motionPreference};
  try {localStorage.setItem(preferencesKey,JSON.stringify(nextPreferences));preferences=nextPreferences;displayName=name;$('#save-name').textContent='✓ Saved';$('#save-name').classList.add('is-saved');$('#name-save-feedback').textContent=`Saved as ${name} on this device.`;}
  catch {$('#name-save-feedback').textContent='Could not save your name. Browser storage is unavailable.';$('#save-name').classList.remove('is-saved');}
  renderHeader();
});
$('#profile-name').addEventListener('input',event=>{event.target.setCustomValidity('');$('#save-name').textContent='Save name';$('#save-name').classList.remove('is-saved');$('#name-save-feedback').textContent='';});
$$('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>{const theme=button.dataset.themeChoice;try{const next={...preferences,theme};localStorage.setItem(preferencesKey,JSON.stringify(next));preferences=next;window.pocketTheme.apply(theme);renderThemeOptions();render();$('#theme-feedback').textContent='Theme saved on this device.';}catch{$('#theme-feedback').textContent='Theme could not be saved. Browser storage is unavailable.';}}));
function renderThemeOptions(){$$('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===document.documentElement.dataset.theme)));}
function finishWelcome(name) {
  displayName=profileName(name)||'Friend';
  welcomeGoogleAttempt=false;
  preferences={...preferences,name:displayName,welcomed:true,welcomeGooglePending:false};
  try {localStorage.setItem(preferencesKey,JSON.stringify(preferences));}catch{}
  closeDialog($('#welcome-dialog'));renderHeader();
}
$('#welcome-dialog').addEventListener('cancel',event=>event.preventDefault());
$('#welcome-form').addEventListener('submit',event=>{
  event.preventDefault();const input=$('#welcome-name'),name=profileName(input.value);
  if(!name){input.setCustomValidity('Enter a name, up to 30 characters.');input.reportValidity();return;}
  finishWelcome(name);
});
$('#welcome-name').addEventListener('input',event=>event.target.setCustomValidity(''));
$('#welcome-google').addEventListener('click',()=>{
  welcomeGoogleAttempt=true;preferences={...preferences,welcomeGooglePending:true};
  try{localStorage.setItem(preferencesKey,JSON.stringify(preferences));}catch{}
  cloud?.signIn();
});
function renderMotionSetting() {
  const on=document.documentElement.dataset.motion==='full';
  $('#motion-description').textContent=motionPreference==='system'?`Following device setting: animations ${on?'on':'reduced'}.`:on?'Stepped transitions and score sweeps are on.':'Transitions and score sweeps are off.';
  $('#preview-motion').disabled=!on;
  if(!on)$('#motion-preview').hidden=true;
}
$('#motion-setting').addEventListener('change',event=>{
  motionPreference=setMotionPreference(event.target.value);renderMotionSetting();
  preferences={...preferences,name:displayName,motion:motionPreference};
  try {localStorage.setItem(preferencesKey,JSON.stringify(preferences));$('#settings-message').textContent='Motion preference saved on this device.';}
  catch {$('#settings-message').textContent='Motion updated for this session. Browser storage is unavailable.';}
  if(document.documentElement.dataset.motion==='full'){$('#motion-preview').hidden=false;reveal($('#motion-preview'));}
});
$('#preview-motion').addEventListener('click',()=>{$('#motion-preview').hidden=false;reveal($('#motion-preview'));});
function downloadBackup() {
  flushSave();
  const content = JSON.stringify(store.exportSnapshot(), null, 2);
  const url = URL.createObjectURL(new Blob([content], { type:'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `pocket-planet-backup-${appDateKey()}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  $('#settings-message').textContent = 'Backup download requested. Keep the file somewhere you can find again.';
}
$('#export-backup').addEventListener('click',downloadBackup);
$('#reset-backup').addEventListener('click',()=>{downloadBackup();$('#reset-message').textContent='Backup download requested. Confirm that you have the file before resetting.';});
$('#open-reset').addEventListener('click',()=>{
  $('#reset-scope').textContent=preview?'This resets preview data only. Personal Pocket Planet data is separate.':cloud?.isEnabled()?'This clears your personal records here and syncs the reset to Firebase and your other signed-in devices.':'This resets Pocket Planet data in this browser on this device.';
  $('#reset-message').textContent='';
  showDialog($('#reset-dialog'));
});
$('#confirm-reset').addEventListener('click',()=>{
  let reset;
  try {reset=resetLocal(localStorage,{suffix,expectedRaw:lastSavedRaw});}
  catch(error) {$('#reset-message').textContent=`Reset failed. ${error.message}`;return;}
  clearTimeout(saveTimer);pendingSnapshot=null;pendingImport=null;
  store=createStore({clientId,editableToday,snapshot:reset.snapshot,seed:false,onChange:queueSave});achievementNotified.clear();
  lastSavedRaw=reset.raw;storageError=null;blockedSave=false;
  captureRecordEdits(reset.snapshot);
  loaded.raw=null;loaded.error=null;loaded.snapshot=null;
  preferences={};window.pocketTheme.apply('blue');displayName=preview?'Kieran':'Friend';motionPreference=setMotionPreference('system');
  reviewSessionDate=null;recapDate=null;expandedTasks.clear();undoAction=null;
  $('#import-preview').hidden=true;$('#import-file').value='';$('#export-recovery').hidden=true;
  $('#add-task-form').reset();$('#subtask-inputs').innerHTML='';$('#custom-weekdays').hidden=true;
  $$('input,textarea').forEach(input=>input.setCustomValidity(''));$('#gym-sets').value='3';$('#task-composer-error').textContent='';
  $$('details').forEach(details=>details.open=false);$('#gym-log').hidden=true;$('#toggle-gym-log').setAttribute('aria-expanded','false');$('#toggle-gym-log').textContent="View week's entries";
  closeDialog($('#reset-dialog'));closeDialog($('#settings-dialog'));
  selectedDate=appDateKey();dayRollover.select(selectedDate,selectedDate);calendarMonth=selectedDate;
  setView('today',true);
  cloud?.changed();
  announce(`All ${preview?'preview':'Pocket Planet'} data and preferences reset${cloud?.isEnabled()?' and queued to sync':' on this device'}.`);
});
$('#export-recovery').addEventListener('click', () => {
  if (!loaded.raw) return;
  const url = URL.createObjectURL(new Blob([loaded.raw], { type:'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `pocket-planet-recovery-${appDateKey()}.json`; anchor.click();
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
    captureRecordEdits(pendingImport);
    store = createStore({ clientId, editableToday, snapshot:pendingImport, seed:false, onChange:queueSave });
    loaded.error = null; loaded.raw = null; storageError = null; blockedSave = false; pendingSnapshot = null; pendingImport = null;
    $('#import-preview').hidden = true; $('#import-file').value = ''; reviewSessionDate = null;
    cloud?.changed();
    $('#settings-message').textContent = 'Backup restored and saved on this device.';
    $('#export-backup').textContent = 'Download local backup';
    $('#export-recovery').hidden = true;
    navigateDay(appDateKey());
  } catch (error) { $('#settings-message').textContent = `Backup not imported. ${error.message}`; }
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY + suffix || event.newValue === lastSavedRaw) return;
  blockedSave = true; storageError = 'Another tab changed the saved data. Export this tab’s changes before reloading.';
  renderSaveStatus();
});
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
  else refreshClock();
});

document.addEventListener('focusout', event => { if (event.target.matches('textarea,[contenteditable="true"]') && pendingSnapshot) flushSave(); });
let clockReviewPhase='';
function refreshClock() {
  updateClock();
  const now=new Date(),today=appDateKey(now),busy=!!pendingSnapshot||workspaceBusy(document,{reviewing:reviewSessionDate===selectedDate})||dragging||!!targetDrag;
  const rollover=dayRollover.tick(today,{busy});
  if(rollover?.followToday)navigateDay(rollover.today);
  else if(rollover)render();
  else if(!busy)renderHeader();
  const phase=`${today}:${lateCheckInWindow(now)}`;
  if(phase!==clockReviewPhase){clockReviewPhase=phase;renderReview();}
}
refreshClock();
setInterval(refreshClock,15000);
$('#motion-preview').innerHTML=circle(8)+'<span>LCD motion</span>';
render();
reveal($('#'+panelIds[view]));
if (!loaded.snapshot && !loaded.error) queueSave(store.exportSnapshot());
if(welcomeRequired)showDialog($('#welcome-dialog'));

cloud=mountCloud({
  preview,readLocal:()=>pendingSnapshot&&lastSavedRaw?JSON.parse(lastSavedRaw):store.exportSnapshot(),
  localEditTimes:records=>recordEdits.times(records),
  adoptEditTimes:(records,times)=>recordEdits.adopt(records,times),
  flushLocal:()=>{flushSave();return !storageError&&!blockedSave;},
  canApply:()=>!blockedSave&&!pendingSnapshot&&!workspaceBusy(document,{reviewing:reviewSessionDate===selectedDate})&&!dragging&&!targetDrag&&!weightEditor.open&&!($('.target-editor').open&&targetBaseline.some(group=>group.target!==targetDraft.get(group.id))),
  applyLocal:snapshot=>{
    if(storage.getItem(STORAGE_KEY)!==lastSavedRaw)throw new Error('Another local tab changed your records. Reload after downloading a backup.');
    const raw=writeLocal(storage,snapshot);
    store=createStore({clientId,editableToday,snapshot,seed:false,onChange:queueSave});lastSavedRaw=raw;pendingSnapshot=null;storageError=null;
    render();
  },
  onUser:user=>{
    if(user&&($('#welcome-dialog').open||welcomeGoogleAttempt)) {
      const name=typeof user.displayName==='string'?user.displayName.trim().slice(0,30):null;
      if(name)finishWelcome(name);
      else {$('#welcome-status').textContent='Signed in. Enter the name you want to use.';$('#welcome-google').hidden=true;}
    }
  },
  onStatus:state=>{
    cloudLabel=state.label;renderSaveStatus();reminders?.changed();$('#welcome-google').disabled=!state.canSignIn;
    if($('#welcome-dialog').open&&(welcomeGoogleAttempt||['offline','error'].includes(state.status)))$('#welcome-status').textContent=state.message;
  }
});

reminders=mountReminders({cloud,preview});

// iOS reports keyboard viewport height independently of the layout viewport.
function updateVisibleHeight(){document.documentElement.style.setProperty('--visible-height',`${window.visualViewport?.height||window.innerHeight}px`);}
window.visualViewport?.addEventListener('resize',updateVisibleHeight);updateVisibleHeight();
function disableSpelling(root){
  if(root.nodeType!==1)return;
  const fields=[...(root.matches('input,textarea,[contenteditable]')?[root]:[]),...root.querySelectorAll('input,textarea,[contenteditable]')];
  for(const field of fields){field.spellcheck=false;field.setAttribute('autocorrect','off');}
}
disableSpelling(document.documentElement);
new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)disableSpelling(node);}).observe(document.body,{childList:true,subtree:true});
