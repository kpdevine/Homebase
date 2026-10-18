// Keep native textarea editing, selection, keyboard and accessibility behavior.
// A mirrored text range only positions a decorative cursor from the owner's font.
export function caretGeometry(rect,origin,width,scrollLeft=0,scrollTop=0) {
  // Range rectangles include ancestor zoom; left/top styles use local CSS pixels.
  const scale=origin.width/width;
  if(!Number.isFinite(scale)||scale<=0||rect.height<=0)return null;
  return {x:(rect.left-origin.left)/scale-scrollLeft,y:(rect.top-origin.top)/scale-scrollTop,height:rect.height/scale};
}

export function handwritingCarets(inputs) {
  const refreshers=[];
  for (const input of inputs) {
    const shell=document.createElement('div');shell.className='notes-input-shell';
    input.before(shell);shell.append(input);
    const mirror=document.createElement('div');mirror.className='notes-caret-mirror';mirror.setAttribute('aria-hidden','true');
    const layer=document.createElement('div');layer.className='notes-caret-layer';layer.setAttribute('aria-hidden','true');layer.hidden=true;
    const cursor=document.createElement('span');cursor.className='handwriting-caret';
    layer.append(mirror,cursor);shell.append(layer);
    const properties=['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariant','fontKerning','fontFeatureSettings','fontVariationSettings','fontOpticalSizing','fontVariantLigatures','textRendering','direction','wordBreak','letterSpacing','wordSpacing','lineHeight','textIndent','textTransform','textAlign','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'];
    function refresh() {
      input.classList.remove('has-handwriting-caret');layer.hidden=true;
      if(document.activeElement!==input || input.selectionStart!==input.selectionEnd || input.disabled || input.readOnly) return;
      const style=getComputedStyle(input);
      for(const property of properties)mirror.style[property]=style[property];
      const borderX=Number.parseFloat(style.borderLeftWidth)+Number.parseFloat(style.borderRightWidth);
      const width=input.clientWidth+borderX;
      mirror.style.boxSizing='border-box';mirror.style.width=`${width}px`;
      mirror.textContent=input.value+'\u200b';
      layer.hidden=false;
      const range=document.createRange();range.setStart(mirror.firstChild,input.selectionStart);range.collapse(true);
      const rect=range.getBoundingClientRect(),origin=mirror.getBoundingClientRect();
      const geometry=caretGeometry(rect,origin,width,input.scrollLeft,input.scrollTop);
      if(!geometry) {layer.hidden=true;return;} // Keep native fallback if measurement fails.
      const {x,y,height}=geometry;
      cursor.style.fontFamily=style.fontFamily;cursor.style.fontSize=style.fontSize;
      // The mask is the owner's slash, upright and trimmed to its visible ink.
      // Align its cap-height footprint rather than the font's oversized sidebearings.
      cursor.style.left=`${x}px`;cursor.style.top=`${y+height*.05}px`;cursor.style.height=`${height*.8}px`;
      cursor.style.animation='none';void cursor.offsetWidth;cursor.style.animation='';
      layer.hidden=false;input.classList.add('has-handwriting-caret');
    }
    for(const type of ['input','focus','blur','click','keyup','select','scroll','compositionend'])input.addEventListener(type,refresh);
    const observer=new ResizeObserver(refresh);observer.observe(input);
    refreshers.push(refresh);
  }
  const refreshAll=()=>refreshers.forEach(refresh=>refresh());
  document.addEventListener('selectionchange',refreshAll);
  document.fonts.ready.then(refreshAll);
  document.fonts.addEventListener('loadingdone',refreshAll);
  window.addEventListener('resize',refreshAll);
  return refreshAll;
}
