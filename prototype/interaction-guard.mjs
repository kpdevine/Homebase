// Reading an open menu is an interaction too; never infer completion from idle time.
export function workspaceBusy(document,{reviewing=false}={}) {
  if(reviewing)return true;
  if(document.querySelector('dialog[open]'))return true;
  if(document.activeElement?.matches('input,textarea,select,[role="slider"],[contenteditable="true"]'))return true;
  return [...document.querySelectorAll('details[open]')].some(panel=>panel.getClientRects().length>0);
}
