import {meterPath,meterPoint} from './model.mjs';
import {REACTION_ASSETS} from './reaction-assets.mjs';

const references=[null,'crying','sad',null,'thinking',null,'happy',null,'strong','party','fire'];
const bounded=value=>Math.max(0,Math.min(10,value??0));
export function planetForScore(score){
  const band=Math.floor(bounded(score));
  return references[band]?REACTION_ASSETS[references[band]].icon:`./assets/score-planets/score-${band}-icon.webp`;
}
export function orbitalColor(score,theme='blue'){
  const colors=theme==='mars'?['#ffc08a','#ffd0a8','#ffdfc1','#ffebd7','#fff2df','#fff6c9']:['#6ebdff','#90d0ff','#afe1ff','#d0efff','#e4f7ff','#fff6c9'];
  const position=bounded(score)/2,index=Math.min(colors.length-2,Math.floor(position)),amount=position-index;
  const rgb=hex=>[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16));
  const from=rgb(colors[index]),to=rgb(colors[index+1]);
  return '#'+from.map((value,channel)=>Math.round(value+(to[channel]-value)*amount).toString(16).padStart(2,'0')).join('');
}
export function orbitalStyle(score,{theme='blue',unit=1}={}){
  return `--orbit-fill:${orbitalColor(score,theme)};--orbit-edge:${theme==='mars'?'#4c2017':'#142650'};--orbit-rail:${theme==='mars'?'#62372b':'#30456d'};--orbit-glow:${score===null?0:(6+bounded(score)*.8)*unit}px`;
}
const svgElement=(document,name,attributes)=>{
  const element=document.createElementNS('http://www.w3.org/2000/svg',name);
  for(const [key,value] of Object.entries(attributes))element.setAttribute(key,value);
  return element;
};
export function drawOrbitalMeter(meter,score,{setFill,immediate=false,max=10}={}){
  const document=meter.ownerDocument,svg=meter.querySelector('svg');
  const size=Number(svg.getAttribute('viewBox').split(/\s+/)[2]),unit=size/240,center=size/2,radius=86*unit;
  svg.setAttribute('viewBox',`0 0 ${size} ${size}`);
  meter.classList.add('standard-score-meter','orbital-meter');
  meter.classList.toggle('score-ten',score===10);
  const normalized=score===null?null:bounded(score/max*10),theme=document.documentElement.dataset.theme;
  const style=orbitalStyle(normalized,{theme,unit});
  for(const declaration of style.split(';')){const [key,value]=declaration.split(':');meter.style.setProperty(key,value);}
  const track=svg.querySelector('.meter-track'),fill=svg.querySelector('.meter-fill');
  let bloom=svg.querySelector('.meter-bloom'),edge=svg.querySelector('.meter-edge');
  if(!bloom){bloom=svgElement(document,'path',{class:'meter-bloom',pathLength:100});svg.insertBefore(bloom,track);}
  if(!edge){edge=svgElement(document,'path',{class:'meter-edge',pathLength:100});svg.insertBefore(edge,fill);}
  const path=meterPath(radius,center),percent=(normalized??0)*10;
  for(const element of [track,bloom,edge,fill])element.setAttribute('d',path);
  for(const element of [bloom,edge,fill]){
    element.setAttribute('pathLength',100);element.setAttribute('stroke-dasharray',`${percent} 100`);
    element.style.opacity=percent===0?'0':'';
  }
  track.style.strokeWidth=10*unit;fill.style.strokeWidth=10*unit;edge.style.strokeWidth=14*unit;bloom.style.strokeWidth=19*unit;
  if(setFill)setFill(fill,percent,{immediate});
  meter.querySelectorAll('.sentiment-endpoint,.target-endpoint').forEach(element=>element.classList.add('meter-endpoint'));
  if(!meter.querySelector('.meter-endpoint'))meter.insertAdjacentHTML('beforeend',`<span class="meter-endpoint start" aria-hidden="true">0</span><span class="meter-endpoint end" aria-hidden="true">${max}</span>`);
  // Only editable controls receive a draggable planet. CSS also hides it if a
  // settings update changes an existing slider to a passive macro display.
  let handle=meter.querySelector('.orbital-planet');
  if(meter.getAttribute('role')==='slider'){
    if(!handle){handle=document.createElement('span');handle.className='orbital-planet';handle.setAttribute('aria-hidden','true');handle.innerHTML='<img alt="" draggable="false" width="160" height="160">';meter.append(handle);}
    const point=meterPoint(1+(normalized??0)*.9,radius,center),img=handle.querySelector('img'),src=planetForScore(normalized);
    handle.style.left=`${point.x/size*100}%`;handle.style.top=`${point.y/size*100}%`;
    if(img.getAttribute('src')!==src)img.src=src;
  }else handle?.remove();
}
export function orbitalCircle(score,text,{theme='blue',classes=''}={}){
  const path=meterPath(20,24),percent=(score??0)*10;
  const arc=`d="${path}" pathLength="100" stroke-dasharray="${percent} 100"${percent===0?' style="opacity:0"':''}`;
  return `<span class="score-circle orbital-score-circle ${score===null?'no-score':''} ${classes}" style="${orbitalStyle(score,{theme,unit:.2})}" aria-hidden="true"><svg viewBox="0 0 48 48"><path class="score-circle-bloom" ${arc}/><path class="score-circle-track" d="${path}"/><path class="score-circle-outline" ${arc}/><path class="score-circle-fill" ${arc}/></svg><span>${score===10?`<span class="orbit-ten-number">${text}</span>`:text}</span></span>`;
}
