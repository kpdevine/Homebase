import {validateSnapshot} from './persistence.mjs';

export const EMPTY_SNAPSHOT={version:2,days:[],entries:[],targets:[],templates:[],serial:0};
export function canonical(value) {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
export function snapshotRecords(snapshot) {
  const value=validateSnapshot(snapshot),records=new Map([['settings',canonical({type:'settings',version:2,...(value.settings?{settings:value.settings}:{}),...(value.groupCatalog?{groupCatalog:value.groupCatalog}:{})})]]);
  for(const day of value.days)records.set(`day_${day.date}`,canonical({type:'day',day,entries:value.entries.filter(entry=>entry.date===day.date)}));
  for(const template of value.templates)records.set(`routine_${template.id}`,canonical({type:'routine',template}));
  for(const [week,groups] of value.targets)records.set(`targets_${week}`,canonical({type:'targets',week,groups}));
  for(const [id,payload] of records)if(new TextEncoder().encode(payload).length>850000)throw new Error(`The ${id} record is too large to sync. Your local data is still saved.`);
  return records;
}
export function recordsSnapshot(records,serial=0) {
  const result=structuredClone(EMPTY_SNAPSHOT);result.serial=serial;
  for(const [id,payload] of records) {
    const value=JSON.parse(payload);
    if(id==='settings'&&value.type==='settings'&&value.version===2){if(value.settings)result.settings=value.settings;if(value.groupCatalog)result.groupCatalog=value.groupCatalog;continue;}
    if(value.type==='day'&&id===`day_${value.day?.date}`){result.days.push(value.day);result.entries.push(...value.entries);}
    else if(value.type==='routine'&&id===`routine_${value.template?.id}`)result.templates.push(value.template);
    else if(value.type==='targets'&&id===`targets_${value.week}`)result.targets.push([value.week,value.groups]);
    else throw new Error('Cloud data has an unsupported record. Local records were preserved.');
  }
  // Old sequential IDs remain valid; new device-scoped IDs never collide.
  for(const id of [...result.entries.map(entry=>entry.id),...result.templates.flatMap(template=>[template.id,...template.children.map(child=>child.id)]),...result.days.flatMap(day=>day.tasks.flatMap(task=>[task.id,...task.children.map(child=>child.id)]))]) {
    const match=/^(?:task|gym|routine|child)-(\d+)$/.exec(id);if(match)result.serial=Math.max(result.serial,Number(match[1]));
  }
  result.days.sort((a,b)=>a.date.localeCompare(b.date));result.templates.sort((a,b)=>a.id.localeCompare(b.id));result.targets.sort((a,b)=>a[0].localeCompare(b[0]));
  for(const entry of result.days.flatMap(day=>day.draftTrainingEntries||[])){const match=/^gym-(\d+)$/.exec(entry.id);if(match)result.serial=Math.max(result.serial,Number(match[1]));}
  for(const task of result.days.flatMap(day=>day.tasks))for(const event of task.taskEvents||[])for(const id of [event.value.id,...event.value.children.map(child=>child.id)]){const match=/^task-(\d+)$/.exec(id);if(match)result.serial=Math.max(result.serial,Number(match[1]));}
  return validateSnapshot(result);
}
export function recordChanges(base,next) {
  return [...new Set([...base.keys(),...next.keys()])].filter(id=>base.get(id)!==next.get(id)).map(id=>({id,before:base.get(id)??null,after:next.get(id)??null}));
}
export function reconcileRecords(base,local,remote,choice='local',versions={}) {
  const merged=new Map(remote),conflicts=[];
  for(const {id,before,after} of recordChanges(base,local)) {
    const theirs=remote.get(id)??null;
    const conflict=theirs!==before&&theirs!==after;
    let selected=choice;
    if(conflict&&choice==='newest') {
      const mine=versions.local?.get(id),theirsAt=versions.remote?.get(id),now=versions.now??Date.now();
      const valid=at=>Number.isSafeInteger(at)&&at>0&&at<=now+60000;
      // Deletion vs. editing and legacy/equal/invalid times still need a choice.
      selected=after!==null&&theirs!==null&&valid(mine)&&valid(theirsAt)&&mine!==theirsAt?(mine>theirsAt?'local':'cloud'):null;
    }
    if(conflict&&(!selected||choice!=='newest'))conflicts.push(id);
    if(!conflict||selected==='local'){if(after===null)merged.delete(id);else merged.set(id,after);}
  }
  return {merged,conflicts};
}
export function acknowledgeOwnChanges(base,remote,inFlight=[]) {
  const acknowledged=new Map(base);
  for(const change of inFlight)if((remote.get(change.id)??null)===change.after){if(change.after===null)acknowledged.delete(change.id);else acknowledged.set(change.id,change.after);}
  return acknowledged;
}
export function syncBatch(changes) {
  const rank=change=>change.id.startsWith('routine_')?(change.after===null?3:0):change.id.startsWith('targets_')?1:2;
  const sorted=[...changes].sort((a,b)=>rank(a)-rank(b)||a.id.localeCompare(b.id)),batch=[];
  let bytes=0;
  for(const change of sorted){const size=new TextEncoder().encode((change.before||'')+(change.after||'')).length;if(batch.length&&(batch.length>=100||bytes+size>4*1024*1024))break;batch.push(change);bytes+=size;}
  return batch;
}
