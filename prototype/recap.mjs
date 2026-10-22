import {settingsForDay} from './customization.mjs';
import {summarizeDay} from './scoring.mjs';
import {orderedTasks} from './tasks.mjs';

// Read-only presentation data. Opening a recap must never create a check-in.
export function dailyRecap(day, entries=[], week) {
  const summary=summarizeDay(day,entries,week);
  const groups=new Map();
  for(const entry of entries)groups.set(entry.groupId,(groups.get(entry.groupId)||0)+entry.sets);
  const notes=['nutrition','training'].filter(section=>day.notes[section].trim()).map(section=>({section,text:day.notes[section]}));
  return {
    ...summary,
    completed:!!day.completedAt,
    reviewed:Object.values(day.reviewed).filter(Boolean).length,
    state:day.completedAt?'Day complete':summary.requiredLogged===3?'All categories logged':summary.logged?'Partly logged':'Not logged',
    hasActivity:summary.logged>0||notes.length>0||!!day.sentiments?.notes.trim()||!!day.bodyWeight,
    bodyWeight:day.bodyWeight?{...day.bodyWeight}:null,
    checklistLogged:summary.sections.find(section=>section.id==='checklists').score!==null,
    tasks:orderedTasks(day.tasks).map(task=>({name:task.name,done:task.done,recurring:!!task.templateId,children:(task.children||[]).map(child=>({name:child.name,done:child.done}))})),
    training:{mode:settingsForDay(day).training.mode,minutes:day.trainingMinutes??null,creatine:settingsForDay(day).training.creatine?day.creatine:undefined,rest:['rest','unplanned-rest','rest-unclassified'].includes(day.trainingMode),planned:day.trainingMode==='rest',unplanned:day.trainingMode==='unplanned-rest',score:summary.sections.find(section=>section.id==='training').score,sets:entries.reduce((sum,entry)=>sum+entry.sets,0),groups:settingsForDay(day).training.mode==='other'?[]:[...groups].map(([id,sets])=>({id,sets}))},
    notes,
  };
}
