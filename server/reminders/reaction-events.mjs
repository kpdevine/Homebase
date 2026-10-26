import {REACTIONS} from '../../prototype/reaction-kinds.mjs';
const ROOT='https://firestore.googleapis.com/v1/projects/homebase-d3c6c/databases/(default)/documents';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
export function reactionRequest(body){
  if(!body||!id(body.group)||!id(body.target)||!['day','vibes'].includes(body.scope))throw new Error('Invalid reaction event.');
  if(body.scope==='day'&&(!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||!Number.isFinite(Date.parse(body.date))))throw new Error('Invalid reaction date.');
  return {group:body.group,target:body.target,scope:body.scope,...(body.scope==='day'?{date:body.date}:{})};
}
// Reads use the reactor's token and existing member-only Firestore rules. No
// administrator credentials, recipient token, or private day log is required.
export async function cloudReaction(actor,token,input,at,{fetcher=fetch}={}){
  const event=reactionRequest(input);if(event.target===actor)return null;
  const base=`friendGroups/${event.group}`,key=event.scope==='day'?`${event.target}~${event.date}~${actor}`:`${event.target}~${actor}`;
  async function read(path){
    const response=await fetcher(ROOT+'/'+path,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
    if([403,404].includes(response.status))return null;
    if(!response.ok)throw new Error('Reaction verification unavailable.');
    return (await response.json()).fields||{};
  }
  const [reaction,item,member]=await Promise.all([read(`${base}/${event.scope==='day'?'reactions':'vibeReactions'}/${key}`),read(`${base}/${event.scope==='day'?'days':'scores'}/${event.target}${event.scope==='day'?'~'+event.date:''}`),read(`${base}/members/${event.target}`)]);
  const text=(fields,key)=>fields?.[key]?.stringValue;
  if(!reaction||!item||!member||text(reaction,'reactor')!==actor||text(reaction,'target')!==event.target)return null;
  const kind=REACTIONS.find(value=>value.id===text(reaction,'kind')),username=text(reaction,'username'),updated=Date.parse(reaction.updatedAt?.timestampValue);
  if(!kind||!/^[a-z][a-z0-9_]{2,19}$/.test(username)||!Number.isFinite(updated)||updated<at.getTime()-120000||updated>at.getTime()+30000)return null;
  const version=event.scope==='day'?event.date:text(reaction,'version');
  if(event.scope==='day'&&text(reaction,'date')!==event.date)return null;
  if(event.scope==='vibes'&&(!text(item,'vibes')?.trim()||version!==(text(item,'vibesVersion')||'legacy')))return null;
  return {...event,actor,version,username,kind:kind.id,label:kind.short};
}
export async function deliverReaction(event,env,{send,now=new Date()}){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([event.scope,event.group,event.target,event.actor,event.version])));
  const key=[...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
  const devices=(await env.DB.prepare('SELECT id,subscription FROM devices WHERE uid=?').bind(event.target).all()).results;
  if(!devices.length)return;
  // Claim once per person and status/day, including concurrent requests and
  // remove/re-add or reaction changes. Bound new events to 20 per ten minutes.
  const claim=await env.DB.prepare('INSERT OR IGNORE INTO reaction_notifications(event_key,actor,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM reaction_notifications WHERE actor=? AND created_at>?)<20 RETURNING event_key').bind(key,event.actor,now.getTime(),event.actor,now.getTime()-600000).first();
  if(!claim)return;
  const message={title:'New planet reaction',body:`@${event.username} reacted to your ${event.scope==='vibes'?'Current vibes':'day score'} (${event.label}).`,tag:'pocket-planet-reaction-'+key,url:'https://pocketplanet.day/?open=solar',...(event.scope==='day'?{date:event.date}:{})};
  await Promise.all(devices.map(async device=>{
    try{
      const response=await send(JSON.parse(device.subscription),message,env);
      if([404,410].includes(response.status))await env.DB.prepare('DELETE FROM devices WHERE id=? AND uid=?').bind(device.id,event.target).run();
      console.info('Reaction push result',{scope:event.scope,status:response.status,accepted:response.ok});
    }catch(error){console.warn('Reaction push unconfirmed',{scope:event.scope,error:error?.name||'Error'});}
  }));
}
