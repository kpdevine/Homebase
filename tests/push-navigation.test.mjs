import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('reaction pushes open Solar Systems and never navigate to an external payload URL',async()=>{
  const handlers={},shown=[],navigated=[],opened=[];let pending;
  const self={location:{origin:'https://pocketplanet.day'},addEventListener:(name,handler)=>handlers[name]=handler,registration:{showNotification:async(title,value)=>shown.push(value)},clients:{matchAll:async()=>[{url:'https://pocketplanet.day/',navigate:async url=>navigated.push(url),focus:async()=>{}}],openWindow:async url=>opened.push(url)}};
  runInNewContext(readFileSync(new URL('../prototype/push-sw.js',import.meta.url),'utf8'),{self,URL});
  handlers.push({data:{json:()=>({body:'Reaction',url:'https://pocketplanet.day/?open=solar'})},waitUntil:promise=>pending=promise});await pending;
  assert.equal(shown[0].data.url,'https://pocketplanet.day/?open=solar');
  handlers.notificationclick({notification:{data:shown[0].data,close(){}},waitUntil:promise=>pending=promise});await pending;
  assert.deepEqual(navigated,['https://pocketplanet.day/?open=solar']);
  handlers.push({data:{json:()=>({url:'https://evil.example/'})},waitUntil:promise=>pending=promise});await pending;assert.equal(shown[1].data.url,'https://pocketplanet.day/');
  self.clients.matchAll=async()=>[];
  handlers.notificationclick({notification:{data:shown[0].data,close(){}},waitUntil:promise=>pending=promise});await pending;assert.deepEqual(opened,['https://pocketplanet.day/?open=solar']);
});
