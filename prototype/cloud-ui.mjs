import {firebaseConfig} from './firebase-config.mjs';
import {createCloudEngine} from './cloud-engine.mjs';

export function mountCloud({preview,readLocal,applyLocal,canApply,flushLocal,onStatus,onUser=()=>{},beforeSignOut=async()=>{},localEditTimes,adoptEditTimes}) {
  const el=id=>document.getElementById(id);
  let client=null,engine=null,user=null,enabled=false,busy=false;
  let state={status:preview?'preview':firebaseConfig?'loading':'unconfigured',message:preview?'Preview stays on this device. Open your personal workspace to use cloud sync.':firebaseConfig?'Connecting to Firebase…':'Firebase connection is being configured. Your records continue saving locally.',conflicts:[]};
  function paint() {
    el('cloud-status').textContent=state.message;
    el('cloud-account').textContent=user?`Signed in as ${user.email||'your Google account'}`:'';
    el('cloud-signin').hidden=!!user||preview;el('cloud-signin').disabled=!client||busy;
    el('cloud-enable').hidden=!user||enabled;el('cloud-enable').disabled=busy||!['ready','editing'].includes(state.status);
    el('cloud-signout').hidden=!user;el('cloud-retry').hidden=!enabled;
    el('cloud-conflicts').hidden=state.status!=='conflict'||!state.conflicts.length;
    el('cloud-conflict-list').textContent=(state.conflicts||[]).map(id=>id.startsWith('day_')?`Day ${id.slice(4)}`:id.startsWith('targets_')?`Targets for ${id.slice(8)}`:'Recurring task').join(', ');
    el('cloud-sync-details').hidden=preview;
    onStatus({enabled,status:state.status,canSignIn:!!client&&!busy&&!preview,message:state.message,label:preview?'Preview · saved separately':state.status==='synced'?'Saved · cloud synced':enabled?'Saved locally · '+({conflict:'sync conflict',offline:'cloud offline',error:'sync needs attention',editing:'updates waiting'}[state.status]||'syncing'):'Saved on this device'});
  }
  function setState(next){state=next;paint();}
  function key(name){return `homebase.cloud-${name}.v1.${firebaseConfig.projectId}.${user.uid}`;}
  function observeUser(next) {
    engine?.close();engine=null;user=next;enabled=false;
    onUser(user?{displayName:user.displayName}:null);
    if(!user){setState({status:'signed-out',message:'Sign in with Google to connect your personal records across devices.',conflicts:[]});return;}
    try {enabled=localStorage.getItem(key('enabled'))==='true';}
    catch {setState({status:'error',message:'Browser storage is unavailable. Restore local saving before connecting cloud sync.',conflicts:[]});return;}
    const baseKey=key('base');let savedBase=null;
    try {const parsed=JSON.parse(localStorage.getItem(baseKey));if(Array.isArray(parsed)&&parsed.every(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(value=>typeof value==='string')))savedBase=parsed;}catch{}
    setState({status:'loading',message:'Loading your private cloud records…',conflicts:[]});
    engine=createCloudEngine({transport:client.transport(user.uid),readLocal,applyLocal,canApply,localEditTimes,adoptEditTimes,loadBase:()=>savedBase,saveBase:base=>localStorage.setItem(baseKey,JSON.stringify(base)),onState:setState});
    if(enabled)engine.enable();
  }
  async function signIn() {
    if(!client||busy)return;busy=true;paint();
    try {await client.signIn();}
    catch(error){setState({status:'signed-out',message:error.code==='auth/popup-blocked'?'Allow the Google sign-in popup, then try again.':error.code==='auth/unauthorized-domain'?'This app address needs to be enabled in Firebase Authentication.':`Google sign-in did not finish. ${error.message}`,conflicts:[]});}
    finally {busy=false;paint();}
  }
  el('cloud-signin').addEventListener('click',signIn);
  el('cloud-enable').addEventListener('click',()=>{
    if(!user||!engine)return;
    if(!flushLocal()){setState({status:'error',message:'Resolve local saving before enabling cloud sync.',conflicts:[]});return;}
    try {localStorage.setItem(key('enabled'),'true');enabled=true;engine.enable();paint();}
    catch(error){setState({status:'error',message:`Could not enable cloud sync. ${error.message}`,conflicts:[]});}
  });
  el('cloud-signout').addEventListener('click',async()=>{
    if(!client||busy)return;busy=true;paint();
    try {await beforeSignOut();await client.signOut();}catch(error){setState({...state,message:error.message});}
    finally{busy=false;paint();}
  });
  el('cloud-retry').addEventListener('click',()=>engine?.retry());
  el('cloud-keep-local').addEventListener('click',()=>engine?.resolve('local'));
  el('cloud-keep-remote').addEventListener('click',()=>engine?.resolve('cloud'));
  window.addEventListener('online',()=>engine?.retry());
  window.addEventListener('offline',()=>{if(enabled)setState({...state,status:'offline',message:'Saved locally. Cloud sync will resume after reconnecting.'});});
  let resumeTimer;
  const resumeAfterInteraction=()=>{clearTimeout(resumeTimer);resumeTimer=setTimeout(()=>engine?.resume(),0);};
  // Native close/toggle events do not bubble. Click also covers keyboard activation.
  for(const type of ['focusout','pointerup','click','close','toggle'])document.addEventListener(type,resumeAfterInteraction,true);
  paint();
  if(!preview&&firebaseConfig)import('./firebase-driver.mjs').then(module=>{client=module.firebaseClient(firebaseConfig);client.observeAuth(observeUser,error=>setState({status:'error',message:`Google sign-in did not finish. ${error.message}`,conflicts:[]}));paint();}).catch(error=>setState({status:'offline',message:`Cloud connection is unavailable. Local saving still works. Reload when online. ${error.message}`,conflicts:[]}));
  return {changed:()=>engine?.changed(),resume:()=>engine?.resume(),isEnabled:()=>enabled,status:()=>state.status,signIn,hasUser:()=>!!user,session:async()=>user?{uid:user.uid,token:await user.getIdToken()}:null};
}
