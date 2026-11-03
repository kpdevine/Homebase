import test from 'node:test';
import assert from 'node:assert/strict';
import {socialLoggingReady,membershipSnapshotReady} from '../prototype/social-logging.mjs';
import {solarAppearance,datedAppearance,vibesDateLabel} from '../prototype/social-model.mjs';
const ready={authReady:true,cloudHasUser:true,user:{uid:'me'},profile:{uid:'me'},membershipReady:true,appearanceReady:true,groupIds:['orbit']};
test('day completion waits for authentication, account handoff, membership and appearance',()=>{
 assert.equal(socialLoggingReady(ready),true);
 assert.equal(socialLoggingReady({...ready,profile:null}),true,'known members do not wait for the public profile lookup');
 assert.equal(socialLoggingReady({...ready,profile:null,groupIds:[]}),false);
 for(const changes of [{authReady:false},{user:null},{membershipReady:false},{appearanceReady:false},{needsUsername:true}])assert.equal(socialLoggingReady({...ready,...changes}),false);
 assert.equal(socialLoggingReady({authReady:true}),true);
 assert.equal(socialLoggingReady({...ready,groupIds:[],appearanceReady:false}),true);
 assert.equal(socialLoggingReady({...ready,needsUsername:true,profile:null,groupIds:[]}),true);
 assert.equal(socialLoggingReady({...ready,needsUsername:true,profile:null,groupIds:[],membershipReady:false}),false);
});
test('daily vibes retain the submitted day and change date even when text repeats',()=>{
 const previous={planet:'happy',vibes:'Feeling good',vibesDate:'2026-10-31'};
 assert.equal(datedAppearance(previous,previous,'2026-11-01','2026-11-01').vibesDate,'2026-11-01');
 assert.equal(datedAppearance(previous,{...previous,planet:'sun'},undefined,'2026-11-01').vibesDate,'2026-10-31');
 assert.equal(datedAppearance(previous,{planet:'sun',vibes:'New day'},undefined,'2026-11-01').vibesDate,'2026-11-01');
 assert.equal(datedAppearance(previous,{planet:'sun',vibes:'Yesterday'},'2026-10-30','2026-11-01').vibesDate,'2026-10-30');
 assert.throws(()=>solarAppearance({vibesDate:'2026-02-30'}));
 assert.equal(vibesDateLabel(previous),'Oct 31, 2026');
 assert.equal(vibesDateLabel({vibes:'Legacy'}),'Date not recorded');
});

test('an empty cached membership snapshot cannot exempt someone from daily vibes',()=>{
 assert.equal(membershipSnapshotReady({metadata:{fromCache:true},docs:[]}),false);
 assert.equal(membershipSnapshotReady({metadata:{fromCache:false},docs:[]}),true);
 assert.equal(membershipSnapshotReady({metadata:{fromCache:true},docs:[{id:'orbit'}]}),true);
});
