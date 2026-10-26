import {addDays} from './model.mjs';
import {REACTIONS,solarAppearance} from './social-model.mjs';
import {lateCheckInWindow} from './day-clock.mjs';
import {REACTION_ASSETS} from './reaction-assets.mjs';
import {watchSolarDateWindow} from './solar-date-window.mjs';
import {mountVibesReactions} from './vibes-reactions-ui.mjs';
import {mountReactionBubble} from './reaction-bubble.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const planetEmoji=(id,label='',size='icon')=>`<img class="planet-emoji" src="${REACTION_ASSETS[id]?.[size]||REACTION_ASSETS.happy.icon}" alt="${esc(label)}" width="${size==='portrait'?320:160}" height="${size==='portrait'?320:160}" loading="eager" decoding="async" fetchpriority="${size==='portrait'?'high':'low'}">`;

export function mountSolarSystems({getClient,getUser,getProfile,getFriends,today,checkInDate=today,changed,action,message,scoreCircle}) {
  const $=s=>document.querySelector(s),replace=(id,html)=>{if($(id).innerHTML!==html)$(id).innerHTML=html;};
  let state={groups:[],requests:[],invitations:[],primaryId:null},members=[],results=[],stop=null,boardStop=null,dayStop=null,primary=null,dayTarget=null,dayDate=null,dayState={day:null,reactions:[]},loading=true,run=0,eveningStop=null,eveningKey='',eveningDays=[],eveningLoading=false,eveningError=false,managementAutoOpened=false,boardReactions=[];
  const hero=$('.leaderboard .panel-heading');hero.classList.add('solar-hero');
  hero.querySelector('h2').id='solar-title';hero.querySelector('div').classList.add('solar-identity');
  $('#solar-title').insertAdjacentHTML('afterend','<p id="solar-subtitle">My Solar System</p>');
  hero.insertAdjacentHTML('beforeend','<div id="solar-member-count" class="solar-member-count" aria-label="Members"><strong>—</strong><span>members</span></div>');
  $('.leaderboard-scroll').before($('#leaderboard-month'));
  hero.insertAdjacentHTML('afterend','<div class="solar-toolbar"><button type="button" class="quiet-button" id="solar-edit-profile">My planet & vibes</button></div>');
  $('#solar-edit-profile').onclick=()=>openProfile();
  $('.leaderboard-scroll').insertAdjacentHTML('afterend','<section id="solar-evening" class="solar-evening" aria-labelledby="solar-evening-title" hidden><div class="solar-evening-heading"><div><p class="eyebrow" id="solar-evening-date"></p><h3 id="solar-evening-title">Tonight’s check-in</h3></div><span id="solar-evening-total" class="count-pill"></span></div><p class="hint">Updates as members sync their day.</p></section>');
  $('.leaderboard .panel-heading').insertAdjacentHTML('afterend','<div id="solar-choices" class="solar-choices" role="group" aria-label="Primary Solar System"></div>');
  $('.leaderboard').insertAdjacentHTML('beforeend',`<div id="solar-connected" hidden><details id="solar-manage" class="solar-manage"><summary>Manage Solar Systems</summary><p class="hint">Create a group or request to join one. Members share day scores and reactions; personal logs stay private.</p><div class="solar-forms"><form id="solar-create"><label for="solar-name">Create a Solar System</label><div><input id="solar-name" minlength="3" maxlength="40" required placeholder="Name your Solar System"><button type="submit" class="quiet-button">Create</button></div></form><form id="solar-search"><label for="solar-query">Find a Solar System</label><div><input id="solar-query" minlength="2" maxlength="40" type="search" required placeholder="Search by name"><button type="submit" class="quiet-button">Search</button></div></form></div><ul id="solar-results" class="friend-results"></ul><section id="solar-pending"><h3>Requests & invitations</h3><ul id="solar-requests" class="friend-results"></ul></section><section id="solar-owner"><h3>Invite friends</h3><ul id="solar-invites" class="friend-results"></ul></section><section id="solar-members"><h3>Members</h3><ul id="solar-member-list" class="friend-results"></ul></section><button id="leave-solar" class="text-button" type="button">Leave this Solar System…</button></details></div>`);
  $('.solar-forms').insertAdjacentHTML('afterbegin','<form id="solar-rename" hidden><label for="solar-rename-name">Rename this Solar System</label><div><input id="solar-rename-name" minlength="3" maxlength="40" required aria-describedby="solar-rename-feedback"><button type="submit" class="quiet-button" id="solar-rename-save">Save name</button></div><p id="solar-rename-feedback" class="hint" role="status" aria-live="polite"></p></form>');
  let renameGroup=null,renameName='',renaming=false;
  $('#solar-rename-name').oninput=()=>{$('#solar-rename-feedback').textContent='';};
  $('#solar-rename').onsubmit=async event=>{event.preventDefault();const group=selected();if(renaming||!group||group.owner!==getUser()?.uid)return;const active=run,id=group.id,button=$('#solar-rename-save'),input=$('#solar-rename-name');renaming=true;button.disabled=input.disabled=true;button.textContent='Saving…';$('#solar-rename-feedback').textContent='';try{const name=await api().rename(id,input.value);if(active!==run||primary!==id)return;input.value=name;$('#solar-rename-feedback').textContent='Solar System name saved.';}catch(error){if(active===run&&primary===id)$('#solar-rename-feedback').textContent=error.message;}finally{if(active===run){renaming=false;button.disabled=input.disabled=false;button.textContent='Save name';}}};
  const confirm=document.createElement('dialog');confirm.id='solar-remove-dialog';confirm.setAttribute('aria-labelledby','solar-remove-title');confirm.innerHTML='<div class="dialog-heading"><h2 id="solar-remove-title">Leave Solar System?</h2></div><p id="solar-remove-copy"></p><div class="composer-actions"><button type="button" class="quiet-button" data-solar-cancel>Cancel</button><button type="button" class="primary-button" data-solar-confirm>Confirm</button></div>';document.body.append(confirm);
  let removeTarget=null;
  confirm.querySelector('[data-solar-cancel]').onclick=()=>confirm.close();
  confirm.querySelector('[data-solar-confirm]').onclick=()=>{const target=removeTarget;confirm.close();if(target)action(()=>target.deleteSystem?api().deleteSystem(target.group):api().remove(target.group,target.uid));};
  const dayDialog=document.createElement('dialog');dayDialog.id='solar-day-dialog';dayDialog.setAttribute('aria-labelledby','solar-day-title');dayDialog.innerHTML=`<div class="dialog-heading"><div><p class="eyebrow" id="solar-day-user"></p><h2 id="solar-day-title">Day score</h2></div><button class="icon-button" type="button" data-day-close aria-label="Close day reactions">×</button></div><div class="solar-day-navigation"><button type="button" class="icon-button" id="solar-day-prev" aria-label="Previous day">‹</button><span id="solar-day-date"></span><button type="button" class="icon-button" id="solar-day-next" aria-label="Next day">›</button></div><div id="solar-day-score"></div><p id="solar-day-state" class="hint" role="status"></p><div id="solar-reaction-counts" class="solar-reaction-counts"></div><section id="solar-reaction-picker"><h3>Send a little planet</h3><div class="solar-reaction-picker">${REACTIONS.map(reaction=>`<button type="button" data-react="${reaction.id}" aria-label="${reaction.label}" aria-pressed="false">${planetEmoji(reaction.id)}</button>`).join('')}</div><p class="hint">Tap your reaction again to remove it.</p></section><p id="solar-reaction-feedback" role="status"></p>`;document.body.append(dayDialog);
  dayDialog.querySelector('[data-day-close]').onclick=()=>dayDialog.close();dayDialog.addEventListener('close',()=>{const target=dayTarget,date=dayDate;dayStop?.();dayStop=null;dayTarget=null;requestAnimationFrame(()=>[...document.querySelectorAll('[data-solar-day]')].find(button=>button.dataset.solarDay===target&&button.dataset.solarDate===date)?.focus({preventScroll:true}));});
  const profileDialog=document.createElement('dialog');profileDialog.id='solar-profile-dialog';profileDialog.setAttribute('aria-labelledby','solar-profile-title');
  profileDialog.innerHTML=`<div class="dialog-heading"><h2 id="solar-profile-title">My planet & vibes</h2><button class="icon-button" type="button" data-profile-close aria-label="Close planet profile">×</button></div><form id="solar-profile-form"><label for="solar-vibes-input">Current vibes</label><textarea id="solar-vibes-input" rows="2" maxlength="160" placeholder="A little update from your orbit…"></textarea><fieldset><legend>Your planet</legend><div class="solar-avatar-picker" role="radiogroup" aria-label="Planet profile picture">${REACTIONS.map(reaction=>`<button type="button" role="radio" data-profile-planet="${reaction.id}" aria-checked="false" aria-label="${esc(reaction.label)}">${planetEmoji(reaction.id)}</button>`).join('')}</div></fieldset><p id="solar-profile-error" role="alert"></p><button type="submit" class="primary-button" id="solar-profile-save">Save planet & vibes</button></form>`;
  document.body.append(profileDialog);let chosenPlanet='happy';
  profileDialog.addEventListener('close',()=>requestAnimationFrame(()=>document.querySelector('[data-edit-solar-profile]')?.focus({preventScroll:true})));
  profileDialog.querySelector('[data-profile-close]').onclick=()=>profileDialog.close();
  function paintPlanetChoice(){for(const button of profileDialog.querySelectorAll('[data-profile-planet]')){const selected=button.dataset.profilePlanet===chosenPlanet;button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;}}
  function openProfile(){if(!getProfile()||!state.appearanceReady)return;const appearance=solarAppearance(state.appearance);chosenPlanet=appearance.planet;$('#solar-vibes-input').value=appearance.vibes;$('#solar-profile-error').textContent='';paintPlanetChoice();if(!profileDialog.open)profileDialog.showModal();}
  $('.solar-avatar-picker').onclick=event=>{const button=event.target.closest('[data-profile-planet]');if(button){chosenPlanet=button.dataset.profilePlanet;paintPlanetChoice();}};
  $('.solar-avatar-picker').onkeydown=event=>{const offset={ArrowRight:1,ArrowDown:8,ArrowLeft:-1,ArrowUp:-8}[event.key];if(!offset)return;event.preventDefault();chosenPlanet=REACTIONS[(REACTIONS.findIndex(reaction=>reaction.id===chosenPlanet)+offset+REACTIONS.length)%REACTIONS.length].id;paintPlanetChoice();profileDialog.querySelector(`[data-profile-planet="${chosenPlanet}"]`).focus();};
  $('#solar-profile-form').onsubmit=async event=>{event.preventDefault();const button=$('#solar-profile-save'),active=run;button.disabled=true;button.textContent='Saving…';$('#solar-profile-error').textContent='';try{await api().saveAppearance(solarAppearance({planet:chosenPlanet,vibes:$('#solar-vibes-input').value}));if(active!==run)return;profileDialog.close();message('Planet profile saved.');changed();}catch(error){if(active===run)$('#solar-profile-error').textContent=error.message;}finally{button.disabled=false;button.textContent='Save planet & vibes';}};
  const api=()=>getClient()?.groups;
  const reactionBubble=mountReactionBubble({planetEmoji});
  const vibesUI=mountVibesReactions({getApi:api,getUser,getPerson:uid=>{const person=members.find(row=>row.uid===uid);return person&&uid===getUser()?.uid?{...person,...state.appearance}:person;},changed,bubble:reactionBubble});
  let quickStop=null,quickRun=0;
  let ratingStop=null,ratingKey='',yesterdayDays=[],yesterdayReady=false;
  function stopRatingWindow(){ratingStop?.();ratingStop=null;ratingKey='';yesterdayDays=[];yesterdayReady=false;ratingDays=new Map();ratingReactions=new Map();boardReactions=[];}
  let ratingDays=new Map(),ratingReactions=new Map();
  function watchRatingDays(){
    const date=today(),key=primary?primary+'~'+date:'';
    if(key===ratingKey)return;
    stopRatingWindow();
    if(!key)return;ratingKey=key;const active=run;
    ratingStop=watchSolarDateWindow(api(),primary,date,{
      days(day,rows){if(active!==run||ratingKey!==key)return;ratingDays.set(day,rows);if(day===addDays(date,-1)){yesterdayDays=rows;yesterdayReady=true;}changed();},
      reactions(day,rows){if(active!==run||ratingKey!==key)return;ratingReactions.set(day,rows);boardReactions=[...ratingReactions.values()].flat();changed();},
      error(issue){if(active!==run||ratingKey!==key)return;message('Shared day scores or reactions could not connect. '+issue.message);}
    });
  }
  const selected=()=>state.groups.find(group=>group.id===primary);
  function watchPrimary(){
    const next=state.groups.find(group=>group.id===state.primaryId)?.id||state.groups[0]?.id||null;
    if(next===primary)return;
    primary=next;boardStop?.();boardStop=null;members=[];loading=!!next;stopEvening();stopRatingWindow();
    if(dayDialog.open)dayDialog.close();
    if(next){const active=run;boardStop=api().watchBoard(next,rows=>{if(active!==run||primary!==next)return;members=rows;loading=false;changed();},error=>{if(active===run){loading=false;message('Solar System could not connect. '+error.message);changed();}});}
  }
  function stopEvening(){eveningStop?.();eveningStop=null;eveningKey='';eveningDays=[];eveningLoading=false;eveningError=false;}
  function reset(){reactionBubble.close();vibesUI.reset();stopEvening();stopRatingWindow();managementAutoOpened=false;run++;renameGroup=null;renameName='';renaming=false;$('#solar-rename-name').value='';$('#solar-rename-name').disabled=false;$('#solar-rename-save').disabled=false;$('#solar-rename-save').textContent='Save name';$('#solar-rename-feedback').textContent='';stop?.();boardStop?.();dayStop?.();stop=boardStop=dayStop=null;state={groups:[],requests:[],invitations:[],primaryId:null};members=[];results=[];primary=null;dayTarget=null;loading=true;if(dayDialog.open)dayDialog.close();if(confirm.open)confirm.close();if(profileDialog.open)profileDialog.close();}
  function connect(){reset();if(!api())return;const active=run;stop=api().watch(value=>{if(active!==run)return;state=value;watchPrimary();changed();},error=>{if(active===run)message('Solar Systems could not connect. '+error.message);});}
  $('#solar-create').onsubmit=event=>{event.preventDefault();action(async()=>{await api().create($('#solar-name').value);$('#solar-name').value='';});};
  $('#solar-search').onsubmit=event=>{event.preventDefault();action(async()=>{results=await api().search($('#solar-query').value);replace('#solar-results',results.length?'':'<li>No Solar Systems found.</li>');});};
  $('#solar-choices').onclick=event=>{const button=event.target.closest('[data-primary-solar]');if(button)action(()=>api().primary(button.dataset.primarySolar));};
  $('#solar-results').onclick=event=>{const button=event.target.closest('[data-join-solar]');if(button)action(()=>api().request(button.dataset.joinSolar));};
  $('#solar-requests').onclick=event=>{const accept=event.target.closest('[data-accept-solar]'),dismiss=event.target.closest('[data-dismiss-solar]');if(accept)action(()=>api().accept(accept.dataset.acceptSolar));if(dismiss)action(()=>api().dismiss(dismiss.dataset.dismissSolar));};
  $('#solar-invites').onclick=event=>{const button=event.target.closest('[data-invite-solar]');if(button)action(()=>api().invite(primary,button.dataset.inviteSolar));};
  function askRemove(uid){confirm.querySelector('[data-solar-confirm]').textContent='Confirm';removeTarget={uid,group:primary};const own=uid===getUser().uid;$('#solar-remove-title').textContent=own?'Leave Solar System?':'Remove member?';$('#solar-remove-copy').textContent=own?'You will leave this leaderboard. You can request to join again.':`Remove @${members.find(member=>member.uid===uid)?.username||'this user'} from ${selected()?.groupName||'this Solar System'}? Their private records are preserved.`;confirm.showModal();}
  $('#leave-solar').onclick=()=>askRemove(getUser().uid);
  $('#leave-solar').after(Object.assign(document.createElement('button'),{id:'delete-solar',type:'button',className:'text-button',textContent:'Delete this Solar System…',hidden:true}));
  $('#delete-solar').onclick=()=>{removeTarget={group:primary,deleteSystem:true};$('#solar-remove-title').textContent='Delete Solar System?';$('#solar-remove-copy').textContent=`Remove ${selected()?.groupName||'this Solar System'} for every member? Your friendships and everyone’s private logs stay saved. You can create another system afterward.`;confirm.querySelector('[data-solar-confirm]').textContent='Delete Solar System';confirm.showModal();};
  $('#solar-member-list').onclick=event=>{const button=event.target.closest('[data-remove-member]');if(button)askRemove(button.dataset.removeMember);};
  function paintEvening(ownLogged){
    const date=checkInDate(),key=primary&&lateCheckInWindow()?primary+'~'+date:'';
    $('#solar-evening').hidden=!key;
    if(!key){if(eveningKey)stopEvening();return;}
    if(key!==eveningKey){
      stopEvening();eveningKey=key;eveningLoading=true;const active=run;
      eveningStop=api().watchToday(primary,date,days=>{if(active!==run||eveningKey!==key)return;eveningDays=days;eveningLoading=false;eveningError=false;changed();},()=>{if(active!==run||eveningKey!==key)return;eveningLoading=false;eveningError=true;changed();});
    }
    const logged=new Set(eveningDays.filter(day=>day.date===date).map(day=>day.uid));
    // Your own local check-in is visible immediately while its cloud save finishes.
    if(ownLogged!==undefined){if(ownLogged)logged.add(getUser()?.uid);else logged.delete(getUser()?.uid);}
    const ready=!eveningLoading&&!eveningError,loggedCount=members.filter(member=>logged.has(member.uid)).length;
    $('#solar-evening-date').textContent=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
    $('#solar-evening-total').textContent=ready?`${loggedCount}/${members.length} logged`:eveningError?'Status unavailable':'Checking…';

  }
  function paint({ownLogged}={}){
    const profile=getProfile(),user=getUser(),group=selected(),owner=!!group&&group.owner===user?.uid;
    $('#solar-connected').hidden=!profile;$('#solar-title').textContent=group?.groupName||'Your Solar System';
    $('#solar-subtitle').hidden=!group;$('#solar-member-count').hidden=!group;
    $('#solar-member-count strong').textContent=loading?'—':members.length;$('#solar-member-count span').textContent=members.length===1?'member':'members';
    watchRatingDays();vibesUI.sync(primary);vibesUI.paint();paintEvening(ownLogged);
    const ownsSystem=!!state.ownedGroupId||state.groups.some(value=>value.owner===user?.uid);
    $('#solar-create').hidden=ownsSystem;
    $('#solar-rename').hidden=!owner;
    const renameInput=$('#solar-rename-name');
    if(renameGroup!==primary){renameGroup=primary;renameInput.value=group?.groupName||'';$('#solar-rename-feedback').textContent='';}
    else if(renameInput.value===renameName)renameInput.value=group?.groupName||'';
    renameName=group?.groupName||'';
    $('#solar-search').hidden=state.groups.length>0;
    $('#solar-results').hidden=state.groups.length>0;
    $('#solar-edit-profile').hidden=!!group&&state.appearanceReady;$('.solar-toolbar').hidden=!profile&&$('#solar-edit-profile').hidden;
    replace('#solar-choices',state.groups.filter(group=>group.id!==primary).map(group=>`<button type="button" class="quiet-button" data-primary-solar="${esc(group.id)}" aria-pressed="${group.id===primary}">${esc(group.groupName)}</button>`).join(''));
    if(state.groupsLoaded&&!state.groups.length&&profile&&!$('#solar-manage').open){$('#solar-manage').open=true;managementAutoOpened=true;}
    if(group&&managementAutoOpened){$('#solar-manage').open=false;managementAutoOpened=false;}
    if(results.length)replace('#solar-results',results.map(group=>{const joined=state.groups.some(value=>value.id===group.id),pending=state.invitations.some(value=>value.groupId===group.id);return `<li><span><strong>${esc(group.name)}</strong><small>Owner @${esc(group.ownerUsername)}</small></span><button class="quiet-button" data-join-solar="${esc(group.id)}" ${joined||pending?'disabled':''}>${joined?'Joined':pending?'Pending':'Request to join'}</button></li>`;}).join(''));
    const requests=[...state.requests.filter(request=>request.kind==='join'),...state.invitations];
    $('#solar-pending').hidden=!requests.length;
    replace('#solar-requests',requests.map(request=>{const mayAccept=request.kind==='join'?request.owner===user?.uid:request.userId===user?.uid;return `<li><span><strong>${esc(request.groupName)}</strong><small>${request.kind==='invite'?'Invitation':request.owner===user?.uid?'Join request from @'+esc(request.username):'Your join request is pending'}</small></span>${mayAccept?`<button type="button" class="quiet-button" data-accept-solar="${esc(request.id)}">${request.kind==='invite'?'Join':'Approve'}</button>`:''}<button type="button" class="text-button" data-dismiss-solar="${esc(request.id)}">${mayAccept?'Decline':'Cancel'}</button></li>`;}).join(''));
    $('#solar-owner').hidden=!owner;
    replace('#solar-invites',owner?getFriends().filter(friend=>!members.some(member=>member.uid===friend.uid)).map(friend=>{const pending=state.requests.some(request=>request.groupId===primary&&request.userId===friend.uid);return `<li><strong>@${esc(friend.username)}</strong><button type="button" class="quiet-button" data-invite-solar="${esc(friend.uid)}" ${pending?'disabled':''}>${pending?'Pending':'Invite'}</button></li>`;}).join('')||'<li>Your friends are already here, or add a friend first.</li>':'');
    $('#solar-members').hidden=!group;
    replace('#solar-member-list',members.map(member=>`<li><strong>@${esc(member.username)}</strong>${member.uid===group?.owner?'<small>Owner</small>':owner?`<button type="button" class="text-button" data-remove-member="${esc(member.uid)}">Remove…</button>`:''}</li>`).join(''));
    $('#leave-solar').hidden=!group||owner;
    $('#delete-solar').hidden=!owner;
    $('#solar-edit-profile').disabled=!profile||!state.appearanceReady;
    const date=today(),yesterday=addDays(date,-1),scores=new Map(yesterdayDays.map(day=>[day.uid,day.score])),current=new Map((ratingDays.get(date)||[]).map(day=>[day.uid,day]));
    const datedMembers=members.map(member=>({...member,yesterdayDate:yesterday,yesterdayScore:yesterdayReady?scores.get(member.uid)??null:member.yesterdayDate===yesterday?member.yesterdayScore??null:null,todayDate:date,todayScore:current.get(member.uid)?.score??null,todayReviewComplete:current.get(member.uid)?.reviewComplete===true}));
    return {members:datedMembers,primary,loading,reactions:boardReactions,vibeReactions:vibesUI.reactions(),owner:group?.owner,appearance:state.appearance,appearanceReady:state.appearanceReady,ownLogged,evening:eveningKey?{loading:eveningLoading,error:eveningError,logged:eveningDays.map(day=>day.uid)}:null,ids:state.groups.map(group=>group.id)};
  }
  function paintDay(){
    if(!dayTarget)return;
    const person=members.find(member=>member.uid===dayTarget),own=getUser()?.uid===dayTarget,score=dayState.day?.score??null;
    $('#solar-day-user').textContent='@'+(person?.username||'User');$('#solar-day-title').textContent='Day score';
    $('#solar-day-date').textContent=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(dayDate+'T12:00:00Z'));
    $('#solar-day-score').innerHTML=scoreCircle(score,true);$('#solar-day-score').setAttribute('role','img');$('#solar-day-score').setAttribute('aria-label',score===null?'No shared score':`Day score ${score} out of 10`);$('#solar-day-state').textContent=dayState.day?'Shared day score. Personal logs stay private.':'No shared logged score for this date yet.';
    $('#solar-day-prev').disabled=dayDate<=addDays(today(),-34);$('#solar-day-next').disabled=dayDate>=today();
    const mine=dayState.reactions.find(reaction=>reaction.reactor===getUser()?.uid)?.kind;
    $('#solar-reaction-picker').hidden=own||!dayState.day;
    for(const button of dayDialog.querySelectorAll('[data-react]'))button.setAttribute('aria-pressed',String(button.dataset.react===mine));
    replace('#solar-reaction-counts',REACTIONS.map(reaction=>{const people=dayState.reactions.filter(value=>value.kind===reaction.id);return people.length?`<span class="solar-reaction-chip" aria-label="${reaction.label}: ${esc(people.map(person=>'@'+person.username).join(', '))}">${planetEmoji(reaction.id)}<span class="reaction-people"><strong>${people.length} ${people.length===1?'reaction':'reactions'}</strong><small>${esc(people.map(person=>'@'+person.username).join(', '))}</small></span></span>`:'';}).join('')||'<small>No reactions yet.</small>');
  }
  function openDay(target,date){
    if(!primary||!members.some(member=>member.uid===target))return;
    dayStop?.();dayTarget=target;dayDate=date;dayState={day:null,reactions:[]};$('#solar-reaction-feedback').textContent='';paintDay();if(!dayDialog.open)dayDialog.showModal();
    const active=run,system=primary;dayStop=api().watchDay(system,target,date,value=>{if(active!==run||system!==primary||target!==dayTarget||date!==dayDate)return;dayState=value;paintDay();},error=>{$('#solar-day-state').textContent='Could not load this day. '+error.message;});
  }
  function openScoreReactions(target,date){
    if(!primary||!members.some(row=>row.uid===target))return;reactionBubble.close();const system=primary,own=target===getUser()?.uid;
    const anchor=()=>[...document.querySelectorAll('[data-solar-day]')].find(button=>button.dataset.solarDay===target&&button.dataset.solarDate===date);
    const active=++quickRun;
    reactionBubble.show({title:'@'+(members.find(row=>row.uid===target)?.username||'Member')+' · Day score',anchor,rows:[],user:getUser()?.uid,own,loading:true,onClose:()=>{quickRun++;quickStop?.();quickStop=null;},onReact:kind=>api().react(system,target,date,kind),onDetails:()=>openDay(target,date)});
    quickStop=api().watchDay(system,target,date,value=>{if(active===quickRun)reactionBubble.update({rows:value.reactions,user:getUser()?.uid,own,loading:false,canReact:!!value.day});},()=>{if(active===quickRun)reactionBubble.update({loading:false,canReact:false,feedback:'Reactions unavailable'});});
  }
  $('#solar-day-prev').onclick=()=>openDay(dayTarget,addDays(dayDate,-1));$('#solar-day-next').onclick=()=>openDay(dayTarget,addDays(dayDate,1));
  $('#solar-reaction-picker').onclick=event=>{const button=event.target.closest('[data-react]');if(!button)return;const system=primary,target=dayTarget,date=dayDate,kind=dayState.reactions.find(value=>value.reactor===getUser().uid)?.kind===button.dataset.react?null:button.dataset.react;action(async()=>{const notified=await api().react(system,target,date,kind);$('#solar-reaction-feedback').textContent=kind?notified===false?'Reaction saved. Notification could not be sent.':'Reaction sent':'Reaction removed';});};
  return {connect,reset,paint,openDay,openScoreReactions,openProfile,openVibes:vibesUI.open,groupIds:()=>state.groups.map(group=>group.id),appearance:()=>solarAppearance(state.appearance),appearanceReady:()=>!!state.appearanceReady};
}
