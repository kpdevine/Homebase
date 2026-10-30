import {snapshotRecords,recordsSnapshot,recordChanges,reconcileRecords,acknowledgeOwnChanges,syncBatch} from './cloud-records.mjs';

export function createCloudEngine({transport,readLocal,applyLocal,canApply=()=>true,loadBase=()=>null,saveBase=()=>{},localEditTimes=()=>new Map(),adoptEditTimes=()=>{},onState=()=>{},delay=900,preferCloudOnFirstRead=false,now=Date.now}) {
  let base=new Map(loadBase()||[]),remote=null,waiting=null,enabled=false,writing=false,inFlight=[],timer,closed=false,conflicts=[];
  let remoteEditTimes=new Map(),restored=false,remoteConfirmedAt=null,lastSyncedAt=null;
  function mergedTimes(merged,local,mine) {
    return new Map([...merged].flatMap(([id,payload])=>{
      const localAt=payload===local.get(id)?mine.get(id)||0:0,remoteAt=payload===remote.get(id)?remoteEditTimes.get(id)||0:0;
      const at=Math.max(localAt,remoteAt);return at?[[id,at]]:[];
    }));
  }
  const emit=(status,message)=>{if(closed)return;if(status==='synced'&&remoteConfirmedAt!==null)lastSyncedAt=Math.max(lastSyncedAt||0,remoteConfirmedAt);onState({status,message,restored,lastSyncedAt,conflicts:[...conflicts],remoteCount:remote?.size??0});};
  function remember(){saveBase([...base]);}
  function schedule(){clearTimeout(timer);if(enabled&&!writing&&!conflicts.length&&!waiting&&!closed)timer=setTimeout(flush,delay);}
  function receive(next,times=remoteEditTimes) {
    if(closed)return;
    remote=new Map(next);
    remoteEditTimes=new Map(times);
    if(!enabled){emit('ready','Sign-in is ready. Enable sync to connect this personal workspace.');return;}
    if(!canApply()){waiting=remote;emit('editing','Cloud updates are waiting while a menu, review, or editor is open.');return;}
    waiting=null;
    try {
      const current=readLocal(),local=snapshotRecords(current);
      // A new device/account starts with UI defaults, not competing edits.
      // An empty cloud still keeps the fresh-account module defaults.
      if(preferCloudOnFirstRead){if(remote.size)base=new Map(local);preferCloudOnFirstRead=false;}
      base=acknowledgeOwnChanges(base,remote,inFlight);
      if(inFlight.every(change=>(remote.get(change.id)??null)===change.after))inFlight=[];
      const mine=localEditTimes(local);
      const result=reconcileRecords(base,local,remote,'newest',{local:mine,remote:remoteEditTimes});conflicts=result.conflicts;
      if(conflicts.length){emit('conflict','Both versions changed, but their saved edit times cannot establish a newer version. Choose which to keep.');return;}
      const merged=recordsSnapshot(result.merged,current.serial);
      if(recordChanges(local,result.merged).length)applyLocal(merged);
      adoptEditTimes(result.merged,mergedTimes(result.merged,local,mine));
      base=new Map(remote);remember();restored=true;
      if(recordChanges(base,snapshotRecords(readLocal())).length){emit('pending','Saved locally. Cloud changes are queued.');schedule();}
      else emit('synced','Saved locally and synced across your signed-in devices.');
    }catch(error){emit('error',error.message);}
  }
  async function flush() {
    clearTimeout(timer);
    if(closed||!enabled||writing||conflicts.length||waiting||!remote)return;
    let success=false;
    try {
      const local=snapshotRecords(readLocal()),times=localEditTimes(local);
      inFlight=syncBatch(recordChanges(base,local)).map(change=>({...change,editedAt:times.get(change.id)??null,beforeEditedAt:remoteEditTimes.get(change.id)??null}));
      if(!inFlight.length){emit('synced','Saved locally and synced across your signed-in devices.');return;}
      writing=true;emit('syncing','Saved locally. Syncing changes…');
      await transport.commit(inFlight);
      if(closed)return;
      success=true;
      // Wait for the server-backed listener before advancing the baseline.
      emit('syncing','Changes sent. Waiting for cloud confirmation…');
    }catch(error){emit(error.code==='homebase/conflict'?'conflict':'offline',error.code==='homebase/conflict'?'Another device saved a newer version. Waiting for the latest cloud records.':'Saved locally. Cloud sync is unavailable; changes will retry.');}
    finally {writing=false;if(success&&!closed){if(waiting&&canApply())receive(waiting);else if(remote&&!waiting)receive(remote);}}
  }
  let stop=()=>{},subscriptionFailed=false;
  function subscribe(){
    stop=transport.subscribe((records,times)=>{remoteConfirmedAt=now();receive(records,times);},error=>{
      subscriptionFailed=true;remote=null;waiting=null;clearTimeout(timer);
      emit('error',`Local records are safe. ${error.message} Use Sync now to reconnect.`);
    });
  }
  subscribe();
  return {
    enable(){enabled=true;if(remote)receive(remote);else emit('loading','Waiting for your cloud records…');},
    changed(){if(enabled){emit(conflicts.length?'conflict':'pending',conflicts.length?'Resolve the competing versions before syncing.':'Saved locally. Waiting to sync…');schedule();}},
    resume(){if(waiting&&canApply())receive(waiting);else if(enabled&&!writing) schedule();},
    async retry(){if(closed)return;if(subscriptionFailed){stop();subscriptionFailed=false;subscribe();return;}if(remote)receive(remote);await flush();},
    resolve(choice){
      if(closed||!remote||!enabled||!['local','cloud'].includes(choice))return;
      try {
      const current=readLocal(),local=snapshotRecords(current),mine=localEditTimes(local),result=reconcileRecords(base,local,remote,choice);
      const merged=recordsSnapshot(result.merged,current.serial);applyLocal(merged);base=new Map(remote);conflicts=[];remember();emit('pending','Choice saved locally. Syncing the resolved records…');schedule();
      const times=mergedTimes(result.merged,local,mine);
      if(choice==='local')for(const id of result.conflicts)if(result.merged.has(id))times.set(id,Date.now());
      adoptEditTimes(result.merged,times);
      }catch(error){emit('error',error.message);}
    },
    flush,
    close(){closed=true;clearTimeout(timer);stop();},
  };
}
