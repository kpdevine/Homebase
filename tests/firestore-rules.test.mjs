import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

test('Firestore isolates private logs and limits social summaries to mutually accepted friends',{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
  let require=createRequire(new URL('../package.json',import.meta.url));
  try{require.resolve('@firebase/rules-unit-testing');}catch{require=createRequire(new URL('../.local/security-tests/package.json',import.meta.url));}
  const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
  const {doc,getDoc,setDoc,deleteDoc,runTransaction,writeBatch,serverTimestamp,collection,getDocs,query,where,orderBy,startAt,endAt,limit}=require('firebase/firestore');
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
  const env=await initializeTestEnvironment({projectId:'demo-pocket-planet',firestore:{host,port:Number(port),rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
  const a=env.authenticatedContext('alice').firestore(),b=env.authenticatedContext('bob').firestore(),c=env.authenticatedContext('charlie').firestore(),guest=env.unauthenticatedContext().firestore();
  const claim=async(db,uid,name)=>runTransaction(db,async tx=>{tx.set(doc(db,'handles',name),{uid,username:name,createdAt:serverTimestamp()});tx.set(doc(db,'publicProfiles',uid),{uid,username:name,createdAt:serverTimestamp()});});
  try{
    await assertSucceeds(claim(a,'alice','alice_planet'));await assertSucceeds(claim(b,'bob','bob_planet'));await assertSucceeds(claim(c,'charlie','charlie_planet'));
    await assertFails(claim(b,'bob','alice_planet'));await assertFails(claim(c,'alice','hijacked'));
    await assertFails(getDoc(doc(guest,'handles','alice_planet')));
    await assertSucceeds(getDocs(query(collection(a,'handles'),orderBy('username'),startAt('bob'),endAt('bob\uf8ff'),limit(10))));
    await assertSucceeds(setDoc(doc(a,'users','alice','records','settings'),{format:1,payload:'private',updatedAt:serverTimestamp()}));
    await assertFails(getDoc(doc(b,'users','alice','records','settings')));
    const score={uid:'alice',username:'alice_planet',appDate:'2026-10-21',month:'2026-10',yesterdayDate:'2026-10-20',yesterdayScore:9,monthScore:8.4,daysLogged:5,totalDaysLogged:40,updatedAt:serverTimestamp()};
    await assertSucceeds(setDoc(doc(a,'socialScores','alice'),score));await assertFails(getDoc(doc(b,'socialScores','alice')));await assertFails(getDoc(doc(guest,'socialScores','alice')));
    await assertFails(setDoc(doc(a,'socialScores','alice'),{...score,notes:'must never be public'}));await assertFails(setDoc(doc(a,'socialScores','alice'),{...score,monthScore:11}));await assertFails(setDoc(doc(b,'socialScores','alice'),score));
    const requestId='alice~bob',request=doc(a,'friendRequests',requestId);
    assert.equal((await assertSucceeds(getDoc(request))).exists(),false);
    await assertSucceeds(setDoc(request,{requester:'alice',recipient:'bob',status:'pending',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
    await assertFails(getDoc(doc(c,'friendRequests',requestId)));await assertFails(getDoc(doc(b,'socialScores','alice')));
    await assertSucceeds(getDocs(query(collection(b,'friendRequests'),where('recipient','==','bob'))));
    const friendship={owner:'alice',friend:'bob',requestId,createdAt:serverTimestamp()};
    await assertFails(setDoc(doc(a,'friendships','alice','friends','bob'),friendship));
    const unilateral=writeBatch(b);unilateral.update(doc(b,'friendRequests',requestId),{status:'accepted',updatedAt:serverTimestamp()});unilateral.set(doc(b,'friendships','alice','friends','bob'),friendship);await assertFails(unilateral.commit());
    const accepted=writeBatch(b);accepted.update(doc(b,'friendRequests',requestId),{status:'accepted',updatedAt:serverTimestamp()});accepted.set(doc(b,'friendships','alice','friends','bob'),friendship);accepted.set(doc(b,'friendships','bob','friends','alice'),{...friendship,owner:'bob',friend:'alice'});await assertSucceeds(accepted.commit());
    await assertSucceeds(getDoc(doc(b,'socialScores','alice')));await assertFails(getDoc(doc(c,'socialScores','alice')));await assertFails(getDoc(doc(b,'users','alice','records','settings')));
    await assertFails(setDoc(doc(b,'friendships','charlie','friends','alice'),{...friendship,owner:'charlie',friend:'alice'}));
    await assertSucceeds(deleteDoc(doc(b,'friendships','alice','friends','bob')));await assertFails(getDoc(doc(b,'socialScores','alice')));
    // Exercise the actual browser driver against the emulator, swapping only its
    // CDN import for the identical local SDK API so Node can load it.
    const {pathToFileURL}=await import('node:url');
    const source=(await readFile(new URL('../prototype/social-driver.mjs',import.meta.url),'utf8')).replace('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js',pathToFileURL(require.resolve('firebase/firestore')).href).replace('./social-model.mjs',new URL('../prototype/social-model.mjs',import.meta.url).href);
    const {socialClient}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
    const dana=socialClient(env.authenticatedContext('dana').firestore(),'dana'),eli=socialClient(env.authenticatedContext('eli').firestore(),'eli');
    assert.equal(await dana.profile(),null);await dana.claim('dana_planet');await eli.claim('eli_planet');assert.equal((await dana.search('eli'))[0].uid,'eli');
    await dana.request('eli');await eli.accept('dana~eli');
    const summary={appDate:'2026-10-21',month:'2026-10',yesterdayDate:'2026-10-20',yesterdayScore:9,monthScore:8.4,daysLogged:5,totalDaysLogged:40};
    await dana.publish('dana_planet',summary);
    assert.equal((await getDoc(doc(env.authenticatedContext('eli').firestore(),'socialScores','dana'))).data().daysLogged,5);
    let unwatch;
    try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Friends listener did not receive the score summary.')),5000);unwatch=eli.watch(state=>{if(state.friends.some(friend=>friend.uid==='dana'&&friend.daysLogged===5)){clearTimeout(timer);resolve();}},error=>{clearTimeout(timer);reject(error);});});}finally{unwatch?.();}
    await eli.remove('dana');await assertFails(getDoc(doc(env.authenticatedContext('eli').firestore(),'socialScores','dana')));
  }finally{await env.cleanup();}
});
