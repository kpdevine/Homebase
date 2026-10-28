// Date-only values never pass through the browser's local timezone.
export function validTaskDate(value) {
  return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
export function taskDates(value, fallback) {
  const dueDate=value.dueDate??null;
  const displayDate=value.displayDate===undefined?fallback:value.displayDate;
  if(dueDate!==null&&!validTaskDate(dueDate))throw new RangeError('Choose a valid due date.');
  if(displayDate!==null&&!validTaskDate(displayDate))throw new RangeError('Choose a valid plan-to-work date, or leave it blank.');
  return {dueDate,displayDate};
}
export function taskState(task) {
  const {taskEvents,...state}=structuredClone(task);
  return state;
}
export function datedTaskForDay(task,sourceDate,date) {
  const event=task.taskEvents.filter(event=>event.date<=date).at(-1);
  if(!event)return null;
  const state=structuredClone(event.value),start=state.displayDate??sourceDate;
  const carries=!!state.dueDate||state.displayDate===null;
  if(date<start||!carries&&date!==start||state.removedOn&&date>=state.removedOn||state.done&&date>state.completedOn)return null;
  return {...state,_taskSource:sourceDate};
}
export function updateDatedTask(task,date,state) {
  const events=task.taskEvents.filter(event=>event.date!==date);
  events.push({date,value:taskState(state)});
  events.sort((a,b)=>a.date.localeCompare(b.date));
  // The latest state is also kept at the root for backward-compatible backups.
  const next={...structuredClone(events.at(-1).value),taskEvents:events};
  for(const key of Object.keys(task))delete task[key];
  Object.assign(task,next);
}
