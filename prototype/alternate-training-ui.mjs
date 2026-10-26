export function mountAlternateWorkout({getStore,getDate,isArchived,render,announce}) {
  const hint=document.querySelector('#training-mode-hint');
  hint.insertAdjacentHTML('afterend',`<div id="alternate-workout-option" class="alternate-workout-option" hidden>
    <button id="open-alternate-workout" type="button" class="quiet-button" aria-expanded="false" aria-controls="alternate-workout-form">Log an alternate workout</button>
    <div id="alternate-workout-saved" hidden><strong>Alternate workout</strong><p id="alternate-workout-summary"></p><div class="alternate-workout-actions"><button id="edit-alternate-workout" type="button" class="quiet-button">Edit workout</button><button id="no-workout-today" type="button" class="text-button">No workout today</button></div></div>
    <form id="alternate-workout-form" hidden>
      <label for="alternate-workout-description">What did you do?</label>
      <textarea id="alternate-workout-description" maxlength="1000" rows="3" required placeholder="e.g. A 30-minute bike ride" aria-describedby="alternate-workout-help"></textarea>
      <p id="alternate-workout-help" class="hint">5 points + your creatine point. Keeps your flex rest credit.</p>
      <div class="alternate-workout-actions"><button type="submit" class="primary-button">Save workout</button><button id="cancel-alternate-workout" type="button" class="text-button">Cancel</button></div>
    </form>
    <p id="alternate-workout-status" class="hint" role="status"></p>
  </div>`);
  const $=id=>document.getElementById(id),option=$('alternate-workout-option'),open=$('open-alternate-workout'),form=$('alternate-workout-form'),description=$('alternate-workout-description'),cancel=$('cancel-alternate-workout'),status=$('alternate-workout-status');
  document.querySelector('.training-checkins').after(option);
  let date=null,expanded=false,dirty=false;
  function paint(){
    const key=getDate(),day=getStore().loadDay(key),alternate=day.trainingMode==='alternate';
    if(date!==key){date=key;expanded=false;dirty=false;status.textContent='';}
    option.hidden=!['rest','unplanned-rest','rest-unclassified','alternate'].includes(day.trainingMode);
    if(option.hidden){expanded=false;dirty=false;status.textContent='';}
    if(!dirty)description.value=day.alternateWorkout||'';
    form.hidden=!expanded;open.hidden=alternate||expanded;open.setAttribute('aria-expanded',String(!form.hidden));
    $('alternate-workout-saved').hidden=!alternate||expanded;$('alternate-workout-summary').textContent=day.alternateWorkout||'';
    cancel.textContent=alternate?'No workout today':'Cancel';
    $('alternate-workout-help').textContent=`5 points${day.configuration?.training.creatine===false?'':' + your creatine point'}. Keeps your flex rest credit.`;
    for(const control of form.elements)control.disabled=isArchived();for(const button of [open,$('edit-alternate-workout'),$('no-workout-today')])button.disabled=isArchived();
  }
  open.onclick=()=>{expanded=true;status.textContent='';paint();description.focus();};
  $('edit-alternate-workout').onclick=open.onclick;
  description.oninput=()=>{dirty=true;description.setCustomValidity('');status.textContent='';};
  cancel.onclick=()=>{
    if(getStore().loadDay(getDate()).trainingMode==='alternate')getStore().setTrainingMode(getDate(),'rest');
    expanded=false;dirty=false;status.textContent='';render();open.focus();
  };
  $('no-workout-today').onclick=cancel.onclick;
  form.onsubmit=event=>{
    event.preventDefault();
    try{getStore().setAlternateWorkout(getDate(),description.value);dirty=false;expanded=false;render();status.textContent='Workout saved · no flex credit used.';$('edit-alternate-workout').focus({preventScroll:true});announce('Alternate workout saved.');}
    catch(error){status.textContent=error.message;description.focus();}
  };
  return {paint};
}
