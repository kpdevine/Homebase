import {startArcDrag,moveArcDrag,arcScore} from './drag-arc.mjs';

// Ring gestures follow the angle; gestures on the number adjust without jumping.
export function bindMeterDrag(meter,{read,change,min=0,scaleMin=min,max=10,step=.1,onStart=()=>{},onEnd=()=>{}}) {
  let gesture=null;
  const surface=meter.ownerDocument.defaultView;
  const point=event=>{
    const svg=meter.querySelector('svg'),rect=svg.getBoundingClientRect(),box=svg.getAttribute?.('viewBox')?.split(/\s+/).map(Number)||[0,0,220,210];
    return {x:(event.clientX-rect.left)*220/rect.width,y:(event.clientY-rect.top)*(box[3]/box[2]*220)/rect.height};
  };
  const angle=position=>(Math.atan2(position.y-110,position.x-110)*180/Math.PI-105+720)%360;
  function update(event) {
    const current=point(event);
    if(gesture.offset){current.x+=gesture.offset.x;current.y+=gesture.offset.y;}
    const value=gesture.center
      ? Math.max(min,Math.min(max,Math.round((gesture.value+(current.x-gesture.x+gesture.y-current.y)*(max-min)/180)/step)*step))
      : Math.max(min,Math.min(max,Math.round((scaleMin+moveArcDrag(gesture.arc,angle(current))/10*(max-scaleMin))/step)*step));
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
    if(meter.ownerDocument.activeElement===meter)meter.blur?.();
    onEnd();
  }
  meter.addEventListener('pointerdown',event=>{
    if(gesture||event.isPrimary===false||event.pointerType==='mouse'&&event.button!==0||meter.getAttribute?.('role')==='img'||meter.getAttribute?.('aria-disabled')==='true')return;
    const start=point(event);
    event.preventDefault();meter.focus({preventScroll:true});
    const handle=meter.classList.contains?.('orbital-meter')?meter.querySelector('.orbital-planet'):null,rect=handle?.getBoundingClientRect();
    const onHandle=rect&&event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
    const anchor=onHandle?point({clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2}):start;
    gesture={...start,pointer:event.pointerId,value:read()??min,center:!onHandle&&Math.hypot(start.x-110,start.y-110)<43,offset:onHandle?{x:anchor.x-start.x,y:anchor.y-start.y}:null,arc:startArcDrag(angle(anchor))};
    meter.classList.add('dragging');
    // Window listeners also preserve mouse drags outside the ring.
    surface.addEventListener('pointermove',move,{passive:false});
    surface.addEventListener('pointerup',finish);
    surface.addEventListener('pointercancel',finish);
    surface.addEventListener('blur',finish);
    meter.setPointerCapture(event.pointerId);onStart();
    if(!gesture.center&&!onHandle){const value=Math.max(min,Math.min(max,Math.round((scaleMin+arcScore(gesture.arc.position)/10*(max-scaleMin))/step)*step));if(value!==read())change(Number(value.toFixed(6)));}
  });
  meter.addEventListener('lostpointercapture',finish);
}
