import {addDays} from './model.mjs';

export function weightHistory(snapshot,{unit='lb',through,days=0}) {
  const start=days?addDays(through,1-days):'0000-01-01';
  return snapshot.days.filter(day=>day.bodyWeight&&day.date>=start&&day.date<=through).sort((a,b)=>a.date.localeCompare(b.date)).map(day=>({date:day.date,value:day.bodyWeight.unit===unit?day.bodyWeight.value:unit==='kg'?day.bodyWeight.value/2.2046226218:day.bodyWeight.value*2.2046226218}));
}

export function weightPlot(points) {
  if(!points.length)return null;
  const values=points.map(point=>point.value),low=Math.min(...values),high=Math.max(...values),padding=Math.max((high-low)*.15,1);
  const min=low-padding,max=high+padding,first=Date.parse(points[0].date+'T12:00:00Z'),last=Date.parse(points.at(-1).date+'T12:00:00Z');
  return {min,max,points:points.map(point=>({...point,x:points.length===1?350:70+(Date.parse(point.date+'T12:00:00Z')-first)/(last-first)*560,y:225-(point.value-min)/(max-min)*190}))};
}
