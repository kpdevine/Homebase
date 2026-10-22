import {collection,doc,getDoc,getDocs,query,where,orderBy,startAt,endAt,limit,onSnapshot,runTransaction,writeBatch,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import {username} from './social-model.mjs';

export function socialClient(db,uid){
  const profile=doc(db,'publicProfiles',uid);
  return {
    uid,
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
      const emit=()=>receive({incoming:incoming.map(item=>({...item,username:profiles.get(item.requester)||'Loading…'})),outgoing,friends:friends.map(id=>({uid:id,username:profiles.get(id)||scores.get(id)?.username||'Loading…',...scores.get(id)}))});
      const names=async ids=>{await Promise.all([...new Set(ids)].filter(id=>!profiles.has(id)).map(async id=>{const result=await getDoc(doc(db,'publicProfiles',id));profiles.set(id,result.data()?.username||'Member');}));emit();};
      const stops=[onSnapshot(query(collection(db,'friendRequests'),where('recipient','==',uid)),snapshot=>{incoming=snapshot.docs.filter(d=>d.data().status==='pending').map(d=>({id:d.id,...d.data()}));names(incoming.map(r=>r.requester)).catch(error);emit();},error),onSnapshot(query(collection(db,'friendRequests'),where('requester','==',uid)),snapshot=>{outgoing=snapshot.docs.filter(d=>d.data().status==='pending').map(d=>({id:d.id,...d.data()}));emit();},error),onSnapshot(collection(db,'friendships',uid,'friends'),snapshot=>{
        friendStops.forEach(stop=>stop());friends=snapshot.docs.map(d=>d.id);scores=new Map();names(friends).catch(error);
        friendStops=friends.map(id=>onSnapshot(doc(db,'socialScores',id),value=>{if(value.exists())scores.set(id,value.data());emit();},error));emit();
      },error)];return ()=>{stops.forEach(stop=>stop());friendStops.forEach(stop=>stop());};
    },
  };
}
