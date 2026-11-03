// Unknown authentication or membership must never mean "not in a system".
export function socialLoggingReady({preview=false,authReady=false,cloudHasUser=false,user,needsUsername=false,profile,membershipReady=false,appearanceReady=false,groupIds=[]}){
  if(!preview&&!authReady)return false;
  if(!user)return !cloudHasUser;
  if(needsUsername)return membershipReady&&groupIds.length===0;
  return membershipReady&&(groupIds.length?appearanceReady:!!profile);
}

export function membershipSnapshotReady(snapshot){
  return snapshot.metadata.fromCache===false||snapshot.docs.length>0;
}
