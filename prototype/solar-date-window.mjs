import {addDays} from './model.mjs';

// Board ratings and their reaction badges need both viewer-local calendar days.
// Late check-in status retains its separate app-day (1 a.m.) window.
export function watchSolarDateWindow(api,group,today,{days,reactions,error}){
  let active=true;
  const stops=[];
  for(const date of [addDays(today,-1),today]){
    const failed=issue=>{if(active)error?.(issue);};
    stops.push(api.watchToday(group,date,rows=>{if(active)days(date,rows);},failed));
    stops.push(api.watchReactions(group,date,rows=>{if(active)reactions(date,rows);},failed));
  }
  return ()=>{active=false;for(const stop of stops)stop();};
}
