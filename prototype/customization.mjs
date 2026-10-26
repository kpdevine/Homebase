import {GROUPS} from './muscles.mjs';

export const DEFAULT_SETTINGS={version:1,setupComplete:false,effectiveFrom:'0000-00-00',nutrition:{mode:'vibes',proteinGoal:150,calorieGoal:2200},training:{mode:'gym',activity:'Training',minuteGoal:30,flexDays:2,creatine:true,groups:GROUPS.map(group=>({...group}))},sentiments:{rating:'optional'},tasks:{defaultDate:'today',expandSubtasks:false}};
const fail=message=>{throw new Error(message);};
export const LOGGING_SECTIONS=[{id:'nutrition',label:'Nutrition'},{id:'training',label:'Training'},{id:'checklists',label:'To-do list'},{id:'sentiments',label:'Sentiments'},{id:'sleep',label:'Sleep'},{id:'prayer',label:'Prayer'}];
export const DEFAULT_MODULE_ORDER=['checklists','nutrition','training','sentiments','sleep','prayer'];
export function orderedModules(settings){return settings.moduleOrder.map(id=>LOGGING_SECTIONS.find(section=>section.id===id));}
const legacyTabs={nutrition:true,training:true,checklists:true,sentiments:true,sleep:false,prayer:false};
// Existing snapshots keep their four original sections. Fresh workspaces start
// with the basic to-do list, then choose their other sections during setup.
export function newUserSettings(){return normalizeSettings({...DEFAULT_SETTINGS,tabs:{...legacyTabs,nutrition:false,training:false,sentiments:false}});}
export function enabledSections(day){const tabs=settingsForDay(day).tabs;return LOGGING_SECTIONS.filter(section=>tabs[section.id]);}
export function timeScore(day,id){const minutes=day[id]?.minutes;return minutes===null||minutes===undefined?null:Math.round(Math.min(10,minutes/settingsForDay(day)[id].goalMinutes*10)*10)/10;}
export function normalizeSettings(input=DEFAULT_SETTINGS) {
  const n=input?.nutrition,t=input?.training,s=input?.sentiments,tasks=input?.tasks||{defaultDate:'today',expandSubtasks:false};
  const tabs=input?.tabs??legacyTabs,sleep=input?.sleep??{goalMinutes:480},prayer=input?.prayer??{goalMinutes:15};
  const moduleOrder=input?.moduleOrder??DEFAULT_MODULE_ORDER;
  if(!Array.isArray(moduleOrder)||moduleOrder.length!==LOGGING_SECTIONS.length||new Set(moduleOrder).size!==LOGGING_SECTIONS.length||moduleOrder.some(id=>!DEFAULT_MODULE_ORDER.includes(id)))fail('Choose each module once in your module order.');
  if(!tabs||LOGGING_SECTIONS.some(({id})=>typeof tabs[id]!=='boolean')||Object.keys(tabs).some(id=>!Object.hasOwn(legacyTabs,id)))fail('Choose valid modules.');
  for(const value of [sleep,prayer])if(!value||!Number.isInteger(value.goalMinutes)||value.goalMinutes<1||value.goalMinutes>1440)fail('Use a time goal of 1–1440 minutes.');
  if(!['today','tomorrow'].includes(tasks.defaultDate)||typeof tasks.expandSubtasks!=='boolean')fail('Choose valid to-do list defaults.');
  if(!n||!t||!s||!['vibes','macros'].includes(n.mode)||!['gym','other'].includes(t.mode)||!['required','optional','hidden'].includes(s.rating))fail('Choose valid logging settings.');
  if(!Number.isFinite(n.proteinGoal)||n.proteinGoal<1||n.proteinGoal>1000||!Number.isFinite(n.calorieGoal)||n.calorieGoal<1||n.calorieGoal>20000)fail('Enter positive protein and calorie goals.');
  if(typeof t.activity!=='string'||!t.activity.trim()||t.activity.trim().length>50||!Number.isInteger(t.minuteGoal)||t.minuteGoal<1||t.minuteGoal>1440||!Number.isInteger(t.flexDays)||t.flexDays<0||t.flexDays>7||typeof t.creatine!=='boolean')fail('Use a minute goal of 1–1440 and 0–7 flex days.');
  if(!Array.isArray(t.groups)||!t.groups.length||t.groups.length>24||new Set(t.groups.map(g=>g.id)).size!==t.groups.length||t.groups.some(g=>!g||typeof g.id!=='string'||!/^[a-z][a-z0-9_-]{0,49}$/.test(g.id)||typeof g.name!=='string'||!g.name.trim()||g.name.trim().length>50||!Number.isInteger(g.target)||g.target<0||g.target>20))fail('Use 1–24 unique training groups with whole targets from 0–20.');
  if(input.effectiveFrom!==undefined&&!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom))fail('Invalid settings date.');
  return {moduleOrder:[...moduleOrder],tabsChosen:input.tabsChosen===true,tabs:{...tabs},sleep:{goalMinutes:sleep.goalMinutes},prayer:{goalMinutes:prayer.goalMinutes},tasks:{defaultDate:tasks.defaultDate,expandSubtasks:tasks.expandSubtasks},version:1,setupComplete:input.setupComplete===true,effectiveFrom:input.effectiveFrom||'0000-00-00',nutrition:{mode:n.mode,proteinGoal:n.proteinGoal,calorieGoal:n.calorieGoal},training:{mode:t.mode,activity:t.activity.trim(),minuteGoal:t.minuteGoal,flexDays:t.flexDays,creatine:t.creatine,groups:t.groups.map(g=>({id:g.id,name:g.name.trim(),target:g.target}))},sentiments:{rating:s.rating}};
}
export function settingsForDay(day){return day.configuration?normalizeSettings(day.configuration):normalizeSettings();}
export function nutritionScore(day){
  const settings=settingsForDay(day).nutrition;
  if(settings.mode==='vibes')return day.nutrition??null;
  const {protein,calories}=day.food||{};
  if(protein===null||protein===undefined||calories===null||calories===undefined)return null;
  return Math.round((Math.min(1,protein/settings.proteinGoal)+Math.min(1,calories===0?1:settings.calorieGoal/calories))*50)/10;
}
export function trainingReady(day,entries=[]){
  const config=settingsForDay(day).training;
  if(day.trainingMode==='alternate')return typeof day.alternateWorkout==='string'&&!!day.alternateWorkout.trim();
  const attendance=['training','rest','unplanned-rest','rest-unclassified'].includes(day.trainingMode);
  return attendance&&(config.mode!=='other'||day.trainingMode!=='training'||typeof day.trainingMinutes==='number');
}
export function sentimentReady(day){return settingsForDay(day).sentiments.rating!=='required'||day.sentiments?.rating!==null&&day.sentiments?.rating!==undefined;}
