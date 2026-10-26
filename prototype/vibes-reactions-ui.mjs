import {REACTIONS,vibesReactions} from './social-model.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountVibesReactions({getApi,getUser,getPerson,changed,action,planetEmoji}){
  const dialog=document.createElement('dialog');dialog.id='solar-vibes-dialog';dialog.setAttribute('aria-labelledby','solar-vibes-title');
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="solar-vibes-title">Current vibes</h2><button type="button" class="icon-button" aria-label="Close vibes reactions">×</button></div><p id="solar-vibes-person" class="eyebrow"></p><blockquote id="solar-vibes-text"></blockquote><div id="solar-vibes-counts" class="solar-reaction-counts"></div><section id="solar-vibes-picker"><h3>Send a little planet</h3><div class="solar-reaction-picker">${REACTIONS.map(reaction=>`<button type="button" data-vibes-react="${reaction.id}" aria-label="${esc(reaction.label)}" aria-pressed="false">${planetEmoji(reaction.id)}</button>`).join('')}</div><p class="hint">Tap your reaction again to remove it.</p></section><p id="solar-vibes-feedback" role="status"></p>`;
  document.body.append(dialog);
  const $=id=>dialog.querySelector('#'+id);let group=null,target=null,rows=[],stop=null,serial=0,loading=true,failed=false;
  dialog.querySelector('.dialog-heading button').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{const previous=target;target=null;requestAnimationFrame(()=>[...document.querySelectorAll('[data-solar-vibes]')].find(button=>button.dataset.solarVibes===previous)?.focus({preventScroll:true}));});
  function paint(){
    if(!target)return;const person=getPerson(target),own=target===getUser()?.uid,version=person?.vibesVersion||'legacy',current=vibesReactions(rows,target,version),mine=current.find(row=>row.reactor===getUser()?.uid)?.kind;
    $('solar-vibes-person').textContent='@'+(person?.username||'Member');$('solar-vibes-text').textContent=person?.vibes||'No vibes shared yet.';
    $('solar-vibes-picker').hidden=own||!person?.vibes?.trim()||failed||loading;
    for(const button of dialog.querySelectorAll('[data-vibes-react]'))button.setAttribute('aria-pressed',String(button.dataset.vibesReact===mine));
    $('solar-vibes-counts').innerHTML=loading?'<small>Loading reactions…</small>':failed?'<small>Could not load reactions. Reconnect and try again.</small>':REACTIONS.map(reaction=>{const people=current.filter(row=>row.kind===reaction.id);return people.length?`<span class="solar-reaction-chip">${planetEmoji(reaction.id,reaction.label)}<span class="reaction-people"><strong>${people.length} ${people.length===1?'reaction':'reactions'}</strong><small>${esc(people.map(row=>'@'+row.username).join(', '))}</small></span></span>`:'';}).join('')||'<small>No reactions yet.</small>';
  }
  function sync(next){
    if(group===next)return;stop?.();stop=null;group=next;rows=[];loading=true;failed=false;const active=++serial;if(dialog.open)dialog.close();
    if(next)stop=getApi().watchVibesReactions(next,value=>{if(active!==serial)return;rows=value;loading=false;failed=false;paint();changed();},()=>{if(active!==serial)return;loading=false;failed=true;paint();changed();});
  }
  function open(uid){if(!group||!getPerson(uid)?.vibes?.trim())return;target=uid;$('solar-vibes-feedback').textContent='';paint();if(!dialog.open)dialog.showModal();}
  $('solar-vibes-picker').onclick=event=>{
    const button=event.target.closest('[data-vibes-react]'),person=getPerson(target);if(!button||!person||loading||failed)return;
    const uid=target,version=person.vibesVersion||'legacy',system=group,current=vibesReactions(rows,uid,version),kind=current.find(row=>row.reactor===getUser()?.uid)?.kind===button.dataset.vibesReact?null:button.dataset.vibesReact;
    action(async()=>{const notified=await getApi().reactVibes(system,uid,version,kind);if(group===system&&target===uid)$('solar-vibes-feedback').textContent=kind?notified===false?'Reaction saved. Notification could not be sent.':'Reaction sent':'Reaction removed';});
  };
  return {sync,paint,open,reactions:()=>rows,reset:()=>sync(null)};
}
