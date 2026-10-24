import {settingsForDay} from './customization.mjs';

// Shared composition only: scoring, persistence and account transports stay in
// their existing modules. Nodes are moved once so their event handlers survive.
export function mountUIShell({getStore,getDate,getView,onDeleteTask}) {
  const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
  $('#tab-today').after($('#tab-checklists'));
  const scoreDetails=document.createElement('div');scoreDetails.className='score-details';
  $('.day-score').append(scoreDetails);
  for(const selector of ['#score-range','.score-caption','#overall-description','#complete-day'])scoreDetails.append($(selector));

  $('.nutrition-body>div:first-child').classList.add('nutrition-log');
  const macros=document.createElement('div');macros.className='nutrition-macros';macros.append($('#food-amounts'));
  $('.nutrition-notes').before(macros);
  const checkins=document.createElement('div');checkins.className='training-checkins';
  const attendance=$('.daily-training-card>.training-choice');attendance.before(checkins);
  const daily=$('.daily-training-card'),primary=document.createElement('div');primary.className='training-daily-column';daily.before(primary);primary.append(daily);
  daily.insertAdjacentHTML('afterbegin','<div class="panel-heading"><div><p class="eyebrow">DAILY TRAINING</p><h3>Today’s training</h3></div></div>');
  checkins.append(attendance);checkins.after($('.creatine-check'));$('.creatine-check').after($('#weight-editor-label'));
  const score=document.createElement('section');score.className='panel training-score-card';score.setAttribute('aria-labelledby','training-score-title');score.innerHTML='<div class="panel-heading"><div><p class="eyebrow">DAILY SCORE</p><h3 id="training-score-title">Training Score details</h3></div></div>';score.append($('#training-pace'));primary.append(score);
  const workout=document.createElement('section');workout.id='workout-logging';workout.className='workout-logging';workout.setAttribute('aria-labelledby','workout-log-title');workout.innerHTML='<div class="workout-reveal-body"><div class="panel-heading"><div><p class="eyebrow">TODAY’S WORKOUT</p><h3 id="workout-log-title">Log your lifting</h3></div></div></div>';
  daily.insertBefore(workout,$('#weight-editor-label'));
  for(const selector of ['#other-training-log','#gym-form','#daily-training-entries'])workout.firstElementChild.append($(selector));
  const notes=$('.training-notes-card');primary.append(notes);
  const weekly=$('.weekly-training');

  const settings=$('#settings-dialog');
  const groups=new Map();
  function group(id,title,nodes){const details=document.createElement('details');details.className='settings-group';details.dataset.settingsGroup=id;details.innerHTML=`<summary>${title}</summary>`;for(const node of nodes)if(node)details.append(node);settings.append(details);groups.set(id,details);return details;}
  const logging=$('[data-open-config]').closest('.settings-section');
  const appearance=[$('[data-theme-choice]').closest('.settings-section'),$('#motion-title').closest('.settings-section')];
  const account=[$('#preferences-form'),$('#cloud-title').closest('.settings-section')];
  const notifications=$('#reminder-title').closest('.settings-section');
  const backups=$('#export-backup').closest('.settings-section'),reset=$('.reset-settings');
  const about=$('#score-info').closest('.settings-section');
  logging.querySelector('h3').textContent='Logging settings';settings.append(logging);
  group('appearance','Appearance',appearance);group('account','Account & cloud sync',account);
  group('notifications','Notifications',[notifications]);group('data','Backups & data',[backups,reset]);
  settings.append(about);
  backups.querySelector('p').textContent='Export a backup or restore an existing file.';
  $('#cloud-sync-details>p').textContent='Keep your personal records in sync across devices using the same Google account.';
  reset.querySelector('p').textContent='Permanently clear your records and preferences. You’ll confirm before anything is removed.';
  $('#save-status').addEventListener('click',()=>{const id=$('#save-status').classList.contains('has-error')?'data':'account';groups.get(id).open=true;requestAnimationFrame(()=>groups.get(id).scrollIntoView({block:'nearest'}));});
  // Keep editing preferences and scoring references reachable without multiple
  // long scrolling sections in the same small dialog.
  const info=$('#score-dialog'),nav=document.createElement('nav');nav.className='score-info-nav';nav.setAttribute('aria-label','Scoring topics');
  for(const [id,label] of [['sleep','Sleep'],['prayer','Prayer']])info.insertAdjacentHTML('beforeend',`<section class="score-info-section"><h3 id="scoring-${id}">${label}</h3><p>Recorded time ÷ your daily time goal × 10, capped at 10. Enter hours and minutes; zero time scores zero. A blank entry stays unlogged. Disabled sections are excluded. Earlier dates keep their own settings.</p></section>`);
  for(const [id,label] of [['sleep','Sleep'],['prayer','Prayer']])info.insertAdjacentHTML('beforeend',`<section class="score-info-section"><h3 id="scoring-${id}">${label}</h3><p>Recorded time ÷ your daily time goal × 10, capped at 10. Enter hours and minutes; zero time scores zero. Blank time stays unlogged. Disabled sections are excluded. Earlier dates retain their settings.</p></section>`);
  const topics=[['nutrition','Nutrition'],['gym','Training'],['tasks','To-do list'],['sentiments','Sentiments'],['sleep','Sleep'],['prayer','Prayer'],['review','Day review']];
  nav.innerHTML=topics.map(([id,label])=>`<button type="button" data-score-topic="${id}" aria-pressed="false">${label}</button>`).join('');
  info.querySelector('.dialog-heading').after(nav);
  function selectTopic(id){for(const [key] of topics){$('#scoring-'+key).closest('.score-info-section').hidden=key!==id;nav.querySelector(`[data-score-topic="${key}"]`).setAttribute('aria-pressed',String(key===id));}info.scrollTop=0;}
  nav.addEventListener('click',event=>{const button=event.target.closest('[data-score-topic]');if(button)selectTopic(button.dataset.scoreTopic);});
  for(const id of ['open-score-info','score-info'])$('#'+id).addEventListener('click',()=>selectTopic(({training:'gym',checklists:'tasks'})[getView()]||(['nutrition','sentiments','sleep','prayer'].includes(getView())?getView():'review')));
  selectTopic('review');

  $('#task-submit').parentElement.insertAdjacentHTML('afterbegin','<button id="task-editor-delete" type="button" class="text-button" hidden>Remove this task…</button>');
  $('#task-editor-delete').addEventListener('click',onDeleteTask);
  $('#welcome-dialog .eyebrow').hidden=true;
  $('#welcome-title').textContent='Welcome to Pocket Planet';
  $('#welcome-intro').textContent='Choose a name for this device, or sign in to sync your records.';
  $('#welcome-form .primary-button').innerHTML='Continue on this device';
  $('#sync-prompt>p').textContent='Use the same account to keep your tasks, ratings, training, and notes in sync across devices.';
  const duplicateSync=info.querySelector('.scoring-example');if(duplicateSync)duplicateSync.classList.add('scoring-worked-example');
  const intro=$('#sync-prompt>p:nth-of-type(2)');if(intro)intro.textContent='You can enable sync later in Settings.';
  const footer=$('.display-footer');footer.setAttribute('aria-label','Clock and calendar');
  $('#achievements-overview').textContent='Overview';
  $('.achievement-policy').textContent='Scores count after day review. Streaks include weekends; weeks run Monday–Sunday. Editing history updates achievements.';
  $('#friends-view .friends-board .panel-heading h2').textContent='Manage Friends';
  $('#friends-view .friends-board .eyebrow').textContent='';
  const guide=info.querySelector('p');guide.classList.add('score-info-intro');
  return {
    paint(){
      const config=settingsForDay(getStore().loadDay(getDate()));
      document.body.dataset.view=getView();document.body.classList.toggle('nutrition-mode-macros',config.nutrition.mode==='macros');
      macros.hidden=config.nutrition.mode!=='macros';weekly.hidden=config.training.mode==='other';
      workout.hidden=getStore().loadDay(getDate()).trainingMode!=='training';notes.hidden=workout.hidden;$('#workout-log-title').textContent=config.training.mode==='other'?'Log your training':'Log your lifting';
      $('#score-range>span')?.classList.add('score-assumption');
    },
  };
}
