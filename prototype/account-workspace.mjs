// Keep offline records separate when a device switches Google accounts.
export function createAccountWorkspace({storage,project,read,apply,fresh,hasLegacyAccount=()=>false}) {
  const prefix=`homebase.account-workspace.v1.${project}.`,ownerKey=prefix+'active';
  let initialized=false,bound=false,owner=null;
  return {
    switchTo(uid) {
      if(!initialized){const saved=storage.getItem(ownerKey);bound=saved!==null;owner=saved||null;initialized=true;}
      const next=uid||null;
      const pendingKey=prefix+'pending.'+next;
      if(next===owner)return {preferCloudOnFirstRead:!!next&&storage.getItem(pendingKey)==='true'};
      // Upgrade an existing signed-in install without losing offline edits.
      if(!bound&&!owner&&next&&hasLegacyAccount(next)){
        storage.setItem(ownerKey,next);owner=next;bound=true;return {preferCloudOnFirstRead:false};
      }
      const raw=storage.getItem(prefix+(next||'anonymous'));
      const cached=raw?JSON.parse(raw):null,target=cached||fresh();
      storage.setItem(prefix+(owner||'anonymous'),JSON.stringify(read()));
      if(next&&!cached)storage.setItem(pendingKey,'true');
      storage.setItem(ownerKey,next||'');
      try {apply(target);}
      catch(error){try{storage.setItem(ownerKey,owner||'');}catch{}throw error;}
      owner=next;bound=true;
      return {preferCloudOnFirstRead:!!next&&storage.getItem(pendingKey)==='true'};
    },
    restored(){if(owner)storage.setItem(prefix+'pending.'+owner,'false');},
  };
}
