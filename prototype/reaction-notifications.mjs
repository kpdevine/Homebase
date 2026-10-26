import {reminderConfig} from './reminder-config.mjs';
export async function notifyReaction(event,{session,fetcher=fetch,apiBase=reminderConfig.apiBase}){
  if(!apiBase)return false;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const user=await session();if(!user)return false;
      const response=await fetcher(apiBase+'/reaction',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${user.token}`},body:JSON.stringify(event),signal:AbortSignal.timeout(10000)});
      if(response.ok)return true;
      if(response.status<500&&response.status!==429)return false;
    }catch{}
  }
  return false;
}
