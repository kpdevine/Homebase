import {GROUPS} from './muscles.mjs';

export const REST_MODES=['rest','unplanned-rest','rest-unclassified'];
export function idealWorkout(progress) {
  const needed=Math.ceil(Math.max(0,progress.dailyTarget-(progress.weighted||0))),available=progress.groups.filter(group=>group.remaining>0);
  const ordered=[...available].sort((a,b)=>a.credited/a.target-b.credited/b.target||b.remaining-a.remaining||a.id.localeCompare(b.id));
  const budget=Math.min(needed,available.reduce((sum,group)=>sum+group.remaining,0));
  let count=Math.min(3,ordered.length);
  while(count<ordered.length&&ordered.slice(0,count).reduce((sum,group)=>sum+group.remaining,0)<budget)count++;
  const groups=ordered.slice(0,count).map(group=>({...group,sets:0}));
  for(let set=0;set<budget;set++) {
    const next=groups.filter(group=>group.sets<group.remaining).sort((a,b)=>(a.credited+a.sets)/a.target-(b.credited+b.sets)/b.target||(b.remaining-b.sets)-(a.remaining-a.sets)||a.id.localeCompare(b.id))[0];
    if(next)next.sets++;
  }
  return {sets:budget,groups:groups.filter(group=>group.sets),targetMet:progress.target>0&&needed===0,goalsMet:progress.target>0&&!available.length};
}
// Derived from dated records: backdated edits replay the week, never future days.
export function trainingProgress(day, week={groups:GROUPS,entries:[],days:[]}) {
  const weekday=(new Date(`${day.date}T12:00:00Z`).getUTCDay()+6)%7;
  const start=week.start||new Date(Date.parse(`${day.date}T12:00:00Z`)-weekday*86400000).toISOString().slice(0,10);
  const through=week.entries.filter(entry=>entry.date>=start&&entry.date<=day.date);
  const target=week.groups.reduce((sum,group)=>sum+group.target,0),dailyTarget=target/5;
  const byDate=new Map((week.days||[]).filter(value=>value.date>=start&&value.date<=day.date).map(value=>[value.date,value]));
  byDate.set(day.date,day);
  for(const entry of through)if(!byDate.has(entry.date))byDate.set(entry.date,{date:entry.date,trainingMode:'training'});
  const totals=new Map(),classifications=[],results=new Map();let restCredits=2;
  for(const current of [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date))) {
    const entries=through.filter(entry=>entry.date===current.date);
    let useful=0,nonUseful=0;
    for(const entry of entries) {
      const previous=totals.get(entry.groupId)||0,goal=week.groups.find(group=>group.id===entry.groupId)?.target||0;
      const credited=Math.min(entry.sets,Math.max(0,goal-previous)),extra=entry.sets-credited;
      classifications.push({...entry,useful:credited,nonUseful:extra,weighted:credited+extra*.25});
      useful+=credited;nonUseful+=extra;totals.set(entry.groupId,previous+entry.sets);
    }
    const dailySets=useful+nonUseful,rest=!dailySets&&REST_MODES.includes(current.trainingMode),logged=!!dailySets||rest||current.trainingMode==='training';
    const goalsComplete=target>0&&week.groups.every(group=>(totals.get(group.id)||0)>=group.target);
    const restCreditUsed=rest&&target>0&&!goalsComplete&&restCredits>0;
    const weighted=useful+nonUseful*.25;
    const score=!logged||!target?null:rest?(goalsComplete||restCreditUsed?10:0):weighted>=dailyTarget?10:Math.min(9.9,Math.round((4+weighted/dailyTarget*6)*10)/10);
    if(restCreditUsed)restCredits--;
    results.set(current.date,{score,logged,excluded:logged&&!target,rest,restCreditUsed,restCredits,goalsComplete,dailySets,useful,nonUseful,weighted});
  }
  const groups=week.groups.map(group=>{const actual=totals.get(group.id)||0;return {...group,actual,credited:Math.min(actual,group.target),remaining:Math.max(0,group.target-actual)};});
  const credited=groups.reduce((sum,group)=>sum+group.credited,0),actual=through.reduce((sum,entry)=>sum+entry.sets,0);
  const suggestions=groups.filter(group=>group.remaining>0).sort((a,b)=>a.credited/a.target-b.credited/b.target||b.remaining-a.remaining||a.id.localeCompare(b.id)).slice(0,3);
  return {...results.get(day.date),target,dailyTarget,credited,actual,elapsed:weekday+1,groups,suggestions,classifications};
}
