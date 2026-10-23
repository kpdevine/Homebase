import {addDays} from './model.mjs';
import {summarizeDay,fullyLogged} from './scoring.mjs';
export function username(value){const name=String(value||'').trim().toLowerCase();if(!/^[a-z][a-z0-9_]{2,19}$/.test(name))throw new Error('Use 3–20 letters, numbers or underscores, starting with a letter.');return name;}
export function groupName(value){const name=String(value||'').trim().replace(/\s+/g,' ');if(name.length<3||name.length>40)throw new Error('Use a Solar System name between 3 and 40 characters.');return name;}

export function leaderboardSummary(store,today){
  const yesterday=addDays(today,-1),month=today.slice(0,7),days=store.exportSnapshot().days.filter(day=>day.date<=today),logged=[];
  for(const day of days){const summary=summarizeDay(store.loadDay(day.date),store.loadTrainingDay(day.date),store.loadWeek(day.date));if(fullyLogged(summary)&&summary.score!==null)logged.push({date:day.date,score:summary.score});}
  const monthly=logged.filter(day=>day.date.startsWith(month));
  return {appDate:today,month,yesterdayDate:yesterday,yesterdayScore:logged.find(day=>day.date===yesterday)?.score??null,monthScore:monthly.length?Math.round(monthly.reduce((sum,day)=>sum+day.score,0)/monthly.length*10)/10:null,daysLogged:monthly.length,totalDaysLogged:logged.length};
}
export function rankLeaderboard(rows,month){return [...rows].sort((a,b)=>((b.month===month?b.monthScore:null)??-1)-((a.month===month?a.monthScore:null)??-1)||(b.month===month?b.daysLogged:0)-(a.month===month?a.daysLogged:0)||a.username.localeCompare(b.username));}
export function monthlyRanks(rows,month){
  const ranked=rankLeaderboard(rows,month).filter(row=>row.month===month&&Number.isFinite(row.monthScore)&&row.daysLogged>0);
  return new Map(ranked.map((row,index)=>[row.uid,index+1]));
}
export function dayReactionCounts(reactions,target,date){return REACTIONS.map(reaction=>({...reaction,count:reactions.filter(value=>value.target===target&&value.date===date&&value.kind===reaction.id).length})).filter(reaction=>reaction.count);}

export const REACTIONS=[
  {id:'happy',label:'Happy planet',short:'Happy'},
  {id:'sad',label:'Sad planet',short:'Sad'},
  {id:'party',label:'Celebration',short:'Party'},
  {id:'fire',label:'On fire',short:'On fire'},
  {id:'sun',label:'Cool sunshine',short:'Cool'},
  {id:'love',label:'Love',short:'Love'},
  {id:'wow',label:'Amazed',short:'Wow'},
  {id:'sleepy',label:'Sleepy',short:'Sleepy'},
  {id:'strong',label:'Feeling strong',short:'Strong'},
  {id:'rocket',label:'Blastoff',short:'Blastoff'},
  {id:'martian',label:'Friendly Martian',short:'Martian'},
  {id:'distorted',label:'Distorted shock',short:'Shocked'},
  {id:'laughing',label:'Laughing',short:'Laughing'},
  {id:'crying',label:'Crying',short:'Crying'},
  {id:'angry',label:'Frustrated',short:'Frustrated'},
  {id:'thinking',label:'Thinking',short:'Thinking'},
  {id:'wink',label:'Winking',short:'Wink'},
  {id:'salute',label:'Saluting',short:'Salute'},
  {id:'grateful',label:'Grateful',short:'Grateful'},
  {id:'melting',label:'Melting',short:'Melting'},
  {id:'nerd',label:'Feeling smart',short:'Smart'},
  {id:'kiss',label:'Blowing a kiss',short:'Kiss'}
];
export function solarAppearance({planet='happy',vibes=''}={}) {
  if(!REACTIONS.some(reaction=>reaction.id===planet))throw new Error('Choose a planet profile picture.');
  if(typeof vibes!=='string'||vibes.trim().length>160)throw new Error('Keep your current vibes to 160 characters.');
  return {planet,vibes:vibes.trim()};
}
export function solarMonthStats(members,month){
  const current=members.filter(member=>member.month===month&&Number.isFinite(member.monthScore)&&member.daysLogged>0);
  const logs=current.reduce((sum,member)=>sum+member.daysLogged,0);
  return {logs,average:logs?Math.round(current.reduce((sum,member)=>sum+member.monthScore*member.daysLogged,0)/logs*10)/10:null};
}
export function sharedDays(store,today){return store.exportSnapshot().days.filter(day=>day.date<=today&&day.date>=addDays(today,-34)).map(day=>{const summary=summarizeDay(store.loadDay(day.date),store.loadTrainingDay(day.date),store.loadWeek(day.date));return {date:day.date,score:summary.score,logged:fullyLogged(summary)};}).filter(day=>day.logged&&day.score!==null).map(({date,score})=>({date,score}));}
