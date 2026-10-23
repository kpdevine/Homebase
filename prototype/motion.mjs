const themed=hex=>(window.pocketTheme?.color(hex.slice(0,7))||hex.slice(0,7))+hex.slice(7);
const running=new WeakMap(),active=new Set(),values=new WeakMap();
const system=window.matchMedia('(prefers-reduced-motion: reduce)');
let preference='full';
const enabled=()=>preference==='full'||preference==='system'&&!system.matches;

function applyPreference() {
  document.documentElement.dataset.motion=enabled()?'full':'reduced';
  if(!enabled())for(const animation of active)animation.cancel();
}
export function setMotionPreference(value) {
  preference=['system','full','reduced'].includes(value)?value:'full';
  applyPreference();return preference;
}
system.addEventListener('change',applyPreference);

function play(element,frames,duration,{delay=0,easing='steps(10,end)'}={}) {
  if(!element||!enabled()||!element.animate)return;
  running.get(element)?.cancel();
  const animation=element.animate(frames,{duration,delay,easing,fill:'backwards'});
  running.set(element,animation);active.add(animation);
  const clean=()=>{active.delete(animation);if(running.get(element)===animation)running.delete(element);};
  animation.addEventListener('finish',clean,{once:true});
  animation.addEventListener('cancel',clean,{once:true});
}
export function sweepRings(container) {
  if(!container)return;
  container.querySelectorAll('.meter-fill,.score-circle-fill:not(.score-circle-outline)').forEach((path,index)=>{
    const target=path.getAttribute('stroke-dasharray');
    if(target&&Number.parseFloat(target)>0) {
      const frames=[{strokeDasharray:'0 100'},{strokeDasharray:target}];
      const options={delay:Math.min(index*35,140),easing:'steps(20,end)'};
      play(path,frames,780,options);
      const outline=path.parentElement.querySelector('.score-circle-outline');
      if(outline)play(outline,frames,780,options);
    }
  });
}
export function setMeter(path,percent,{immediate=false}={}) {
  const target=`${percent} 100`,previous=values.get(path);
  path.setAttribute('stroke-dasharray',target);values.set(path,target);
  if(immediate) {running.get(path)?.cancel();return;}
  if(previous!==undefined&&previous!==target&&path.getClientRects().length) {
    play(path,[{strokeDasharray:previous},{strokeDasharray:target}],420,{easing:'steps(14,end)'});
    const number=path.closest('.hero-meter,.nutrition-meter')?.querySelector('.meter-number');
    play(number,[{opacity:.45},{opacity:1}],240);
  }
}
export function reveal(element) {
  play(element,[{opacity:.2},{opacity:1}],300);
  if(element?.matches('[role="tabpanel"],#history-view,#history-content,.motion-preview'))sweepRings(element);
}
export function acknowledge(element) {
  play(element,[{backgroundColor:themed('#bce8ff88'),boxShadow:`inset 3px 0 ${themed('#bce8ff')}`},{backgroundColor:'transparent',boxShadow:'inset 0 0 transparent'}],580);
}
export function checkOff(input) {
  play(input,[{transform:'scale(.85)',boxShadow:`0 0 0 0 ${themed('#c7eeff77')}`},{transform:'scale(1)',boxShadow:`0 0 0 4px ${themed('#c7eeff00')}`}],300);
}
