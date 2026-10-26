import {REACTIONS} from './reaction-kinds.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountReactionBubble({planetEmoji}){
  const bubble=document.createElement('div');bubble.className='reaction-bubble';bubble.hidden=true;bubble.setAttribute('role','dialog');bubble.setAttribute('aria-label','Planet reactions');
  bubble.innerHTML=`<div class="reaction-bubble-heading"><strong></strong><button type="button" class="icon-button" aria-label="Close reactions">×</button></div><div class="reaction-bubble-counts"></div><div class="reaction-bubble-picker">${REACTIONS.map(row=>`<button type="button" data-bubble-react="${row.id}" aria-label="${esc(row.label)}" aria-pressed="false">${planetEmoji(row.id)}</button>`).join('')}</div><div class="reaction-bubble-footer"><span role="status"></span><button type="button" class="text-button" data-bubble-details>View day</button></div>`;
  document.body.append(bubble);
  const title=bubble.querySelector('strong'),counts=bubble.querySelector('.reaction-bubble-counts'),picker=bubble.querySelector('.reaction-bubble-picker'),status=bubble.querySelector('[role=status]'),details=bubble.querySelector('[data-bubble-details]');let config=null,busy=false;
  function close({focus=false}={}){if(!config)return;const previous=config,trigger=previous.anchor();config=null;bubble.hidden=true;previous.onClose?.();if(focus)trigger?.focus({preventScroll:true});}
  function position(){
    if(!config||bubble.hidden)return;const anchor=config.anchor();if(!anchor?.isConnected){close();return;}
    const rect=anchor.getBoundingClientRect(),view=window.visualViewport,left=view?.offsetLeft||0,top=view?.offsetTop||0,width=view?.width||innerWidth,height=view?.height||innerHeight;
    const box=bubble.getBoundingClientRect(),x=Math.max(left+8,Math.min(left+width-box.width-8,rect.left+rect.width/2-box.width/2));
    const above=rect.top-box.height-10>=top+8,y=above?rect.top-box.height-10:Math.min(rect.bottom+10,top+height-box.height-8);
    bubble.style.left=x+'px';bubble.style.top=Math.max(top+8,y)+'px';bubble.dataset.side=above?'above':'below';bubble.style.setProperty('--bubble-tail',Math.max(16,Math.min(box.width-16,rect.left+rect.width/2-x))+'px');
  }
  function paint(){
    if(!config)return;title.textContent=config.title;const rows=config.rows||[],mine=rows.find(row=>row.reactor===config.user)?.kind;
    counts.innerHTML=REACTIONS.map(kind=>{const people=rows.filter(row=>row.kind===kind.id);return people.length?`<span title="${esc(people.map(row=>'@'+row.username).join(', '))}" aria-label="${esc(kind.label+': '+people.map(row=>'@'+row.username).join(', '))}">${planetEmoji(kind.id)}<b>${people.length}</b></span>`:'';}).join('');
    picker.hidden=!!config.own;for(const button of picker.children){button.setAttribute('aria-pressed',String(button.dataset.bubbleReact===mine));button.disabled=busy||config.loading||config.canReact===false;}
    details.hidden=!config.onDetails;status.textContent=config.loading?'Loading…':config.feedback||(config.own?(rows.length?'Your reactions':'No reactions yet'):'Tap again to remove');position();
  }
  function show(next){close();config=next;busy=false;bubble.hidden=false;paint();(config.own||config.loading?bubble.querySelector('.reaction-bubble-heading button'):picker.querySelector('[aria-pressed=true]')||picker.firstElementChild).focus({preventScroll:true});}
  bubble.querySelector('.reaction-bubble-heading button').onclick=()=>close({focus:true});
  details.onclick=()=>{const open=config?.onDetails;close();open?.();};
  picker.onclick=async event=>{const button=event.target.closest('[data-bubble-react]');if(!button||!config||busy||button.disabled)return;const current=config,kind=(config.rows||[]).find(row=>row.reactor===config.user)?.kind===button.dataset.bubbleReact?null:button.dataset.bubbleReact;busy=true;paint();try{const notified=await current.onReact(kind);if(config===current)config.feedback=kind?notified===false?'Saved · alert unavailable':'Reaction sent':'Reaction removed';}catch(error){if(config===current)config.feedback=error.message;}finally{if(config===current){busy=false;paint();}}};
  document.addEventListener('pointerdown',event=>{if(config&&!bubble.contains(event.target)&&!config.anchor()?.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(config&&event.key==='Escape'){event.preventDefault();close({focus:true});}});
  window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.addEventListener('scroll',position,true);
  return {show,close,update(value){if(config){Object.assign(config,value);paint();}},isOpen:()=>!!config};
}
