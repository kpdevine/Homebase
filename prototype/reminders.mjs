import {reminderConfig} from './reminder-config.mjs';

export function mountReminders({cloud,preview}) {
  const enable=document.getElementById('reminder-enable'),disableButton=document.getElementById('reminder-disable'),status=document.getElementById('reminder-status');
  const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  const installed=matchMedia('(display-mode:standalone)').matches||navigator.standalone===true;
  let subscription=null,registration=null,busy=false,stateTimer,refreshing=false;
  const ownerKey='pocketplanet.push-owner.v1';
  function paint(message) {
    enable.hidden=!!subscription;disableButton.hidden=!subscription;
    enable.disabled=busy||preview||!supported||ios&&!installed||!reminderConfig.apiBase||!cloud.isEnabled()||!cloud.hasUser();disableButton.disabled=busy;
    status.textContent=message||(preview?'Reminders are available in your personal workspace.':!supported?'This browser does not support push notifications.':ios&&!installed?'Add Pocket Planet to your Home Screen, then open it there to enable reminders.':!reminderConfig.apiBase?'The reminder service is being configured.':!cloud.hasUser()||!cloud.isEnabled()?'Sign in and enable cloud sync to use reminders.':subscription?'On for this device · after 10:30 p.m. Central time, only if today is not logged.':Notification.permission==='denied'?'Notifications are blocked. Allow them in your device settings, then return here.':'Off for this device. Enable to receive one reminder after 10:30 p.m. Central time when a check-in is missing.');
  }
  async function call(path,body) {
    const session=await cloud.session();if(!session)throw new Error('Sign in to manage reminders.');
    const response=await fetch(reminderConfig.apiBase+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Reminder connection failed.');return data;
  }
  async function discover() {
    if(!supported||preview)return;
    registration=await navigator.serviceWorker.getRegistration();subscription=await registration?.pushManager.getSubscription()||null;
  }
  async function syncState() {
    if(preview||!reminderConfig.apiBase||!cloud.isEnabled()||cloud.status()!=='synced'||refreshing)return;
    refreshing=true;
    try {await call('/state',{});paint();}
    catch{if(subscription)paint('Reminders are on; the latest logging status has not reached the reminder service. Reconnect to update it.');}
    finally{refreshing=false;}
  }
  function changed() {paint();clearTimeout(stateTimer);stateTimer=setTimeout(syncState,1500);}
  enable.addEventListener('click',async()=>{
    if(enable.disabled)return;
    busy=true;paint('Requesting notification permission…');
    try {
      // Ask directly from the tap, before network or registration awaits (required by iOS).
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){paint('Notifications were not enabled. You can change this in device settings.');return;}
      const response=await fetch(reminderConfig.apiBase+'/config',{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('Reminder service is unavailable.');
      const config=await response.json(),raw=atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/'));
      const applicationServerKey=Uint8Array.from(raw,value=>value.charCodeAt(0));
      registration=await navigator.serviceWorker.register('/push-sw.js',{scope:'/'});await navigator.serviceWorker.ready;
      subscription=await registration.pushManager.getSubscription();
      const session=await cloud.session();let previousOwner;try{previousOwner=localStorage.getItem(ownerKey);}catch{}
      if(subscription&&previousOwner!==session?.uid){await subscription.unsubscribe();subscription=null;}
      subscription=subscription||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});
      await call('/subscribe',{subscription:subscription.toJSON()});
      try{localStorage.setItem(ownerKey,session.uid);}catch{}
      paint('On for this device · after 10:30 p.m. Central time, only if today is not logged.');
    }catch(error){if(subscription){try{await subscription.unsubscribe();}catch{}subscription=null;}paint(error.message);}
    finally{busy=false;enable.disabled=false;paint(status.textContent);}
  });
  async function disable({quiet=false}={}) {
    busy=true;paint('Turning reminders off…');
    try {
      await discover();if(subscription){try{await call('/unsubscribe',{endpoint:subscription.endpoint});}catch{}
        if(!await subscription.unsubscribe())throw new Error('Could not disable this device’s push subscription.');}
      subscription=null;try{localStorage.removeItem(ownerKey);}catch{}paint('Reminders are off for this device.');
    }catch(error){paint(error.message);if(!quiet)throw error;}
    finally{busy=false;paint(status.textContent);}
  }
  disableButton.addEventListener('click',()=>disable().catch(()=>{}));
  window.addEventListener('online',changed);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){discover().then(changed).catch(()=>paint());}});
  // Updates the day after midnight even when the workspace remains open.
  setInterval(syncState,15*60*1000);
  discover().then(changed).catch(()=>paint());paint();
  return {changed,disable};
}
