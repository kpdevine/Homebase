import test from 'node:test';
import assert from 'node:assert/strict';
import {notifyReaction} from '../prototype/reaction-notifications.mjs';
import {solarAppearance,vibesReactions} from '../prototype/social-model.mjs';
test('reaction notifications carry only event coordinates and retry transient failures at most once',async()=>{
  const event={scope:'day',group:'orbit',target:'friend',date:'2026-10-25'};let attempts=0;
  const options={session:async()=>({token:'session-token'}),apiBase:'https://service.example',fetcher:async(url,request)=>{attempts++;assert.equal(url,'https://service.example/reaction');assert.deepEqual(JSON.parse(request.body),event);assert.equal(request.headers.Authorization,'Bearer session-token');return {ok:attempts===2,status:attempts===2?200:503};}};
  assert.equal(await notifyReaction(event,options),true);assert.equal(attempts,2);
  attempts=0;options.fetcher=async()=>{attempts++;return {ok:false,status:401};};assert.equal(await notifyReaction(event,options),false);assert.equal(attempts,1);
  options.session=async()=>null;assert.equal(await notifyReaction(event,options),false);assert.equal(attempts,1);
});
test('new vibes keep a version and old-version reactions do not appear on the new status',()=>{
  assert.equal(solarAppearance({vibes:'hello',vibesVersion:'new-status-version'}).vibesVersion,'new-status-version');
  assert.throws(()=>solarAppearance({vibesVersion:'bad/version'}));
  const rows=[{target:'friend',version:'legacy'},{target:'friend',version:'new-status-version'},{target:'other',version:'new-status-version'}];
  assert.deepEqual(vibesReactions(rows,'friend'),[rows[0]]);assert.deepEqual(vibesReactions(rows,'friend','new-status-version'),[rows[1]]);
});
