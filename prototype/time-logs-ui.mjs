import {settingsForDay,timeScore} from './customization.mjs';

export function mountTimeLogs({getStore,getDate,isEditable,render,draw,number,save}) {
  const entries=[];
  for(const [id,label,question] of [['sleep','Sleep','How long did you sleep?'],['prayer','Prayer','Time in prayer']]) {
    document.querySelector('.day-tabs').insertAdjacentHTML('beforeend',`<button role="tab" id="tab-${id}" data-tab="${id}" aria-selected="false" tabindex="-1" aria-controls="${id}-view"><small aria-hidden="true"></small><span class="tab-label">${label}</span><span class="tab-check" aria-hidden="true"></span></button>`);
    document.querySelector('#main').insertAdjacentHTML('beforeend',`<section id="${id}-view" class="detail-view time-log-view" role="tabpanel" aria-labelledby="tab-${id}" hidden><section class="panel time-log-card"><h2>${question}</h2><div class="time-log-body"><div id="${id}-meter" class="nutrition-meter time-score-meter" role="img" aria-label="${label} score"><svg viewBox="0 0 220 210" aria-hidden="true"><path class="meter-track"/><path class="meter-fill" pathLength="100"/></svg><div class="nutrition-score" aria-hidden="true"><span class="meter-number">—</span><span class="meter-out-of">out of 10</span></div></div><div class="time-log-fields"><p id="${id}-goal" class="time-goal"></p><fieldset class="time-duration"><legend>${label==='Sleep'?'Sleep duration':'Prayer duration'}</legend><label>Hours<input id="${id}-hours" type="number" min="0" max="24" step="1" inputmode="numeric" placeholder="—"></label><label>Minutes<input id="${id}-minutes" type="number" min="0" max="59" step="1" inputmode="numeric" placeholder="—"></label></fieldset><p id="${id}-time-error" class="time-error" role="alert"></p><div class="time-log-actions"><button id="save-${id}" class="quiet-button" type="button">Save</button><button id="clear-${id}" class="text-button" type="button">Clear</button><span id="${id}-save-feedback" role="status"></span></div></div></div></section></section>`);
    const $=suffix=>document.getElementById(id+'-'+suffix),hours=$('hours'),minutes=$('minutes'),meter=$('meter');
    let saved='',renderedDate=getDate();
    const signature=()=>`${getDate()}:${getStore().loadDay(getDate())[id]?.minutes??null}`;
    function update(){
      saved='';$('save-feedback').textContent='';
      if(!isEditable())return;
      const empty=hours.value===''&&minutes.value==='',value=empty?null:Number(hours.value||0)*60+Number(minutes.value||0);
      if(!hours.validity.valid||!minutes.validity.valid||value>1440){$('time-error').textContent='Use whole hours and minutes, up to 24 hours.';return;}
      $('time-error').textContent='';getStore().updateTime(getDate(),id,value);render();
    }
    hours.addEventListener('input',update);minutes.addEventListener('input',update);
    document.getElementById('clear-'+id).onclick=()=>{hours.value=minutes.value='';update();};
    document.getElementById('save-'+id).onclick=()=>{if(!isEditable()||$('time-error').textContent)return;const ok=save();if(ok)saved=signature();$('save-feedback').textContent=ok?'Saved on this device':'Could not save';paintEntry();};
    function paintEntry(){
      if(renderedDate!==getDate()){renderedDate=getDate();saved='';$('save-feedback').textContent='';}
      const day=getStore().loadDay(getDate()),value=day[id]?.minutes,goal=settingsForDay(day)[id].goalMinutes,score=timeScore(day,id),editing=document.activeElement===hours||document.activeElement===minutes;
      if(!editing){hours.value=value==null?'':Math.floor(value/60);minutes.value=value==null?'':value%60;$('time-error').textContent='';}
      $('goal').textContent=`Daily goal · ${Math.floor(goal/60)?Math.floor(goal/60)+'h ':''}${goal%60?goal%60+'m':''}`;
      draw(meter,score);meter.querySelector('.meter-number').innerHTML=number(score);meter.querySelector('.meter-out-of').textContent=score===null?'not logged yet':'out of 10';meter.setAttribute('aria-label',`${label}: ${score===null?'not logged':score+' out of 10'}`);
      for(const input of [hours,minutes])input.disabled=!isEditable();
      document.getElementById('save-'+id).disabled=!isEditable()||!!$('time-error').textContent;
      document.getElementById('save-'+id).textContent=saved===signature()?'✓ Saved':'Save';
      document.getElementById('clear-'+id).disabled=!isEditable()||value==null;
    }
    entries.push(paintEntry);
  }
  return {paint:()=>entries.forEach(paint=>paint())};
}
