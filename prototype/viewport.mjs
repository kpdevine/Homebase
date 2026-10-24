// Keep modal editors inside the visible viewport when a mobile keyboard pans
// or resizes it. Scroll the dialog itself, never the page behind the editor.
export function mountViewport({window,document}) {
  let frame;
  function revealEditor(){
    const field=document.activeElement;
    if(!field?.matches('textarea,input:not([type=checkbox]):not([type=radio]),[contenteditable=true]'))return;
    const dialog=field.closest('dialog[open]');if(!dialog)return;
    const bounds=dialog.getBoundingClientRect(),editor=field.getBoundingClientRect();
    const heading=dialog.querySelector('.dialog-heading')?.getBoundingClientRect();
    const top=Math.max(bounds.top+12,heading?Math.min(bounds.bottom-12,heading.bottom+8):bounds.top+12),bottom=bounds.bottom-12;
    if(editor.bottom>bottom)dialog.scrollTop+=editor.bottom-bottom;
    else if(editor.top<top)dialog.scrollTop-=top-editor.top;
  }
  function update(){
    const view=window.visualViewport,style=document.documentElement.style;
    for(const [key,value] of Object.entries({height:view?.height||window.innerHeight,width:view?.width||window.innerWidth,top:view?.offsetTop||0,left:view?.offsetLeft||0}))style.setProperty(`--visible-${key}`,`${value}px`);
    window.cancelAnimationFrame(frame);frame=window.requestAnimationFrame(revealEditor);
  }
  window.visualViewport?.addEventListener('resize',update);
  window.visualViewport?.addEventListener('scroll',update);
  window.addEventListener('resize',update);
  document.addEventListener('focusin',update);
  update();
  return ()=>{window.cancelAnimationFrame(frame);window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);document.removeEventListener('focusin',update);};
}
