// Recurrence is calculated on calendar dates; merely viewing a day never logs it.
export const FREQUENCIES = ['daily', 'weekdays', 'weekly', 'custom'];
export function orderedTasks(tasks) { return [...tasks].sort((a,b)=>Number(!!a.templateId)-Number(!!b.templateId)); }
// Stopped/old schedule versions remain in history, never in the active manager.
export function activeTemplates(templates,today) { return templates.filter(template=>!template.endDate||template.endDate>today); }
export const weekday = date => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7 + 1;
export function isDue(template, date) {
  if (date < template.startDate || template.endDate && date > template.endDate) return false;
  const day = weekday(date);
  return template.frequency === 'daily' || template.frequency === 'weekdays' && day <= 5 || template.frequency === 'weekly' && day === weekday(template.startDate) || template.frequency === 'custom' && template.weekdays.includes(day);
}
export function occurrence(template, date) {
  const id = `repeat-${template.id}-${date}`;
  return { id, name:template.name, done:false, templateId:template.id,
    children:template.children.map(child => ({ id:`${id}-${child.id}`, name:child.name, done:false, children:[] })) };
}
export function taskProgress(tasks) {
  const actions = tasks.flatMap(task => task.children?.length ? task.children : [task]);
  return { done:actions.filter(task => task.done).length, total:actions.length };
}
export function scheduleLabel(template) {
  const names = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return template.frequency === 'daily' ? 'Every day' : template.frequency === 'weekdays' ? 'Weekdays' : template.frequency === 'weekly' ? `Every ${names[weekday(template.startDate)-1]}` : template.weekdays.map(day => names[day-1]).join(', ');
}
