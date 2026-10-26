import {vibesReactions} from './social-model.mjs';
export function mountVibesReactions({getApi,getUser,getPerson,changed,bubble}){
  let group=null,target=null,rows=[],stop=null,serial=0,loading=true,failed=false;
  const anchor=()=>[...document.querySelectorAll('[data-solar-vibes]')].find(button=>button.dataset.solarVibes===target);
  function content(){const person=getPerson(target);return {title:'@'+(person?.username||'Member')+' · Current vibes',rows:vibesReactions(rows,target,person?.vibesVersion||'legacy').map(row=>({...row,username:getPerson(row.reactor)?.username||row.username})),user:getUser()?.uid,own:target===getUser()?.uid,loading,canReact:!failed&&!!person?.vibes?.trim(),feedback:failed?'Reactions unavailable':''};}
  function paint(){if(target)bubble.update(content());}
  function sync(next){if(group===next)return;stop?.();stop=null;group=next;rows=[];loading=true;failed=false;const active=++serial;if(target)bubble.close();if(next)stop=getApi().watchVibesReactions(next,value=>{if(active!==serial)return;rows=value;loading=false;failed=false;changed();paint();},()=>{if(active!==serial)return;loading=false;failed=true;changed();paint();});}
  function open(uid){
    if(!group||!getPerson(uid)?.vibes?.trim())return;bubble.close();target=uid;const system=group;
    bubble.show({...content(),anchor,onClose:()=>target=null,onReact:kind=>getApi().reactVibes(system,uid,getPerson(uid)?.vibesVersion||'legacy',kind)});
  }
  return {sync,paint,open,reactions:()=>rows,reset:()=>sync(null)};
}
