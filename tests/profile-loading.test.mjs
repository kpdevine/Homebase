import test from 'node:test';
import assert from 'node:assert/strict';
import {mountUserProfiles} from '../prototype/user-profile-ui.mjs';
function setup(){
  const nodes=[];
  const node=()=>({innerHTML:'',textContent:'',open:false,addEventListener(){},setAttribute(){},querySelector(){return node();},showModal(){this.open=true;},close(){this.open=false;},append(){}});
  const prior={document:globalThis.document,ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame};
  globalThis.document={createElement(tag){if(tag==='canvas')return {getContext:()=>null};const element=node();const content=node();element.querySelector=selector=>selector==='#user-profile-content'?content:node();nodes.push({element,content});return element;},body:{append(){}},fonts:{ready:Promise.resolve(),addEventListener(){}},addEventListener(){}};
  globalThis.ResizeObserver=class {observe(){}};globalThis.requestAnimationFrame=()=>{};
  let resolve,calls=0,known={uid:'friend',username:'milo',totalDaysLogged:86,vibes:'Already loaded'};
  const response=new Promise(done=>{resolve=done;});
  const api=mountUserProfiles({getClient:()=>({viewProfile(){calls++;return response;}}),getUser:()=>({uid:'self'}),getFriends:()=>[],getIncoming:()=>[],getOutgoing:()=>[],getKnownProfile:()=>known,planetEmoji:()=>'',scoreCircle:()=>'',ownSummary:()=>({}),ownAppearance:()=>({})});
  return {api,content:nodes[0].content,resolve,calls:()=>calls,setKnown(value){known=value;},restore(){Object.assign(globalThis,prior);}};
}
test('Solar System data renders before the network resolves; repeat opens reuse one pending request and refresh accurately',async()=>{
  const ui=setup();try{
    const first=ui.api.open('friend');assert.match(ui.content.innerHTML,/@milo/);assert.match(ui.content.innerHTML,/Already loaded/);assert.match(ui.content.innerHTML,/Loading friends/);
    const second=ui.api.open('friend');assert.equal(ui.calls(),1);
    ui.resolve({uid:'friend',username:'milo',vibes:'Fresh from cloud',totalDaysLogged:87,friends:[]});await Promise.all([first,second]);
    assert.match(ui.content.innerHTML,/Fresh from cloud/);assert.match(ui.content.innerHTML,/87/);
    ui.setKnown(null);const third=ui.api.open('friend');assert.match(ui.content.innerHTML,/Fresh from cloud/);await third;
    ui.api.reset();
  }finally{ui.restore();}
});
