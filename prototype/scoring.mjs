import {nutritionScore,settingsForDay} from './customization.mjs';
// A reversible local scoring policy. Keep it independent of rendering/storage.
import { taskProgress } from './tasks.mjs';
import {trainingProgress} from './training.mjs';
import {GROUPS} from './muscles.mjs';
export {localDateKey, timeGreeting} from './day-clock.mjs';
// A slight visual bias toward the top end; logged scores and ring fill stay exact.
function rewardLevel(score) { return 10*(Math.max(0,Math.min(10,score))/10)**1.2; }
export function scoreColor(score) {
  if (score === null || !Number.isFinite(score)) return '#6682b5';
  const value = rewardLevel(score);
  const stops = [[0,[28,40,94]],[3,[52,61,133]],[5,[49,88,168]],[6,[59,123,203]],[7,[114,179,235]],[8,[175,217,248]],[9,[228,248,255]],[10,[248,253,255]]];
  const index=Math.min(stops.length-2,stops.findIndex((stop,i)=>i<stops.length-1&&value<=stops[i+1][0]));
  const [start,from]=stops[index],[end,to]=stops[index+1],amount=(value-start)/(end-start);
  return '#'+from.map((part,channel)=>Math.round(part+(to[channel]-part)*amount).toString(16).padStart(2,'0')).join('');
}

export function scoreGlow(score) { return score===null || !Number.isFinite(score)?0:Math.round((rewardLevel(score)/10)**4*700)/100; }

export function scoreReward(score) {
  return typeof score!=='number' || !Number.isFinite(score) || score<9.2 ? '' : score>=10 ? 'score-high score-perfect' : 'score-high';
}

export function summarizeDay(day, trainingEntries = [], week) {
  const {done,total} = taskProgress(day.tasks);
  const touched=day.checklistTouched??total>0;
  const checklist = total && touched ? done / total * 10 : day.reviewed.checklists ? 10 : null;
  const nutrition=nutritionScore(day);
  const training = trainingProgress(day,week||{groups:GROUPS,entries:trainingEntries});
  const sections = [
    { id: 'nutrition', label: 'Nutrition', score: nutrition, detail: nutrition === null ? 'Not logged yet' : `${nutrition.toFixed(2).replace(/(\.\d)0$/, '$1')} out of 10` },
    { id: 'training', label: 'Daily training', score: training.score, logged:training.logged, excluded:training.excluded,
      detail:training.mode==='other'?(training.rest?`Rest day · ${training.restCredits}/${training.restAllowance} credits left`:training.logged?`${training.minutes} / ${training.minuteGoal} minutes · ${training.activity}`:'Log training or rest'):training.logged&&!training.target?training.tracksCreatine?'Creatine only · no set targets':'No targets · not scored':training.rest?`${training.goalsComplete?'Goals met':training.restCreditUsed?'Rest day covered':'Rest allowance used up'} · ${training.restCredits}/${training.restAllowance} left`:training.logged?`${training.useful} goal set${training.useful===1?"":"s"}${training.nonUseful?` · ${training.nonUseful} non-goal set${training.nonUseful===1?"":"s"}`:""}`:'Answer lifting or rest' },
    { id: 'checklists', label: 'To-do list', score: checklist, detail: total ? `${done} of ${total} done${touched?'':' · not checked in'}` : day.reviewed.checklists ? 'No tasks due · reviewed' : 'No tasks yet' },
  ];
  const requiredLogged=sections.filter(section=>section.logged??section.score!==null).length;
  if(settingsForDay(day).sentiments.rating!=='hidden' && day.sentiments?.rating!==null && day.sentiments?.rating!==undefined) sections.push({id:'sentiments',label:'Sentiments',score:day.sentiments.rating,detail:`${day.sentiments.rating.toFixed(1)} out of 10 · optional`,optional:true});
  const available = sections.filter(section => section.score !== null);
  const score = available.length ? Math.round(available.reduce((sum, section) => sum + section.score, 0) / available.length * 10) / 10 : null;
  return { score, sections, logged: requiredLogged+(sections.some(section=>section.id==='sentiments')?1:0), requiredLogged, provisional: requiredLogged<3, done, total };
}

export function taskScoreRange(summary) {
  if(!summary.total||summary.done===summary.total)return {score:summary.score,low:summary.score,projected:false};
  const withTasks=score=>{
    const values=summary.sections.map(section=>section.id==='checklists'?score:section.score).filter(value=>value!==null);
    return Math.round(values.reduce((sum,value)=>sum+value,0)/values.length*10)/10;
  };
  return {score:withTasks(10),low:withTasks(summary.done/summary.total*10),projected:true};
}

export function categorySummary(summary, category='all') {
  return category==='all'?summary:{...summary,score:summary.sections.find(section=>section.id===category)?.score??null,provisional:false};
}

export function averageDays(dates, getSummary) {
  const values = dates.map(getSummary).filter(day => day.score !== null);
  return { score:values.length ? Math.round(values.reduce((sum, day) => sum + day.score, 0) / values.length * 10) / 10 : null,
    count:values.length, total:dates.length, provisional:values.length < dates.length || values.some(day => day.provisional) };
}

export function loggingStreak(today,getSummary) {
  const previous=date=>{const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()-1);return value.toISOString().slice(0,10);};
  const fullyLogged=date=>{const summary=getSummary(date);return (summary.requiredLogged??summary.logged)===3;};
  const includesToday=fullyLogged(today);
  let date=includesToday?today:previous(today),count=0;
  while(count<20000 && fullyLogged(date)) {count++;date=previous(date);}
  return {count,includesToday,endDate:count?(includesToday?today:previous(today)):null};
}
