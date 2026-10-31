import {solarAppearance} from './social-model.mjs';
import {localDateKey} from './day-clock.mjs';
import {addDays} from './model.mjs';
import {fitShortUsernames} from './username-layout.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mountUserProfiles({getClient,getUser,getFriends,getOutgoing,getIncoming,planetEmoji,scoreCircle,ownSummary,ownAppearance,getKnownProfile=()=>null}){
  const dialog=document.createElement('dialog');
  dialog.id='user-profile-dialog';dialog.setAttribute('aria-labelledby','user-profile-title');
  dialog.innerHTML='<div class="dialog-heading"><div><p class="eyebrow">POCKET PLANET</p><h2 id="user-profile-title">Planet profile</h2></div><button type="button" class="icon-button" aria-label="Close profile" data-close-profile>×</button></div><div id="user-profile-content" aria-live="polite"></div>';
  document.body.append(dialog);
  const nameObserver=new ResizeObserver(()=>requestAnimationFrame(()=>fitShortUsernames(dialog)));nameObserver.observe(dialog);
  document.fonts.ready.then(()=>fitShortUsernames(dialog));document.fonts.addEventListener('loadingdone',()=>fitShortUsernames(dialog));
  const content=dialog.querySelector('#user-profile-content');let serial=0,target=null,targetName='';
  const relationships=new Map(),cache=new Map(),pending=new Map();
  const removeDialog=document.createElement('dialog');removeDialog.id='profile-remove-friend-dialog';removeDialog.setAttribute('aria-labelledby','profile-remove-title');
  removeDialog.innerHTML='<div class="dialog-heading"><h2 id="profile-remove-title">Are you sure?</h2></div><p id="profile-remove-description"></p><p id="profile-remove-error" role="alert"></p><div class="composer-actions"><button type="button" class="quiet-button" data-profile-keep>Keep friend</button><button type="button" class="primary-button" data-profile-confirm-remove>Remove friend</button></div>';
  document.body.append(removeDialog);let removal=null;
  removeDialog.querySelector('[data-profile-keep]').onclick=()=>removeDialog.close();
  removeDialog.querySelector('[data-profile-confirm-remove]').onclick=async()=>{
    if(!removal)return;const pending=removal,button=removeDialog.querySelector('[data-profile-confirm-remove]');button.disabled=true;button.textContent='Removing…';
    try{
      await getClient().remove(pending.uid);
      if(pending.run!==serial||pending.account!==getUser()?.uid)return;
      relationships.set(pending.uid,{friend:false,sent:null});removeDialog.close();await open(pending.uid);
    }catch(error){if(pending.run===serial)removeDialog.querySelector('#profile-remove-error').textContent=error.message;}
    finally{button.disabled=false;button.textContent='Remove friend';}
  };
  dialog.querySelector('[data-close-profile]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{serial++;target=null;removal=null;if(removeDialog.open)removeDialog.close();});
  function requestButton(uid){
    if(uid===getUser()?.uid)return '<span class="profile-relationship">My profile</span>';
    const override=relationships.get(uid);
    const friend=override?.friend??getFriends().some(row=>row.uid===uid),sent=override&&Object.hasOwn(override,'sent')?override.sent:getOutgoing().find(row=>row.recipient===uid),incoming=getIncoming().some(row=>row.requester===uid);
    if(friend)return '<span class="profile-relationship is-friend">✓ Friends</span><button type="button" class="quiet-button profile-remove-request" data-profile-remove>Remove friend</button>';
    if(sent)return `<span class="profile-relationship">Request sent</span><button type="button" class="quiet-button profile-cancel-request" data-profile-cancel="${esc(sent.id)}">Cancel request</button>`;
    if(incoming)return '<span class="profile-relationship">Request received</span>';
    return `<button type="button" class="primary-button" data-profile-request="${esc(uid)}">Request friend <span aria-hidden="true">＋</span></button>`;
  }
  async function open(uid){
    const client=getClient();if(!client)return;
    const run=++serial,account=getUser()?.uid;target=uid;
    const cached=cache.get(uid),known=getKnownProfile(uid);
    const immediate=cached?{...cached,...known,friends:cached.friends}:known;
    if(immediate)renderProfile(uid,immediate,account);else content.textContent='Loading profile...';
    if(!dialog.open)dialog.showModal();
    try{
      let request=pending.get(uid);
      if(!request){request=client.viewProfile(uid);pending.set(uid,request);request.finally(()=>{if(pending.get(uid)===request)pending.delete(uid);}).catch(()=>{});}
      const person=await request;
      if(run!==serial||account!==getUser()?.uid)return;
      if(!person)throw new Error('This profile is no longer available.');
      cache.set(uid,person);renderProfile(uid,person,account);
      relationships.delete(uid);
    }catch(error){if(run===serial){if(!immediate)content.textContent=error.message;else{const message=document.createElement('p');message.className='hint';message.textContent='Showing previously loaded details. Could not refresh this profile.';content.append(message);}}}
  }
  function renderProfile(uid,person,account){
      targetName=person.username;
      const row=uid===account?{...person,...ownSummary(),...ownAppearance()}:person;
      const appearance=solarAppearance({planet:row.planet||'happy',vibes:row.vibes||''});
      const today=localDateKey(),currentMonth=today.slice(0,7);
      const monthly=row.month===currentMonth?row.monthScore??null:null;
      const monthName=new Intl.DateTimeFormat('en-US',{month:'long',timeZone:'UTC'}).format(new Date(today+'T12:00:00Z'));
      const streak=Number.isInteger(row.consecutiveStreak)?([today,addDays(today,-1)].includes(row.streakEndDate)?row.consecutiveStreak:0):null;
      content.innerHTML=`<article class="public-profile-card">
        <header class="public-profile-hero">
          <div class="public-profile-planet">${row.planet?planetEmoji(appearance.planet,'@'+row.username+' planet','portrait'):'<span class="profile-unknown-planet" aria-label="Profile picture not shared yet">?</span>'}</div>
          <div class="public-profile-identity"><p class="eyebrow">${uid===account?'YOUR LITTLE CORNER OF THE UNIVERSE':'A LITTLE PLANET IN YOUR ORBIT'}</p><h3 class="profile-username">@${esc(row.username)}</h3></div>
          <div class="profile-actions">${requestButton(uid)}</div>
        </header>
        <section class="public-profile-system" aria-label="Solar System"><span class="profile-orbit-symbol" aria-hidden="true">◎</span><div><h4 class="eyebrow">${row.solarSystems?.length>1?'SOLAR SYSTEMS':'SOLAR SYSTEM'}</h4><p>${row.solarSystems?.length?row.solarSystems.map(system=>esc(system.name)).join('<span class="profile-system-divider" aria-hidden="true"> · </span>'):'No Solar System yet'}</p></div></section>
        <div class="public-profile-stats" aria-label="Profile statistics">
          <div class="public-profile-stat"><div class="profile-stat-value profile-stat-meter" role="img" aria-label="${monthName} average: ${monthly===null?'not logged':monthly+' out of 10'}"><span class="profile-month-name">${monthName}</span>${scoreCircle(monthly,true)}</div><span>Month average</span></div>
          <div class="public-profile-stat"><div class="profile-stat-value"><strong>${row.totalDaysLogged??'—'}</strong></div><span>Total days logged</span></div>
          <div class="public-profile-stat ${streak>=3?'has-streak':''}"><div class="profile-stat-value"><strong>${streak??'—'}<small>days</small></strong></div><span>Current streak</span></div>
        </div>
        <section class="public-profile-vibes-panel" aria-labelledby="profile-vibes-title"><h4 id="profile-vibes-title" class="eyebrow">CURRENT VIBES</h4><p class="public-profile-vibes">${esc(row.vibes===undefined?'Not shared yet.':appearance.vibes||'No vibes shared yet.')}</p></section>
      </article>
      <section class="public-profile-friends" aria-labelledby="profile-friends-title"><div class="profile-friends-heading"><h3 id="profile-friends-title">Friends</h3><span class="count-pill" aria-label="${person.friends?.length??'...'} friends">${person.friends?.length??'...'}</span></div>
      ${person.friends?.length?`<ul class="profile-friend-grid">${person.friends.map(friend=>`<li><button type="button" data-view-profile="${esc(friend.uid)}"><span class="profile-username">@${esc(friend.username)}</span><span class="profile-friend-arrow" aria-hidden="true">↗</span></button></li>`).join('')}</ul>`:`<p class="hint profile-friends-empty">${person.friends?'No friends yet.':'Loading friends...'}</p>`}</section>`;
      requestAnimationFrame(()=>fitShortUsernames(dialog));
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-view-profile]');if(button)open(button.dataset.viewProfile);});
  content.addEventListener('click',async event=>{
    if(event.target.closest('[data-profile-remove]')){
      removal={uid:target,run:serial,account:getUser()?.uid};
      removeDialog.querySelector('#profile-remove-description').textContent='Remove @'+targetName+' from your friends? You will be removed from each other’s friends lists. Your Solar System memberships stay in place.';
      removeDialog.querySelector('#profile-remove-error').textContent='';removeDialog.showModal();return;
    }
    const cancel=event.target.closest('[data-profile-cancel]');
    if(cancel){
      const uid=target,run=serial,account=getUser()?.uid;cancel.disabled=true;cancel.textContent='Cancelling…';
      try{await getClient().dismiss(cancel.dataset.profileCancel);if(run===serial&&account===getUser()?.uid){relationships.set(uid,{...relationships.get(uid),sent:null});await open(uid);}}
      catch(error){if(run===serial){cancel.disabled=false;cancel.textContent='Cancel request';const message=document.createElement('p');message.textContent=error.message;message.setAttribute('role','alert');content.append(message);}}
      return;
    }
    const button=event.target.closest('[data-profile-request]');if(!button)return;
    const uid=target,run=serial,account=getUser()?.uid;button.disabled=true;
    try{await getClient().request(uid);if(run===serial&&account===getUser()?.uid){relationships.set(uid,{friend:false,sent:{id:account+'~'+uid}});await open(uid);}}
    catch(error){if(run===serial){button.disabled=false;button.textContent='Retry friend request';const message=document.createElement('p');message.textContent=error.message;message.setAttribute('role','alert');content.append(message);}}
  });
  return {open,reset(){serial++;target=null;removal=null;relationships.clear();cache.clear();pending.clear();if(removeDialog.open)removeDialog.close();if(dialog.open)dialog.close();}};
}
