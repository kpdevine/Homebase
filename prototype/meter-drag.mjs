import {scoreFromPoint} from './model.mjs';

// Ring gestures follow the angle; gestures on the number adjust without jumping.
export function bindMeterDrag(meter,{read,change,min=0,max=10,step=.1,onStart=()=>{},onEnd=()=>{}}) {
  let gesture=null;
  const surface=meter.ownerDocument.defaultView;
  const point=event=>{
    const rect=meter.querySelector('svg').getBoundingClientRect();
    return {x:(event.clientX-rect.left)*220/rect.width,y:(event.clientY-rect.top)*210/rect.height};
  };
  function update(event) {
    const current=point(event);
    const value=gesture.center
      ? Math.max(min,Math.min(max,Math.round((gesture.value+(current.x-gesture.x+gesture.y-current.y)*(max-min)/180)/step)*step))
      : scoreFromPoint(current.x,current.y,110,110,{min,max,step});
    if(value!==null&&value!==read())change(Number(value.toFixed(6)));
  }
  function move(event) {
    if(!gesture||event.pointerId!==gesture.pointer)return;
    event.preventDefault();update(event);
  }
  function finish(event) {
    if(!gesture||event.type!=='blur'&&event.pointerId!==gesture.pointer)return;
    if(event.type==='pointerup')update(event);
    const pointer=gesture.pointer;gesture=null;
    surface.removeEventListener('pointermove',move);
    surface.removeEventListener('pointerup',finish);
    surface.removeEventListener('pointercancel',finish);
    surface.removeEventListener('blur',finish);
    meter.classList.remove('dragging');
    if(meter.hasPointerCapture(pointer))meter.releasePointerCapture(pointer);
    onEnd();
  }
  meter.addEventListener('pointerdown',event=>{
    if(gesture||event.isPrimary===false||event.pointerType==='mouse'&&event.button!==0)return;
    const start=point(event);
    event.preventDefault();meter.focus({preventScroll:true});
    gesture={...start,pointer:event.pointerId,value:read()??min,center:Math.hypot(start.x-110,start.y-110)<43};
    meter.classList.add('dragging');
    // Window listeners also preserve mouse drags outside the ring.
    surface.addEventListener('pointermove',move,{passive:false});
    surface.addEventListener('pointerup',finish);
    surface.addEventListener('pointercancel',finish);
    surface.addEventListener('blur',finish);
    meter.setPointerCapture(event.pointerId);onStart();
    if(!gesture.center)update(event);
  });
  meter.addEventListener('lostpointercapture',finish);
}
