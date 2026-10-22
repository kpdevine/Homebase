import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {getFirestore,collection,doc,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import {packCloudPayload,unpackCloudPayload,matchesCloudVersion} from './record-edits.mjs';
import {socialClient} from './social-driver.mjs';

export function firebaseClient(config) {
  const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
  return {
    social:uid=>socialClient(db,uid),
    observeAuth(callback,onError){getRedirectResult(auth).catch(onError);return onAuthStateChanged(auth,callback,onError);},
    signIn:()=>location.hostname===config.authDomain?signInWithRedirect(auth,new GoogleAuthProvider()):signInWithPopup(auth,new GoogleAuthProvider()),
    signOut:()=>signOut(auth),
    transport(uid) {
      const records=collection(db,'users',uid,'records');
      return {
        subscribe(receive,error) {
          return onSnapshot(records,{includeMetadataChanges:true},snapshot=>{
            if(snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;
            const next=new Map(),times=new Map();
            try {for(const record of snapshot.docs){const data=record.data();if(data.format!==1||typeof data.payload!=='string')throw new Error('Unsupported cloud data format.');const parsed=unpackCloudPayload(data.payload);next.set(record.id,parsed.payload);if(parsed.editedAt)times.set(record.id,parsed.editedAt);}}
            catch(problem){error(problem);return;}
            receive(next,times);
          },error);
        },
        commit(changes) {
          return runTransaction(db,async transaction=>{
            const refs=changes.map(change=>doc(records,change.id));
            const current=await Promise.all(refs.map(ref=>transaction.get(ref)));
            const needed=[];
            for(let index=0;index<changes.length;index++) {
              const change=changes[index],record=current[index].exists()?unpackCloudPayload(current[index].data().payload):null,existing=record?.payload??null;
              if(existing===change.after)continue;
              if(!matchesCloudVersion(record,change)){const error=new Error('Another device changed this record.');error.code='homebase/conflict';throw error;}
              needed.push(index);
            }
            for(const index of needed) {
              if(changes[index].after===null)transaction.delete(refs[index]);
              else transaction.set(refs[index],{format:1,payload:packCloudPayload(changes[index].after,changes[index].editedAt),updatedAt:serverTimestamp()});
            }
          });
        },
      };
    },
  };
}
