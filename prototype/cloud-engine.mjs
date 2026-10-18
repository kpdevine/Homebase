import {snapshotRecords,recordsSnapshot,recordChanges,reconcileRecords,acknowledgeOwnChanges,syncBatch} from './cloud-records.mjs';

export function createCloudEngine({transport,readLocal,applyLocal,canApply=()=>true,loadBase=()=>null,saveBase=()=>{},onState=()=>{},delay=900}) {
  let base=new Map(loadBase()||[]),remote=null,waiting=null,enabled=false,writing=false,inFlight=[],timer,closed=false,conflicts=[];
  const emit=(status,message)=>{if(!closed)onState({status,message,conflicts:[...conflicts],remoteCount:remote?.size??0});};
  function remember(){saveBase([...base]);}
  function schedule(){clearTimeout(timer);if(enabled&&!writing&&!conflicts.length&&!waiting&&!closed)timer=setTimeout(flush,delay);}
  function receive(next) {
    if(closed)return;
    remote=new Map(next);
    if(!enabled){emit('ready','Sign-in is ready. Enable sync to connect this personal workspace.');return;}
    if(!canApply()){waiting=remote;emit('editing','Cloud changes are waiting while you finish editing.');return;}
    waiting=null;
    try {
      const current=readLocal(),local=snapshotRecords(current);
      base=acknowledgeOwnChanges(base,remote,inFlight);
      if(inFlight.every(change=>(remote.get(change.id)??null)===change.after))inFlight=[];
      const result=reconcileRecords(base,local,remote);conflicts=result.conflicts;
      if(conflicts.length){emit('conflict','This device and another device changed the same record. Choose which version to keep.');return;}
      const merged=recordsSnapshot(result.merged,current.serial);
      if(recordChanges(local,result.merged).length)applyLocal(merged);
      base=new Map(remote);remember();
      if(recordChanges(base,snapshotRecords(readLocal())).length){emit('pending','Saved locally. Cloud changes are queued.');schedule();}
      else emit('synced','Saved locally and synced across your signed-in devices.');
    }catch(error){emit('error',error.message);}
  }
  async function flush() {
    clearTimeout(timer);
    if(closed||!enabled||writing||conflicts.length||waiting||!remote)return;
    let success=false;
    try {
      inFlight=syncBatch(recordChanges(base,snapshotRecords(readLocal())));
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
    stop=transport.subscribe(receive,error=>{
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
      const current=readLocal(),result=reconcileRecords(base,snapshotRecords(current),remote,choice);
      const merged=recordsSnapshot(result.merged,current.serial);applyLocal(merged);base=new Map(remote);conflicts=[];remember();emit('pending','Choice saved locally. Syncing the resolved records…');schedule();
      }catch(error){emit('error',error.message);}
    },
    flush,
    close(){closed=true;clearTimeout(timer);stop();},
  };
}
