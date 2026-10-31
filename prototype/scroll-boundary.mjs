// Safari versions with incomplete overscroll support need an edge-only guard.
// Leave nested scrolling and multi-touch gestures to the browser.
export function mountScrollBoundary({window,document}){
  let lastY=null;
  const start=event=>{lastY=event.touches.length===1?event.touches[0].clientY:null;};
  const move=event=>{
    if(lastY===null||event.touches.length!==1)return;
    const y=event.touches[0].clientY,down=y>lastY;lastY=y;
    if(!down||(window.scrollY??document.scrollingElement?.scrollTop??0)>0)return;
    for(let node=event.target;node&&node!==document.documentElement;node=node.parentElement){
      if(node.scrollHeight>node.clientHeight&&node.scrollTop>0&&/auto|scroll/.test(window.getComputedStyle(node).overflowY))return;
    }
    if(event.cancelable)event.preventDefault();
  };
  const end=()=>{lastY=null;};
  document.addEventListener('touchstart',start,{passive:true});
  document.addEventListener('touchmove',move,{passive:false});
  document.addEventListener('touchend',end,{passive:true});
  document.addEventListener('touchcancel',end,{passive:true});
  return ()=>{document.removeEventListener('touchstart',start);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',end);};
}
