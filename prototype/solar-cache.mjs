import {solarAppearance} from './social-model.mjs';
const key=uid=>'pocketplanet.solar-bootstrap.v1.'+uid;
// A known membership can require vibes immediately. A cached absence cannot
// exempt someone who may have joined a system on another device.
export function readSolarCache(storage,uid){
  if(!uid)return null;
  try{
    const saved=JSON.parse(storage.getItem(key(uid))||'null');
    if(!Array.isArray(saved?.groups)||!saved.groups.length||saved.groups.length>100)return null;
    if(saved.groups.some(group=>!group||typeof group.id!=='string'||!group.id||group.id.length>1500))return null;
    return {groups:saved.groups,primaryId:saved.primaryId,groupsLoaded:true,...(saved.appearance?{appearance:solarAppearance(saved.appearance),appearanceReady:true}:{})};
  }catch{return null;}
}
export function saveSolarCache(storage,uid,state){
  if(!uid||!state.groupsLoaded)return;
  try{storage.setItem(key(uid),JSON.stringify({groups:state.groups.map(({id,groupName,name,owner,ownerUsername})=>({id,groupName,name,owner,ownerUsername})),primaryId:state.primaryId,...(state.appearanceReady?{appearance:solarAppearance(state.appearance)}:{})}));}catch{}
}

export function mergeSolarBootstrap(previous,incoming){
  const membership=!incoming.groupsLoaded&&previous.groupsLoaded&&previous.groups.length?{groups:previous.groups,groupsLoaded:true,primaryId:incoming.primaryId??previous.primaryId}:{};
  const appearance=!incoming.appearanceReady&&previous.appearanceReady?{appearance:previous.appearance,appearanceReady:true}:{};
  return {...incoming,...membership,...appearance};
}
