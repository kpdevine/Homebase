import {addDays} from './model.mjs';
import {summarizeDay} from './scoring.mjs';
export function username(value){const name=String(value||'').trim().toLowerCase();if(!/^[a-z][a-z0-9_]{2,19}$/.test(name))throw new Error('Use 3–20 letters, numbers or underscores, starting with a letter.');return name;}
export function leaderboardSummary(store,today){
  const yesterday=addDays(today,-1),month=today.slice(0,7),days=store.exportSnapshot().days.filter(day=>day.date<=today),logged=[];
  for(const day of days){const summary=summarizeDay(store.loadDay(day.date),store.loadTrainingDay(day.date),store.loadWeek(day.date));if(summary.requiredLogged===3&&summary.score!==null)logged.push({date:day.date,score:summary.score});}
  const monthly=logged.filter(day=>day.date.startsWith(month));
  return {appDate:today,month,yesterdayDate:yesterday,yesterdayScore:logged.find(day=>day.date===yesterday)?.score??null,monthScore:monthly.length?Math.round(monthly.reduce((sum,day)=>sum+day.score,0)/monthly.length*10)/10:null,daysLogged:monthly.length,totalDaysLogged:logged.length};
}
export function rankLeaderboard(rows,month){return [...rows].sort((a,b)=>((b.month===month?b.monthScore:null)??-1)-((a.month===month?a.monthScore:null)??-1)||(b.month===month?b.daysLogged:0)-(a.month===month?a.daysLogged:0)||a.username.localeCompare(b.username));}
