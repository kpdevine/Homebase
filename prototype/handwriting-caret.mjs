// Keep native textarea editing, selection, keyboard and accessibility behavior.
// A mirrored text range only positions a decorative cursor from the owner's font.
export function handwritingCarets(inputs) {
  const refreshers=[];
  for (const input of inputs) {
    const shell=document.createElement('div');shell.className='notes-input-shell';
    input.before(shell);shell.append(input);
    const mirror=document.createElement('div');mirror.className='notes-caret-mirror';mirror.setAttribute('aria-hidden','true');
    const layer=document.createElement('div');layer.className='notes-caret-layer';layer.setAttribute('aria-hidden','true');layer.hidden=true;
    const cursor=document.createElement('span');cursor.className='handwriting-caret';cursor.textContent='/';
    layer.append(mirror,cursor);shell.append(layer);
    const properties=['fontFamily','fontSize','fontWeight','fontStyle','fontVariant','fontKerning','fontFeatureSettings','letterSpacing','wordSpacing','lineHeight','textIndent','textTransform','textAlign','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','boxSizing'];
    function refresh() {
      input.classList.remove('has-handwriting-caret');layer.hidden=true;
      if(document.activeElement!==input || input.selectionStart!==input.selectionEnd || input.disabled || input.readOnly) return;
      const style=getComputedStyle(input);
      for(const property of properties)mirror.style[property]=style[property];
      const borderX=Number.parseFloat(style.borderLeftWidth)+Number.parseFloat(style.borderRightWidth);
      mirror.style.width=`${input.clientWidth+borderX}px`;
      mirror.textContent=input.value+'\u200b';
      layer.hidden=false;
      const range=document.createRange();range.setStart(mirror.firstChild,input.selectionStart);range.collapse(true);
      const rect=range.getBoundingClientRect(),origin=mirror.getBoundingClientRect();
      if(!rect.height) {layer.hidden=true;return;} // Keep native fallback if measurement fails.
      const x=rect.left-origin.left-input.scrollLeft,y=rect.top-origin.top-input.scrollTop;
      cursor.style.fontFamily=style.fontFamily;cursor.style.fontSize=style.fontSize;
      cursor.style.left=`${x}px`;cursor.style.top=`${y}px`;cursor.style.height=`${rect.height}px`;
      cursor.style.lineHeight=`${rect.height}px`;
      cursor.style.animation='none';void cursor.offsetWidth;cursor.style.animation='';
      layer.hidden=false;input.classList.add('has-handwriting-caret');
    }
    for(const type of ['input','focus','blur','click','keyup','select','scroll','compositionend'])input.addEventListener(type,refresh);
    const observer=new ResizeObserver(refresh);observer.observe(input);
    refreshers.push(refresh);
  }
  document.addEventListener('selectionchange',()=>refreshers.forEach(refresh=>refresh()));
  document.fonts.ready.then(()=>refreshers.forEach(refresh=>refresh()));
  return ()=>refreshers.forEach(refresh=>refresh());
}
