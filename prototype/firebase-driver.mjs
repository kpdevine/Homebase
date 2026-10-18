import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {getFirestore,collection,doc,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

export function firebaseClient(config) {
  const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
  return {
    observeAuth(callback,onError){getRedirectResult(auth).catch(onError);return onAuthStateChanged(auth,callback,onError);},
    signIn:()=>location.hostname===config.authDomain?signInWithRedirect(auth,new GoogleAuthProvider()):signInWithPopup(auth,new GoogleAuthProvider()),
    signOut:()=>signOut(auth),
    transport(uid) {
      const records=collection(db,'users',uid,'records');
      return {
        subscribe(receive,error) {
          return onSnapshot(records,{includeMetadataChanges:true},snapshot=>{
            if(snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;
            const next=new Map();
            for(const record of snapshot.docs){const data=record.data();if(data.format!==1||typeof data.payload!=='string'){error(new Error('Unsupported cloud data format.'));return;}next.set(record.id,data.payload);}
            receive(next);
          },error);
        },
        commit(changes) {
          return runTransaction(db,async transaction=>{
            const refs=changes.map(change=>doc(records,change.id));
            const current=await Promise.all(refs.map(ref=>transaction.get(ref)));
            const needed=[];
            for(let index=0;index<changes.length;index++) {
              const change=changes[index],existing=current[index].exists()?current[index].data().payload:null;
              if(existing===change.after)continue;
              if(existing!==change.before){const error=new Error('Another device changed this record.');error.code='homebase/conflict';throw error;}
              needed.push(index);
            }
            for(const index of needed) {
              if(changes[index].after===null)transaction.delete(refs[index]);
              else transaction.set(refs[index],{format:1,payload:changes[index].after,updatedAt:serverTimestamp()});
            }
          });
        },
      };
    },
  };
}
