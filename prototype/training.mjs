import {GROUPS} from './muscles.mjs';

export function trainingProgress(day, week={groups:GROUPS,entries:[]}) {
  const weekday=(new Date(`${day.date}T12:00:00Z`).getUTCDay()+6)%7;
  const elapsed=weekday+1;
  const through=week.entries.filter(entry=>entry.date<=day.date);
  const groups=week.groups.map(group=>{
    const actual=through.filter(entry=>entry.groupId===group.id).reduce((sum,entry)=>sum+entry.sets,0);
    return {...group,actual,credited:Math.min(actual,group.target),remaining:Math.max(0,group.target-actual)};
  });
  const target=groups.reduce((sum,group)=>sum+group.target,0);
  const credited=groups.reduce((sum,group)=>sum+group.credited,0);
  const actual=through.reduce((sum,entry)=>sum+entry.sets,0);
  const dailySets=through.filter(entry=>entry.date===day.date).reduce((sum,entry)=>sum+entry.sets,0);
  const planned=day.trainingMode==='rest';
  const unplanned=day.trainingMode==='unplanned-rest';
  const logged=planned||unplanned||dailySets>0;
  const expected=target*elapsed/7;
  const score=planned||!logged||!target?null:credited>=expected?10:Math.min(9.9,Math.round(credited/expected*100)/10);
  const suggestions=groups.filter(group=>group.remaining>0).sort((a,b)=>a.credited/a.target-b.credited/b.target||b.remaining-a.remaining||a.id.localeCompare(b.id)).slice(0,3);
  return {score,logged,excluded:planned||logged&&!target,planned,unplanned,target,credited,actual,dailySets,expected,elapsed,groups,suggestions};
}
