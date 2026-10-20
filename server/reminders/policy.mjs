export const APP_TIME_ZONE='America/Chicago';
export function localParts(now,timeZone=APP_TIME_ZONE) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const get=type=>parts.find(part=>part.type===type).value;
  return {date:`${get('year')}-${get('month')}-${get('day')}`,minutes:Number(get('hour'))*60+Number(get('minute'))};
}
export function reminderDue(device,status,now=new Date()) {
  const {date,minutes}=localParts(now,device.time_zone);
  return minutes>=22*60+30 && device.last_sent_date!==date && !(status?.date===date&&status.logged===1);
}
// Mirrors the app's three required check-ins; completing the final review is separate.
export function loggedFromRecord(record) {
  const day=record?.day;if(!day)return false;
  const nutrition=typeof day.nutrition==='number'&&Number.isFinite(day.nutrition);
  const training=['training','rest','rest-unclassified','unplanned-rest'].includes(day.trainingMode)||record.entries?.some(entry=>entry.sets>0);
  const checklist=day.reviewed?.checklists===true||(day.checklistTouched??((day.tasks?.length??0)>0))&&(day.tasks?.length??0)>0;
  return !!(nutrition&&training&&checklist);
}
export function validPushSubscription(input) {
  if(!input||typeof input.endpoint!=='string'||input.endpoint.length>2048)throw new Error('Invalid push subscription.');
  const url=new URL(input.endpoint),host=url.hostname;
  const allowed=host==='web.push.apple.com'||host.endsWith('.push.apple.com')||host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.notify.windows.com');
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash||!allowed)throw new Error('Unsupported push service.');
  if(!/^[A-Za-z0-9_-]{87}={0,1}$/.test(input.keys?.p256dh||'')||!/^[A-Za-z0-9_-]{22}={0,2}$/.test(input.keys?.auth||''))throw new Error('Invalid push keys.');
  return {endpoint:url.href,expirationTime:null,keys:{p256dh:input.keys.p256dh,auth:input.keys.auth}};
}
