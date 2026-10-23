import {addDays} from './model.mjs';
import {REACTIONS} from './social-model.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const planetEmoji=(id,label='')=>`<img class="planet-emoji" src="./assets/reactions/${id}.png" alt="${esc(label)}" width="48" height="48" loading="lazy">`;

export function mountSolarSystems({getClient,getUser,getProfile,getFriends,today,changed,action,message,scoreCircle}) {
  const $=s=>document.querySelector(s),replace=(id,html)=>{if($(id).innerHTML!==html)$(id).innerHTML=html;};
  let state={groups:[],requests:[],invitations:[],primaryId:null},members=[],results=[],stop=null,boardStop=null,dayStop=null,primary=null,dayTarget=null,dayDate=null,dayState={day:null,reactions:[]},loading=true,run=0;
  $('.leaderboard .panel-heading h2').id='solar-title';
  $('.leaderboard .panel-heading').insertAdjacentHTML('afterend','<div id="solar-choices" class="solar-choices" role="group" aria-label="Primary Solar System"></div>');
  $('.leaderboard').insertAdjacentHTML('beforeend',`<div id="solar-connected" hidden><details id="solar-manage" class="solar-manage"><summary>Solar Systems</summary><p class="hint">Create a group or request to join one. Members share day scores and reactions; personal logs stay private.</p><div class="solar-forms"><form id="solar-create"><label for="solar-name">Create a Solar System</label><div><input id="solar-name" minlength="3" maxlength="40" required placeholder="Name your Solar System"><button type="submit" class="quiet-button">Create</button></div></form><form id="solar-search"><label for="solar-query">Find a Solar System</label><div><input id="solar-query" minlength="2" maxlength="40" type="search" required placeholder="Search by name"><button type="submit" class="quiet-button">Search</button></div></form></div><ul id="solar-results" class="friend-results"></ul><section id="solar-pending"><h3>Requests & invitations</h3><ul id="solar-requests" class="friend-results"></ul></section><section id="solar-owner"><h3>Invite friends</h3><ul id="solar-invites" class="friend-results"></ul></section><section id="solar-members"><h3>Members</h3><ul id="solar-member-list" class="friend-results"></ul></section><button id="leave-solar" class="text-button" type="button">Leave this Solar System…</button></details></div>`);
  const confirm=document.createElement('dialog');confirm.id='solar-remove-dialog';confirm.setAttribute('aria-labelledby','solar-remove-title');confirm.innerHTML='<div class="dialog-heading"><h2 id="solar-remove-title">Leave Solar System?</h2></div><p id="solar-remove-copy"></p><div class="composer-actions"><button type="button" class="quiet-button" data-solar-cancel>Cancel</button><button type="button" class="primary-button" data-solar-confirm>Confirm</button></div>';document.body.append(confirm);
  let removeTarget=null;
  confirm.querySelector('[data-solar-cancel]').onclick=()=>confirm.close();
  confirm.querySelector('[data-solar-confirm]').onclick=()=>{const target=removeTarget;confirm.close();if(target)action(()=>api().remove(target.group,target.uid));};
  const dayDialog=document.createElement('dialog');dayDialog.id='solar-day-dialog';dayDialog.setAttribute('aria-labelledby','solar-day-title');dayDialog.innerHTML=`<div class="dialog-heading"><div><p class="eyebrow" id="solar-day-user"></p><h2 id="solar-day-title">Day score</h2></div><button class="icon-button" type="button" data-day-close aria-label="Close day reactions">×</button></div><div class="solar-day-navigation"><button type="button" class="icon-button" id="solar-day-prev" aria-label="Previous day">‹</button><span id="solar-day-date"></span><button type="button" class="icon-button" id="solar-day-next" aria-label="Next day">›</button></div><div id="solar-day-score"></div><p id="solar-day-state" class="hint" role="status"></p><div id="solar-reaction-counts" class="solar-reaction-counts"></div><section id="solar-reaction-picker"><h3>Send a little planet</h3><div class="solar-reaction-picker">${REACTIONS.map(reaction=>`<button type="button" data-react="${reaction.id}" aria-label="${reaction.label}" aria-pressed="false">${planetEmoji(reaction.id)}<small>${esc(reaction.short||reaction.label)}</small></button>`).join('')}</div><p class="hint">Tap your reaction again to remove it.</p></section><p id="solar-reaction-feedback" role="status"></p>`;document.body.append(dayDialog);
  dayDialog.querySelector('[data-day-close]').onclick=()=>dayDialog.close();dayDialog.addEventListener('close',()=>{dayStop?.();dayStop=null;dayTarget=null;});
  const api=()=>getClient()?.groups;
  const selected=()=>state.groups.find(group=>group.id===primary);
  function watchPrimary(){
    const next=state.groups.find(group=>group.id===state.primaryId)?.id||state.groups[0]?.id||null;
    if(next===primary)return;
    primary=next;boardStop?.();boardStop=null;members=[];loading=!!next;
    if(dayDialog.open)dayDialog.close();
    if(next){const active=run;boardStop=api().watchBoard(next,rows=>{if(active!==run||primary!==next)return;members=rows;loading=false;changed();},error=>{if(active===run){loading=false;message('Solar System could not connect. '+error.message);changed();}});}
  }
  function reset(){run++;stop?.();boardStop?.();dayStop?.();stop=boardStop=dayStop=null;state={groups:[],requests:[],invitations:[],primaryId:null};members=[];results=[];primary=null;dayTarget=null;loading=true;if(dayDialog.open)dayDialog.close();if(confirm.open)confirm.close();}
  function connect(){reset();if(!api())return;const active=run;stop=api().watch(value=>{if(active!==run)return;state=value;watchPrimary();changed();},error=>{if(active===run)message('Solar Systems could not connect. '+error.message);});}
  $('#solar-create').onsubmit=event=>{event.preventDefault();action(async()=>{await api().create($('#solar-name').value);$('#solar-name').value='';});};
  $('#solar-search').onsubmit=event=>{event.preventDefault();action(async()=>{results=await api().search($('#solar-query').value);replace('#solar-results',results.length?'':'<li>No Solar Systems found.</li>');});};
  $('#solar-choices').onclick=event=>{const button=event.target.closest('[data-primary-solar]');if(button)action(()=>api().primary(button.dataset.primarySolar));};
  $('#solar-results').onclick=event=>{const button=event.target.closest('[data-join-solar]');if(button)action(()=>api().request(button.dataset.joinSolar));};
  $('#solar-requests').onclick=event=>{const accept=event.target.closest('[data-accept-solar]'),dismiss=event.target.closest('[data-dismiss-solar]');if(accept)action(()=>api().accept(accept.dataset.acceptSolar));if(dismiss)action(()=>api().dismiss(dismiss.dataset.dismissSolar));};
  $('#solar-invites').onclick=event=>{const button=event.target.closest('[data-invite-solar]');if(button)action(()=>api().invite(primary,button.dataset.inviteSolar));};
  function askRemove(uid){removeTarget={uid,group:primary};const own=uid===getUser().uid;$('#solar-remove-title').textContent=own?'Leave Solar System?':'Remove member?';$('#solar-remove-copy').textContent=own?'You will leave this leaderboard. You can request to join again.':`Remove @${members.find(member=>member.uid===uid)?.username||'this user'} from ${selected()?.groupName||'this Solar System'}? Their private records are preserved.`;confirm.showModal();}
  $('#leave-solar').onclick=()=>askRemove(getUser().uid);
  $('#solar-member-list').onclick=event=>{const button=event.target.closest('[data-remove-member]');if(button)askRemove(button.dataset.removeMember);};
  function paint(){
    const profile=getProfile(),user=getUser(),group=selected(),owner=!!group&&group.owner===user?.uid;
    $('#solar-connected').hidden=!profile;$('#solar-title').textContent=group?.groupName||'Your Solar System';
    replace('#solar-choices',state.groups.map(group=>`<button type="button" class="quiet-button" data-primary-solar="${esc(group.id)}" aria-pressed="${group.id===primary}">${esc(group.groupName)}</button>`).join(''));
    if(!state.groups.length&&profile)$('#solar-manage').open=true;
    if(results.length)replace('#solar-results',results.map(group=>{const joined=state.groups.some(value=>value.id===group.id),pending=state.invitations.some(value=>value.groupId===group.id);return `<li><span><strong>${esc(group.name)}</strong><small>Owner @${esc(group.ownerUsername)}</small></span><button class="quiet-button" data-join-solar="${esc(group.id)}" ${joined||pending?'disabled':''}>${joined?'Joined':pending?'Pending':'Request to join'}</button></li>`;}).join(''));
    const requests=[...state.requests.filter(request=>request.kind==='join'),...state.invitations];
    $('#solar-pending').hidden=!requests.length;
    replace('#solar-requests',requests.map(request=>{const mayAccept=request.kind==='join'?request.owner===user?.uid:request.userId===user?.uid;return `<li><span><strong>${esc(request.groupName)}</strong><small>${request.kind==='invite'?'Invitation':request.owner===user?.uid?'Join request from @'+esc(request.username):'Your join request is pending'}</small></span>${mayAccept?`<button type="button" class="quiet-button" data-accept-solar="${esc(request.id)}">${request.kind==='invite'?'Join':'Approve'}</button>`:''}<button type="button" class="text-button" data-dismiss-solar="${esc(request.id)}">${mayAccept?'Decline':'Cancel'}</button></li>`;}).join(''));
    $('#solar-owner').hidden=!owner;
    replace('#solar-invites',owner?getFriends().filter(friend=>!members.some(member=>member.uid===friend.uid)).map(friend=>{const pending=state.requests.some(request=>request.groupId===primary&&request.userId===friend.uid);return `<li><strong>@${esc(friend.username)}</strong><button type="button" class="quiet-button" data-invite-solar="${esc(friend.uid)}" ${pending?'disabled':''}>${pending?'Pending':'Invite'}</button></li>`;}).join('')||'<li>Your friends are already here, or add a friend first.</li>':'');
    $('#solar-members').hidden=!group;
    replace('#solar-member-list',members.map(member=>`<li><strong>@${esc(member.username)}</strong>${member.uid===group?.owner?'<small>Owner</small>':owner?`<button type="button" class="text-button" data-remove-member="${esc(member.uid)}">Remove…</button>`:''}</li>`).join(''));
    $('#leave-solar').hidden=!group||owner;
    return {members,primary,loading,ids:state.groups.map(group=>group.id)};
  }
  function paintDay(){
    if(!dayTarget)return;
    const person=members.find(member=>member.uid===dayTarget),own=getUser()?.uid===dayTarget,score=dayState.day?.score??null;
    $('#solar-day-user').textContent='@'+(person?.username||'User');$('#solar-day-title').textContent='Day score';
    $('#solar-day-date').textContent=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(dayDate+'T12:00:00Z'));
    $('#solar-day-score').innerHTML=scoreCircle(score,true);$('#solar-day-score').setAttribute('role','img');$('#solar-day-score').setAttribute('aria-label',score===null?'No shared score':`Day score ${score} out of 10`);$('#solar-day-state').textContent=dayState.day?'Only the score is shared. Personal logs stay private.':'No shared logged score for this date yet.';
    $('#solar-day-prev').disabled=dayDate<=addDays(today(),-34);$('#solar-day-next').disabled=dayDate>=today();
    const mine=dayState.reactions.find(reaction=>reaction.reactor===getUser()?.uid)?.kind;
    $('#solar-reaction-picker').hidden=own||!dayState.day;
    for(const button of dayDialog.querySelectorAll('[data-react]'))button.setAttribute('aria-pressed',String(button.dataset.react===mine));
    replace('#solar-reaction-counts',REACTIONS.map(reaction=>{const people=dayState.reactions.filter(value=>value.kind===reaction.id);return people.length?`<span class="solar-reaction-chip" aria-label="${reaction.label}: ${esc(people.map(person=>'@'+person.username).join(', '))}">${planetEmoji(reaction.id)}<strong>${people.length}</strong></span>`:'';}).join('')||'<small>No reactions yet.</small>');
  }
  function openDay(target,date){
    if(!primary||!members.some(member=>member.uid===target))return;
    dayStop?.();dayTarget=target;dayDate=date;dayState={day:null,reactions:[]};$('#solar-reaction-feedback').textContent='';paintDay();if(!dayDialog.open)dayDialog.showModal();
    const active=run,system=primary;dayStop=api().watchDay(system,target,date,value=>{if(active!==run||system!==primary||target!==dayTarget||date!==dayDate)return;dayState=value;paintDay();},error=>{$('#solar-day-state').textContent='Could not load this day. '+error.message;});
  }
  $('#solar-day-prev').onclick=()=>openDay(dayTarget,addDays(dayDate,-1));$('#solar-day-next').onclick=()=>openDay(dayTarget,addDays(dayDate,1));
  $('#solar-reaction-picker').onclick=event=>{const button=event.target.closest('[data-react]');if(!button)return;const system=primary,target=dayTarget,date=dayDate,kind=dayState.reactions.find(value=>value.reactor===getUser().uid)?.kind===button.dataset.react?null:button.dataset.react;action(async()=>{await api().react(system,target,date,kind);$('#solar-reaction-feedback').textContent=kind?'Reaction sent':'Reaction removed';});};
  return {connect,reset,paint,openDay};
}
