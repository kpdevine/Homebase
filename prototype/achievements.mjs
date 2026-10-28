import {addDays, sampleWeekStart} from './model.mjs';
import {summarizeDay,fullyLogged} from './scoring.mjs';
import {trainingProgress} from './training.mjs';

export function streakStats(dates,today,block=1) {
  const ordered=[...new Set(dates.filter(date=>date<=today))].sort(),runs=[];
  for(const date of ordered) {
    const run=runs.at(-1);
    if(run&&addDays(run.end,1)===date){run.end=date;run.length++;}
    else runs.push({start:date,end:date,length:1});
  }
  const last=runs.at(-1),active=last&&(last.end===today||last.end===addDays(today,-1));
  const earnedRuns=runs.filter(run=>run.length>=block),latest=earnedRuns.at(-1);
  return {current:active?last.length:0,best:Math.max(0,...runs.map(run=>run.length)),
    count:runs.reduce((sum,run)=>sum+Math.floor(run.length/block),0),
    latest:latest?addDays(latest.start,Math.floor(latest.length/block)*block-1):null,
    includesToday:!!active&&last.end===today};
}

// Read-only derivation from synced records. Editing, restoring, or resetting history
// updates badges without a second source of truth or extra cloud writes.
export function buildAchievements(store,today) {
  const snapshot=store.exportSnapshot(),weeks=new Map();
  const weekFor=date=>{const key=sampleWeekStart(date);if(!weeks.has(key))weeks.set(key,store.loadWeek(date));return weeks.get(key);};
  const records=snapshot.days.filter(day=>day.date<=today).sort((a,b)=>a.date.localeCompare(b.date)).map(record=>{
    const day=store.loadDay(record.date);
    const week=weekFor(day.date);
    return {day,date:day.date,summary:summarizeDay(day,week.entries,week),training:trainingProgress(day,week)};
  });
  const completed=records.filter(record=>record.day.completedAt&&!record.summary.provisional);
  const countedActions=new Set();
  for(const record of completed){
    const actions=record.day.tasks.flatMap(task=>task.children.length?task.children:[task]).filter(task=>task.done&&!countedActions.has(task.id));
    record.newTaskActions=actions.length;for(const task of actions)countedActions.add(task.id);
  }
  const score=(record,id)=>record.summary.sections.find(section=>section.id===id)?.score??null;
  const lifting=completed.filter(record=>record.training.dailySets>0&&!record.training.rest);
  const written=completed.filter(record=>record.day.sentiments.notes.trim());
  const cards=[];
  function daily(id,group,title,description,source,predicate,value,target,unit='score') {
    const matches=source.filter(predicate);
    cards.push({id,group,title,description,count:matches.length,first:matches[0]?.date??null,latest:matches.at(-1)?.date??null,value,target,unit});
  }
  function milestone(id,group,title,description,source,target,amount=()=>1,unit='days') {
    let value=0,latest=null;
    for(const record of source) {value+=amount(record);if(!latest&&value>=target)latest=record.date;}
    cards.push({id,group,title,description,count:value>=target?1:0,first:latest,latest,value,target,unit});
  }
  for(const [target,title] of [[1,'First day home'],[3,'Finding your rhythm'],[7,'A week in the books'],[14,'Two weeks rooted'],[30,'Thirty days stronger'],[60,'Built to last'],[100,'The hundred club'],[180,'Half-year habit'],[365,'A year at home']])
    milestone(`completed-${target}`,'overall',title,`Complete ${target} full day review${target===1?'':'s'}.`,completed,target);
  const bestOverall=Math.max(0,...completed.map(record=>record.summary.score??0));
  for(const [target,title] of [[8,'A strong day'],[9,'Standout day'],[9.5,'Nearly flawless'],[10,'Perfect day']])
    daily(`overall-${target}`,'overall',title,`Finish a day with an overall score of ${target}${target<10?'+':''}.`,completed,record=>record.summary.score>=target,bestOverall,target);
  for(const [group,source,label] of [['nutrition',completed,'Nutrition'],['training',lifting,'Gym']]) {
    const best=Math.max(0,...source.map(record=>score(record,group)??0));
    for(const [target,title] of [[8,group==='nutrition'?'Steady fuel':'Productive session'],[9,`${label} on point`],[9.5,group==='nutrition'?'Dialed in':'Peak session'],[10,`${label} perfection`]])
      daily(`${group}-${target}`,group,title,`${target}${target<10?'+':''}/10 ${group==='training'?'on a lifting day with sets logged':'for nutrition'}, with the full day review complete.`,source,record=>score(record,group)!==null&&score(record,group)>=target,best,target);
  }
  for(const target of [50,100,250,500,1000,2500])
    milestone(`goal-sets-${target}`,'training',`${target.toLocaleString('en-US')} goal sets`,`Log ${target.toLocaleString('en-US')} sets toward unmet muscle goals, across completed days.`,completed,target,record=>record.training.useful||0,'sets');
  const actionable=completed.filter(record=>record.summary.total>0);
  daily('tasks-perfect','checklists','Clean slate','Complete every to-do action and finish the full day review.',actionable,record=>record.summary.done===record.summary.total,
    Math.max(0,...actionable.map(record=>record.summary.done/record.summary.total*10)),10);
  for(const target of [10,50,100,500,1000])
    milestone(`tasks-${target}`,'checklists',`${target} things done`,`Check off ${target} actions across completed days. Subtasks count once; their parent adds no extra credit.`,completed,target,record=>record.newTaskActions,'actions');
  daily('journal-day','sentiments','Put it into words','Write sentiments and finish the full day review.',written,()=>true,written.length,1,'days');
  for(const [target,title] of [[3,'Opening pages'],[10,'Ten chapters'],[30,'A month in words'],[100,'Your own anthology']])
    milestone(`journal-${target}`,'sentiments',title,`Write sentiments on ${target} completed days.`,written,target);
  const sentimentDays=completed.filter(record=>score(record,'sentiments')!==null);
  daily('sentiments-9','sentiments','A day to remember','Rate your sentiments 9+ and finish the full day review.',sentimentDays,record=>score(record,'sentiments')>=9,
    Math.max(0,...sentimentDays.map(record=>score(record,'sentiments'))),9);
  const loggedDates=records.filter(record=>fullyLogged(record.summary)).map(record=>record.date),strongDates=completed.filter(record=>record.summary.score>=9).map(record=>record.date);
  for(const [type,dates,blocks,label] of [['logging',loggedDates,[3,7,14,30,60],'days with all three required categories logged'],['strong',strongDates,[3,7,14],'completed days scoring 9+']]) {
    for(const target of blocks) {
      const streak=streakStats(dates,today,target);
      cards.push({id:`streak-${type}-${target}`,group:'streaks',title:type==='logging'?`${target} logged days in a row`:`${target} days at 9+ in a row`,
        description:`Earn once for each full ${target}-day block of consecutive ${label}.`,count:streak.count,first:firstStreakDate(dates,today,target),latest:streak.latest,value:streak.current,target,unit:'days',streak});
    }
  }
  const byWeek=new Map();
  for(const record of completed) {const key=sampleWeekStart(record.date);if(!byWeek.has(key))byWeek.set(key,[]);byWeek.get(key).push(record);}
  const fullWeeks=[],consistentWeeks=[];
  for(const [start,days] of byWeek) {
    if(days.length>=5)consistentWeeks.push({date:days[4].date});
    const goals=weekFor(start).groups.filter(group=>group.target>0),totals=new Map();let earned=null;
    for(const record of days) {
      for(const entry of snapshot.entries.filter(entry=>entry.date===record.date))totals.set(entry.groupId,(totals.get(entry.groupId)||0)+entry.sets);
      if(!earned&&goals.length&&goals.every(group=>(totals.get(group.id)||0)>=group.target))earned=record.date;
    }
    if(earned)fullWeeks.push({date:earned});
  }
  daily('weekly-goals','training','Every muscle accounted for','Meet every nonzero weekly muscle goal using sets from completed days. Once per Monday–Sunday week.',fullWeeks,()=>true,fullWeeks.length,1,'weeks');
  daily('weekly-five','overall','Show up all week','Complete at least five day reviews in a Monday–Sunday week. Once per week.',consistentWeeks,()=>true,
    Math.max(0,...[...byWeek.values()].map(days=>days.length)),5,'days');
  return {cards,unlocked:cards.filter(card=>card.count>0).length,total:cards.length,earned:cards.reduce((sum,card)=>sum+card.count,0),completed:completed.length,
    streaks:{logging:streakStats(loggedDates,today),strong:streakStats(strongDates,today)}};
}

export function firstStreakDate(dates,today,block) {
  const ordered=[...new Set(dates.filter(date=>date<=today))].sort();
  return ordered.find((date,index)=>index>=block-1&&ordered[index-block+1]===addDays(date,1-block))??null;
}
export function sortAchievements(cards,order='recent') {
  return [...cards].sort((a,b)=>Number(b.count>0)-Number(a.count>0)||
    (order==='first'?(a.first??'9999').localeCompare(b.first??'9999'):(b.latest??'').localeCompare(a.latest??''))||a.id.localeCompare(b.id));
}
export function firstAchievementUnlocks(before,after,{date,notified=[]}={}) {
  const seen=new Set(notified),previous=new Map(before.cards.map(card=>[card.id,card]));
  return after.cards.filter(card=>card.count>0&&!seen.has(card.id)&&
    ((previous.get(card.id)?.count??0)===0||card.id.startsWith('streak-logging-')&&card.first===date));
}
