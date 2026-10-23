import {collection,doc,getDoc,getDocs,query,where,orderBy,startAt,endAt,limit,onSnapshot,runTransaction,writeBatch,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import {username,groupName,REACTIONS,solarAppearance} from './social-model.mjs';

export function socialClient(db,uid){
  const profile=doc(db,'publicProfiles',uid);
  return {
    uid,
    groups:groupClient(db,uid),
    async profile(){const snapshot=await getDoc(profile);return snapshot.exists()?snapshot.data():null;},
    async claim(value){const name=username(value),handle=doc(db,'handles',name);return runTransaction(db,async tx=>{const [existing,own]=await Promise.all([tx.get(handle),tx.get(profile)]);if(own.exists())return own.data();if(existing.exists())throw new Error('That username is taken. Try another.');const data={uid,username:name,createdAt:serverTimestamp()};tx.set(handle,data);tx.set(profile,data);return {uid,username:name};});},
    async search(value){const prefix=String(value||'').trim().toLowerCase();if(!/^[a-z][a-z0-9_]{0,19}$/.test(prefix))return [];const result=await getDocs(query(collection(db,'handles'),orderBy('username'),startAt(prefix),endAt(prefix+'\uf8ff'),limit(10)));return result.docs.map(item=>item.data()).filter(item=>item.uid!==uid);},
    async request(friend){if(friend===uid)throw new Error('Choose another person.');const id=uid+'~'+friend,ref=doc(db,'friendRequests',id);await runTransaction(db,async tx=>{const previous=await tx.get(ref);if(previous.exists())return;tx.set(ref,{requester:uid,recipient:friend,status:'pending',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});});},
    async accept(id){const ref=doc(db,'friendRequests',id);await runTransaction(db,async tx=>{const snapshot=await tx.get(ref);if(!snapshot.exists()||snapshot.data().recipient!==uid||snapshot.data().status!=='pending')throw new Error('This request is no longer available.');const request=snapshot.data();tx.update(ref,{status:'accepted',updatedAt:serverTimestamp()});for(const [owner,friend] of [[uid,request.requester],[request.requester,uid]])tx.set(doc(db,'friendships',owner,'friends',friend),{owner,friend,requestId:id,createdAt:serverTimestamp()});});},
    async dismiss(id){const batch=writeBatch(db);batch.delete(doc(db,'friendRequests',id));await batch.commit();},
    async remove(friend){const batch=writeBatch(db);batch.delete(doc(db,'friendships',uid,'friends',friend));batch.delete(doc(db,'friendships',friend,'friends',uid));for(const id of [uid+'~'+friend,friend+'~'+uid]){const ref=doc(db,'friendRequests',id);if((await getDoc(ref)).exists())batch.delete(ref);}await batch.commit();},
    async publish(name,summary){await setDoc(doc(db,'socialScores',uid),{uid,username:name,...summary,updatedAt:serverTimestamp()});},
    watch(receive,error){
      let incoming=[],outgoing=[],friends=[],scores=new Map(),profiles=new Map(),friendStops=[];
      const emit=()=>receive({incoming:incoming.map(item=>({...item,username:profiles.get(item.requester)||'Loading…'})),outgoing:outgoing.map(item=>({...item,username:profiles.get(item.recipient)||'Loading…'})),friends:friends.map(id=>({uid:id,username:profiles.get(id)||scores.get(id)?.username||'Loading…',...scores.get(id)}))});
      const names=async ids=>{await Promise.all([...new Set(ids)].filter(id=>!profiles.has(id)).map(async id=>{const result=await getDoc(doc(db,'publicProfiles',id));profiles.set(id,result.data()?.username||'Member');}));emit();};
      const stops=[onSnapshot(query(collection(db,'friendRequests'),where('recipient','==',uid)),snapshot=>{incoming=snapshot.docs.filter(d=>d.data().status==='pending').map(d=>({id:d.id,...d.data()}));names(incoming.map(r=>r.requester)).catch(error);emit();},error),onSnapshot(query(collection(db,'friendRequests'),where('requester','==',uid)),snapshot=>{outgoing=snapshot.docs.filter(d=>d.data().status==='pending').map(d=>({id:d.id,...d.data()}));names(outgoing.map(r=>r.recipient)).catch(error);emit();},error),onSnapshot(collection(db,'friendships',uid,'friends'),snapshot=>{
        friendStops.forEach(stop=>stop());friends=snapshot.docs.map(d=>d.id);scores=new Map();names(friends).catch(error);
        friendStops=friends.map(id=>onSnapshot(doc(db,'socialScores',id),value=>{if(value.exists())scores.set(id,value.data());emit();},error));emit();
      },error)];return ()=>{stops.forEach(stop=>stop());friendStops.forEach(stop=>stop());};
    },
  };
}

// Group summaries live under the group, separately from private day records and
// day reactions. Membership requires an approved request or accepted invite.
export function groupClient(db,uid){
  const memberRef=(id,user=uid)=>doc(db,'friendGroups',id,'members',user);
  const indexRef=(id,user=uid)=>doc(db,'groupMemberships',user,'groups',id);
  const scoreRef=(id,user=uid)=>doc(db,'friendGroups',id,'scores',user);
  const prefs=doc(db,'socialPreferences',uid);
  async function identity(){const value=(await getDoc(doc(db,'publicProfiles',uid))).data();if(!value)throw new Error('Choose your username first.');return value;}
  function addMember(batch,group,user,name){
    batch.set(memberRef(group.id,user),{uid:user,username:name,joinedAt:serverTimestamp()});
    batch.set(indexRef(group.id,user),{groupId:group.id,groupName:group.name,owner:group.owner,ownerUsername:group.ownerUsername,joinedAt:serverTimestamp()});
  }
  return {
    async create(value){const name=groupName(value),own=await identity(),ref=doc(collection(db,'friendGroups')),group={id:ref.id,name,owner:uid,ownerUsername:own.username};
      const ownership=doc(db,'solarOwnership',uid);
      if((await getDoc(ownership)).exists()||!(await getDocs(query(collection(db,'groupDirectory'),where('owner','==',uid),limit(1)))).empty)throw new Error('You can create one Solar System. You can still join others.');
      const batch=writeBatch(db);batch.set(ref,{name,owner:uid,ownerUsername:own.username,createdAt:serverTimestamp()});
      batch.set(ownership,{owner:uid,groupId:ref.id,createdAt:serverTimestamp()});
      batch.set(doc(db,'groupDirectory',ref.id),{groupId:ref.id,name,searchName:name.toLowerCase(),owner:uid,ownerUsername:own.username,createdAt:serverTimestamp()});
      addMember(batch,group,uid,own.username);batch.set(prefs,{primaryGroupId:ref.id,updatedAt:serverTimestamp()},{merge:true});await batch.commit();return group;
    },
    async rename(id,value){const name=groupName(value),ref=doc(db,'friendGroups',id);await runTransaction(db,async tx=>{const snapshot=await tx.get(ref),group=snapshot.data();if(!group||group.deletedAt)throw new Error('This Solar System is no longer available.');if(group.owner!==uid)throw new Error('Only the owner can rename this Solar System.');if(group.name===name)return;tx.update(ref,{name});tx.update(doc(db,'groupDirectory',id),{name,searchName:name.toLowerCase()});});return name;},
    async search(value){if(!(await getDocs(collection(db,'groupMemberships',uid,'groups'))).empty)throw new Error('Leave your Solar System before searching for another.');const prefix=String(value||'').trim().toLowerCase();if(prefix.length<2)return [];const result=await getDocs(query(collection(db,'groupDirectory'),orderBy('searchName'),startAt(prefix),endAt(prefix+'\uf8ff'),limit(10)));return result.docs.map(item=>({id:item.id,...item.data()}));},
    async request(id){const own=await identity(),group=(await getDoc(doc(db,'groupDirectory',id))).data();if(!group)throw new Error('This group is no longer available.');await setDoc(doc(db,'groupRequests',id+'~'+uid),{groupId:id,groupName:group.name,owner:group.owner,userId:uid,username:own.username,kind:'join',createdAt:serverTimestamp()});},
    async invite(id,user){const group=(await getDoc(doc(db,'friendGroups',id))).data(),person=(await getDoc(doc(db,'publicProfiles',user))).data();if(!group||group.owner!==uid)throw new Error('Only the owner can invite friends.');if(!person)throw new Error('That user is no longer available.');await setDoc(doc(db,'groupRequests',id+'~'+user),{groupId:id,groupName:group.name,owner:uid,userId:user,username:person.username,kind:'invite',createdAt:serverTimestamp()});},
    async accept(id){await runTransaction(db,async tx=>{const ref=doc(db,'groupRequests',id),snapshot=await tx.get(ref);if(!snapshot.exists())throw new Error('This request is no longer available.');const request=snapshot.data(),groupSnapshot=await tx.get(doc(db,'friendGroups',request.groupId));if(!groupSnapshot.exists())throw new Error('This group is no longer available.');const group={id:request.groupId,...groupSnapshot.data()};addMember(tx,group,request.userId,request.username);tx.delete(ref);if(request.userId===uid)tx.set(prefs,{primaryGroupId:group.id,updatedAt:serverTimestamp()},{merge:true});});},
    async dismiss(id){const batch=writeBatch(db);batch.delete(doc(db,'groupRequests',id));await batch.commit();},
    async remove(id,user=uid){const batch=writeBatch(db);batch.delete(memberRef(id,user));batch.delete(indexRef(id,user));batch.delete(scoreRef(id,user));await batch.commit();},
    async deleteSystem(id){
      const ref=doc(db,'friendGroups',id),group=(await getDoc(ref)).data();
      if(!group||group.owner!==uid)throw new Error('Only the owner can delete this Solar System.');
      if(!group.deletedAt){const batch=writeBatch(db);batch.update(ref,{deletedAt:serverTimestamp()});batch.delete(doc(db,'groupDirectory',id));batch.delete(doc(db,'solarOwnership',uid));batch.delete(indexRef(id));await batch.commit();}
      // Admissions are now closed. Read the final membership to include anyone
      // who joined while deletion was starting, then clean indexes in batches.
      const members=await getDocs(collection(db,'friendGroups',id,'members'));
      const requests=await getDocs(query(collection(db,'groupRequests'),where('owner','==',uid)));
      const cleanup=[...members.docs.map(item=>indexRef(id,item.id)),...requests.docs.filter(item=>item.data().groupId===id).map(item=>item.ref)];
      for(let start=0;start<cleanup.length;start+=400){const next=writeBatch(db);for(const item of cleanup.slice(start,start+400))next.delete(item);await next.commit();}
    },
    async primary(id){await setDoc(prefs,{primaryGroupId:id,updatedAt:serverTimestamp()},{merge:true});},
    async saveAppearance(value){await setDoc(prefs,{...solarAppearance(value),updatedAt:serverTimestamp()},{merge:true});},
    async publish(ids,name,summary,days=[],appearance={}){
      for(const id of ids){
        const existing=await getDocs(query(collection(db,'friendGroups',id,'days'),where('uid','==',uid))),desired=new Map(days.map(day=>[uid+'~'+day.date,day]));
        const mutations=[{ref:scoreRef(id),value:{uid,username:name,...summary,...solarAppearance(appearance),updatedAt:serverTimestamp()}}];
        for(const item of existing.docs){const value=desired.get(item.id);if(!value)mutations.push({ref:item.ref,value:null});else if(item.data().score===value.score)desired.delete(item.id);}
        for(const [key,day] of desired)mutations.push({ref:doc(db,'friendGroups',id,'days',key),value:{uid,username:name,...day,updatedAt:serverTimestamp()}});
        for(let start=0;start<mutations.length;start+=200){const batch=writeBatch(db);for(const mutation of mutations.slice(start,start+200)){if(mutation.value)batch.set(mutation.ref,mutation.value);else batch.delete(mutation.ref);}await batch.commit();}
      }
    },
    async react(id,target,date,kind){if(kind!==null&&!REACTIONS.some(reaction=>reaction.id===kind))throw new Error('Choose a planet reaction.');const ref=doc(db,'friendGroups',id,'reactions',target+'~'+date+'~'+uid),batch=writeBatch(db);if(kind===null)batch.delete(ref);else {const own=await identity();batch.set(ref,{target,date,reactor:uid,username:own.username,kind,updatedAt:serverTimestamp()});}await batch.commit();},
    watchToday(id,date,receive,error){return onSnapshot(query(collection(db,'friendGroups',id,'days'),where('date','==',date)),snapshot=>receive(snapshot.docs.map(item=>item.data())),error);},
    watchReactions(id,date,receive,error){return onSnapshot(query(collection(db,'friendGroups',id,'reactions'),where('date','==',date)),snapshot=>receive(snapshot.docs.map(item=>item.data())),error);},
    watchDay(id,target,date,receive,error){let day=null,reactions=[];const emit=()=>receive({day,reactions});const stops=[onSnapshot(doc(db,'friendGroups',id,'days',target+'~'+date),snapshot=>{day=snapshot.exists()?snapshot.data():null;emit();},error),onSnapshot(query(collection(db,'friendGroups',id,'reactions'),where('target','==',target),where('date','==',date)),snapshot=>{reactions=snapshot.docs.map(item=>item.data());emit();},error)];return ()=>stops.forEach(stop=>stop());},
    watch(receive,error){let groups=[],requests=[],invitations=[],primaryId=null,groupsLoaded=false,appearance=solarAppearance(),appearanceReady=false,ownedGroupId=null,active=true;
      // Resolve denormalized labels from the live group document, including
      // legacy memberships and pending requests, without rewriting every member.
      const names=new Map(),nameStops=new Map(),label=item=>({...item,groupName:names.get(item.groupId||item.id)??item.groupName});
      const emit=()=>{if(active)receive({groups:groups.map(label),requests:requests.map(label),invitations:invitations.map(label),primaryId,groupsLoaded,appearance,appearanceReady,ownedGroupId});};
      const watchNames=()=>{if(!active)return;const ids=new Set([...groups,...requests,...invitations].map(item=>item.groupId||item.id));for(const [id,entry] of nameStops)if(!ids.has(id)){nameStops.delete(id);entry.stop();names.delete(id);}for(const id of ids)if(!nameStops.has(id)){const entry={stop:()=>{}};nameStops.set(id,entry);entry.stop=onSnapshot(doc(db,'friendGroups',id),snapshot=>{if(!active||nameStops.get(id)!==entry)return;names.set(id,snapshot.data()?.name);emit();},error);}};
      const stops=[
      onSnapshot(doc(db,'solarOwnership',uid),snapshot=>{ownedGroupId=snapshot.data()?.groupId||null;emit();},error),
      onSnapshot(collection(db,'groupMemberships',uid,'groups'),snapshot=>{groups=snapshot.docs.map(item=>({id:item.id,...item.data()}));groupsLoaded=true;watchNames();emit();},error),
      onSnapshot(query(collection(db,'groupRequests'),where('owner','==',uid)),snapshot=>{requests=snapshot.docs.map(item=>({id:item.id,...item.data()}));watchNames();emit();},error),
      onSnapshot(query(collection(db,'groupRequests'),where('userId','==',uid)),snapshot=>{invitations=snapshot.docs.map(item=>({id:item.id,...item.data()}));watchNames();emit();},error),
      onSnapshot(prefs,snapshot=>{const data=snapshot.data();primaryId=data?.primaryGroupId||null;appearance=solarAppearance(data);appearanceReady=true;emit();},error)];return ()=>{active=false;stops.forEach(stop=>stop());nameStops.forEach(entry=>entry.stop());nameStops.clear();};
    },
    watchBoard(id,receive,error){let members=[],scores=new Map();const emit=()=>receive(members.map(member=>({...member,...scores.get(member.uid)})));const stops=[onSnapshot(collection(db,'friendGroups',id,'members'),snapshot=>{members=snapshot.docs.map(item=>item.data());emit();},error),onSnapshot(collection(db,'friendGroups',id,'scores'),snapshot=>{scores=new Map(snapshot.docs.map(item=>[item.id,item.data()]));emit();},error)];return ()=>stops.forEach(stop=>stop());},
  };
}
