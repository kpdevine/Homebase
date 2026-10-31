import {solarMemberStreak} from './social-model.mjs';

const fields=['appDate','month','yesterdayDate','yesterdayScore','monthScore','daysLogged','totalDaysLogged','consecutiveStreak','streakEndDate','planet','vibes','vibesVersion'];
function savedAt(value){
  if(typeof value?.toMillis==='function')return value.toMillis();
  return Number.isFinite(value?.seconds)?value.seconds*1000+(value.nanoseconds||0)/1e6:0;
}

export function profileDetails(identity,sources,today,days,appearance){
  const valid=sources.filter(source=>source&&source.uid===identity.uid).sort((a,b)=>savedAt(a.updatedAt)-savedAt(b.updatedAt));
  const row={...identity};
  for(const source of valid)for(const key of fields)if(source[key]!==undefined)row[key]=source[key];
  const newestSummary=valid.filter(source=>Object.hasOwn(source,'monthScore')).at(-1);
  if(newestSummary&&!Object.hasOwn(newestSummary,'consecutiveStreak')){delete row.consecutiveStreak;delete row.streakEndDate;}
  if(days)Object.assign(row,solarMemberStreak(row,days,today));
  for(const key of ['planet','vibes','vibesVersion'])if(appearance?.[key]!==undefined)row[key]=appearance[key];
  return {...row,sharedDetailsAvailable:valid.length>0,streakAvailable:Number.isInteger(row.consecutiveStreak)};
}
