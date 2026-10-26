import {createRemoteJWKSet,jwtVerify} from 'jose';
import {buildPushPayload} from '@block65/webcrypto-web-push';
import {localParts,reminderDate,validTimeZone,reminderDue,loggedFromRecord,validPushSubscription} from './policy.mjs';
import {cloudReaction,deliverReaction,reactionRequest} from './reaction-events.mjs';

const PROJECT='homebase-d3c6c';
const ORIGINS=new Set(['https://pocketplanet.day','https://homebase-d3c6c.firebaseapp.com','https://homebase-d3c6c.web.app']);
const JWKS=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
async function verifyUser(token) {
  const {payload}=await jwtVerify(token,JWKS,{algorithms:['RS256'],issuer:`https://securetoken.google.com/${PROJECT}`,audience:PROJECT});
  if(typeof payload.sub!=='string'||!payload.sub.length||payload.sub.length>128)throw new Error('Invalid account.');
  return payload.sub;
}
async function cloudLogged(uid,token,date) {
  // User-scoped, short-lived ID token; never stored. Existing owner-only Firestore rules apply.
  const url=`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${encodeURIComponent(uid)}/records/day_${date}`;
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
  if(response.status===404)return {logged:false,version:Date.now()};
  if(!response.ok)throw new Error('Could not read the saved check-in.');
  const document=await response.json();
  if(document.fields?.format?.integerValue!=='1'||typeof document.fields?.payload?.stringValue!=='string')throw new Error('Unsupported saved record.');
  return {logged:loggedFromRecord(JSON.parse(document.fields.payload.stringValue)),version:Date.parse(document.updateTime)};
}
export async function sendPush(subscription,message,env,{fetcher=fetch}={}) {
  const payload=await buildPushPayload({data:JSON.stringify(message),options:{ttl:1800}},subscription,
    {subject:'https://pocketplanet.day',publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
  // workerd rejects redirect:'error' before sending. Manual also keeps the
  // encrypted payload and VAPID authorization from following any redirect.
  return fetcher(subscription.endpoint,{...payload,signal:AbortSignal.timeout(15000),redirect:'manual'});
}
async function deviceId(endpoint) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));
  return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
export function createReminderWorker({verify=verifyUser,readLogged=cloudLogged,readReaction=cloudReaction,send=sendPush,now=()=>new Date()}={}) {
  return {
    async fetch(request,env) {
      const origin=request.headers.get('Origin'),url=new URL(request.url);
      const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
      if(ORIGINS.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});
      const reply=(body,status=200)=>new Response(body===null?null:JSON.stringify(body),{status,headers});
      if(url.pathname==='/health'&&request.method==='GET')return reply({service:'Pocket Planet reminders',ready:!!env.VAPID_PUBLIC_KEY&&!!env.VAPID_PRIVATE_KEY&&!!env.DB});
      if(!ORIGINS.has(origin))return reply({error:'Origin not allowed.'},403);
      if(request.method==='OPTIONS')return reply(null,204);
      if(url.pathname==='/config'&&request.method==='GET')return reply({publicKey:env.VAPID_PUBLIC_KEY,timeZone:'device'});
      if(request.method!=='POST'||!['/subscribe','/unsubscribe','/state','/reaction'].includes(url.pathname))return reply({error:'Not found.'},404);
      if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'JSON required.'},415);
      if(Number(request.headers.get('Content-Length'))>8192)return reply({error:'Request too large.'},413);
      let uid,token;
      try {token=/^Bearer ([^ ]+)$/.exec(request.headers.get('Authorization')||'')?.[1];if(!token)throw new Error();uid=await verify(token);}
      catch{return reply({error:'Sign in again to manage reminders.'},401);}
      try {
        const text=await request.text();if(text.length>8192)return reply({error:'Request too large.'},413);
        const body=JSON.parse(text),at=now();
        if(url.pathname==='/reaction'){
          let input;try{input=reactionRequest(body);}catch{return reply({error:'Invalid reaction event.'},400);}
          try{const event=await readReaction(uid,token,input,at);if(event)await deliverReaction(event,env,{send,now:at});return reply({received:true});}
          catch{return reply({error:'Reaction notification unavailable.'},503);}
        }
        if(url.pathname==='/unsubscribe') {
          if(typeof body.endpoint!=='string')return reply({error:'Subscription required.'},400);
          await env.DB.prepare('DELETE FROM devices WHERE id=? AND uid=?').bind(await deviceId(body.endpoint),uid).run();
          return reply({enabled:false});
        }
        const devices=(await env.DB.prepare('SELECT id,time_zone FROM devices WHERE uid=?').bind(uid).all()).results;
        // A user with no subscribed devices does not create a second check-in store.
        if(url.pathname==='/state'&&!devices.length)return reply({tracked:false});
        const subscription=url.pathname==='/subscribe'?validPushSubscription(body.subscription):null;
        const timeZone=body.timeZone===undefined&&!subscription?null:validTimeZone(body.timeZone);
        let id;
        if(subscription) {
          id=await deviceId(subscription.endpoint);const owner=await env.DB.prepare('SELECT uid FROM devices WHERE id=?').bind(id).first();
          if(owner&&owner.uid!==uid)return reply({error:'Disable this device’s reminders before changing accounts.'},409);
          const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM devices WHERE uid=?').bind(uid).first();
          if(!owner&&count.count>=10)return reply({error:'This account already has ten reminder devices.'},409);
        } else if(body.endpoint!==undefined) {
          if(typeof body.endpoint!=='string'||body.endpoint.length>2048)return reply({error:'Subscription required.'},400);
          id=await deviceId(body.endpoint);
        }
        const tracked=devices.filter(device=>device.id!==id);
        if(subscription||timeZone&&devices.some(device=>device.id===id))tracked.push({id,time_zone:timeZone});
        else if(id)tracked.push(...devices.filter(device=>device.id===id));
        const dates=[...new Set(tracked.map(device=>reminderDate(at,device.time_zone)))];
        for(const date of dates) {
          const requested=Date.now(),result=await readLogged(uid,token,date),logged=typeof result==='boolean'?result:result.logged,observed=Number.isFinite(result?.version)?result.version:requested;
          await env.DB.prepare('INSERT INTO day_status(uid,date,logged,observed_at) VALUES(?,?,?,?) ON CONFLICT(uid,date) DO UPDATE SET logged=excluded.logged,observed_at=excluded.observed_at WHERE excluded.observed_at>=day_status.observed_at').bind(uid,date,Number(logged),observed).run();
        }
        if(subscription)await env.DB.prepare('INSERT INTO devices(id,uid,subscription,time_zone,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription,time_zone=excluded.time_zone').bind(id,uid,JSON.stringify(subscription),timeZone,at.getTime()).run();
        else if(timeZone&&id)await env.DB.prepare('UPDATE devices SET time_zone=? WHERE id=? AND uid=?').bind(timeZone,id,uid).run();
        return reply({enabled:!!subscription,dates});
      }catch(error){return reply({error:error.message==='Unsupported push service.'||error.message.startsWith('Invalid push')?error.message:'Reminder update failed. Please try again.'},400);}
    },
    async scheduled(controller,env,ctx) {
      const at=now();
      const rows=await env.DB.prepare('SELECT * FROM devices').all();
      for(const device of rows.results) {
        let date,minutes;try{({date,minutes}=localParts(at,validTimeZone(device.time_zone)));}catch{continue;}
        // Each device has its own evening window, including daylight saving.
        if(minutes<22*60+30)continue;
        const cached=await env.DB.prepare('SELECT logged FROM day_status WHERE uid=? AND date=?').bind(device.uid,date).first();
        if(!reminderDue(device,{date,logged:cached?.logged},at))continue;
        const claim=await env.DB.prepare('UPDATE devices SET last_sent_date=?,last_attempt_at=? WHERE id=? AND (last_sent_date IS NULL OR last_sent_date<>?) RETURNING id').bind(date,at.getTime(),device.id,date).first();
        if(!claim)continue;
        // Recheck after the atomic claim, so a check-in from another device wins the race.
        const state=await env.DB.prepare('SELECT logged FROM day_status WHERE uid=? AND date=?').bind(device.uid,date).first();
        if(state?.logged===1)continue;
        try {
          const response=await send(JSON.parse(device.subscription),{title:'Time to log your day',body:'A quick check-in for Nutrition, Daily training, and your To-do list.',tag:`pocket-planet-log-${date}`,date,url:'https://pocketplanet.day/'},env);
          if(response.status===404||response.status===410)await env.DB.prepare('DELETE FROM devices WHERE id=?').bind(device.id).run();
          else if(!response.ok)console.warn('Reminder delivery rejected',{status:response.status});
          else console.info('Reminder accepted by push service',{date,status:response.status});
        }catch(error){console.warn('Reminder delivery was not confirmed; not retrying to avoid duplicates.',{date,error:typeof error?.name==='string'?error.name:'Error'});}
      }
      await env.DB.prepare('DELETE FROM day_status WHERE date<?').bind(new Date(at.getTime()-3*86400000).toISOString().slice(0,10)).run();
      await env.DB.prepare('DELETE FROM reaction_notifications WHERE created_at<?').bind(at.getTime()-40*86400000).run();
    },
  };
}
export default createReminderWorker();
