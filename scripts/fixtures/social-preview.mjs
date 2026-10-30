import {addDays} from '/model.mjs';
import {leaderboardSummary,sharedDays,solarAppearance} from '/social-model.mjs';

export function createSocialPreview(store,today){
  const date=today(),month=date.slice(0,7),yesterday=addDays(date,-1),uid='demo-me';
  const own={uid,username:'sample_you'},group={id:'sample-orbit',groupName:'Northern Lights',owner:uid,ownerUsername:own.username};
  const savedKey='pocket-planet.social-demo.v1';
  let saved;try{saved=JSON.parse(localStorage.getItem(savedKey)||'null');}catch{}
  if(saved?.groupName)group.groupName=saved.groupName;
  let appearance=saved?.appearance||{planet:'happy',vibes:'Making room for the small wins today.',vibesVersion:'sample-you-v1'};
  let outgoing=saved?.outgoing||[],friendIds=saved?.friendIds||['avery','milo'];
  if(!saved){
    const start=addDays(date,-7);
    store.setSettings({...store.getSettings(),setupComplete:true,tabsChosen:true},start);
    for(let offset=7;offset>=1;offset--){
      const day=addDays(date,-offset);store.updateRating(day,6+offset/5);store.setTrainingMode(day,'rest');store.setCreatine(day,true);store.updateSentiments(day,{rating:Math.round((6+offset/4)*10)/10});
      for(const section of ['nutrition','training','checklists','sentiments'])store.confirmSection(day,section);store.completeDay(day);
    }
    store.updateRating(date,8);store.setTrainingMode(date,'rest');store.setCreatine(date,true);store.updateSentiments(date,{rating:7.5});
    store.addTask(yesterday,'Send the application',{displayDate:yesterday});
    store.addTask(date,'Take a walk',{displayDate:date});
    for(const section of ['nutrition','training','checklists','sentiments'])store.confirmSection(date,section);
  }
  const people=[
    {uid:'avery',username:'avery',planet:'sun',vibes:'Sunshine, coffee, and a walk with friends.',monthScore:9.2,daysLogged:24,totalDaysLogged:132,consecutiveStreak:12},
    {uid:'milo',username:'milo',planet:'strong',vibes:'Back to the gym. A little stronger every week.',monthScore:8.7,daysLogged:21,totalDaysLogged:86,consecutiveStreak:5},
    {uid:'leo',username:'leo',planet:'mogging',vibes:'Taking it one day at a time.',monthScore:8.1,daysLogged:19,totalDaysLogged:74,consecutiveStreak:3},
    {uid:'nina',username:'nina',planet:'party',vibes:'Finished a big project! Time to celebrate.',monthScore:9.5,daysLogged:25,totalDaysLogged:164,consecutiveStreak:8}
  ].map((person,index)=>({...person,month,appDate:date,streakEndDate:yesterday,yesterdayDate:yesterday,yesterdayScore:8+index*.4,vibesVersion:'sample-'+person.uid+'-v1'}));
  const graph={avery:[uid,'milo','nina'],milo:[uid,'avery','leo'],leo:['milo','nina'],nina:['avery','leo']};
  const listeners=new Set(),reactions=[{target:'avery',date:yesterday,reactor:'milo',username:'milo',kind:'fire'}];
  let vibeRows=[{target:'avery',reactor:'milo',username:'milo',version:'sample-avery-v1',kind:'love'}];
  const person=id=>id===uid?{...own,...leaderboardSummary(store,today()),...appearance}:people.find(row=>row.uid===id);
  const persist=()=>localStorage.setItem(savedKey,JSON.stringify({appearance,outgoing,friendIds,groupName:group.groupName}));
  function subscribe(get,receive){const entry=()=>receive(structuredClone(get()));listeners.add(entry);queueMicrotask(()=>{if(listeners.has(entry))entry();});return ()=>listeners.delete(entry);}
  const emit=()=>{persist();for(const receive of [...listeners])receive();};
  const days=day=>{
    const current=day===date;
    const ownDay=sharedDays(store,today()).find(row=>row.date===day);
    return [...(ownDay?[{uid,...ownDay}]:[]),...people.filter(row=>row.uid!=='nina').map((row,index)=>({uid:row.uid,date:day,score:current?Math.round((8.4+index*.3)*10)/10:row.yesterdayScore,reviewComplete:current?index===1:true}))];
  };
  const groups={
    watch:receive=>subscribe(()=>({groups:[group],requests:[],invitations:[],primaryId:group.id,groupsLoaded:true,ownedGroupId:group.id,appearance,appearanceReady:true}),receive),
    watchBoard:(id,receive)=>subscribe(()=>[people[0],people[1],people[2],person(uid)],receive),
    watchToday:(id,day,receive)=>subscribe(()=>days(day),receive),
    watchStreakDays:(id,day,receive)=>subscribe(()=>Array.from({length:15},(_,i)=>days(addDays(day,-i))).flat(),receive),
    watchReactions:(id,day,receive)=>subscribe(()=>reactions.filter(row=>row.date===day),receive),
    watchVibesReactions:(id,receive)=>subscribe(()=>vibeRows,receive),
    watchDay:(id,target,day,receive)=>subscribe(()=>({day:days(day).find(row=>row.uid===target)||null,reactions:reactions.filter(row=>row.date===day&&row.target===target)}),receive),
    async saveAppearance(value){const next=solarAppearance(value);appearance={...next,vibesVersion:next.vibes===appearance.vibes?appearance.vibesVersion:'sample-'+crypto.randomUUID()};emit();},
    async react(id,target,day,kind){const index=reactions.findIndex(row=>row.target===target&&row.date===day&&row.reactor===uid);if(index>=0)reactions.splice(index,1);if(kind)reactions.push({target,date:day,reactor:uid,username:own.username,kind});emit();return true;},
    async reactVibes(id,target,version,kind){vibeRows=vibeRows.filter(row=>row.target!==target||row.reactor!==uid);if(kind)vibeRows.push({target,version,reactor:uid,username:own.username,kind});emit();return true;},
    async rename(id,name){group.groupName=name.trim();emit();return group.groupName;},
    async primary(){},async publish(){},
    async invite(){throw new Error('This sample keeps its fixed group members. Friend requests and profiles are interactive.');},
    async remove(){throw new Error('This sample keeps its fixed group members.');},
    async deleteSystem(){throw new Error('This is a sample Solar System.');}
  };
  const client={uid,groups,profile:async()=>own,
    watch:receive=>subscribe(()=>({profile:own,incoming:[],outgoing,friends:friendIds.map(person)}),receive),
    async search(value){return people.filter(row=>row.username.startsWith(String(value).trim().toLowerCase()));},
    async viewProfile(id){const row=person(id);if(!row)return null;return {...row,solarSystems:[{id:id==='nina'?'sample-sunflowers':group.id,name:id==='nina'?'Sunflower Society':group.groupName}],friends:(id===uid?friendIds:graph[id]||[]).map(person).filter(Boolean)};},
    async request(id){if(id===uid||friendIds.includes(id)||outgoing.some(row=>row.recipient===id))return;outgoing.push({id:uid+'~'+id,requester:uid,recipient:id,username:person(id).username});emit();},
    async dismiss(id){outgoing=outgoing.filter(row=>row.id!==id);emit();},
    async remove(id){friendIds=friendIds.filter(value=>value!==id);emit();},
    async publish(){},async publishProfile(){},async rename(){throw new Error('Sample usernames stay fixed.');}
  };
  persist();
  return {social:()=>client,isEnabled:()=>false,status:()=> 'disabled'};
}
