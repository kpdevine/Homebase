// Explicit reassurance alongside autosaving notes. Saving flushes the existing
// local queue; it does not submit a day review or force a duplicate cloud write.
export function mountNoteSaves({save,getDate,isEditable,root=document}) {
  const dirty=new Set(),entries=[];
  const keyFor=entry=>`${getDate()}:${entry.kind}`;
  function refresh() {
    for(const entry of entries) {
      const {inputs,row,button}=entry;
      row.hidden=!dirty.has(keyFor(entry))||!isEditable()||inputs.some(input=>input.readOnly||input.disabled);
      button.textContent='Save';
    }
  }
  function register(inputs,{id,kind,label,anchor,append=false}) {
    const row=document.createElement('div');row.className='note-save-actions';
    const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');
    const button=document.createElement('button');button.type='button';button.className='quiet-button note-save-button';
    button.id=`save-${id}`;button.setAttribute('aria-controls',inputs.map(input=>input.id).join(' '));
    button.setAttribute('aria-label',`Save ${label}`);
    row.append(status,button);if(append)anchor.append(row);else anchor.after(row);
    const entry={inputs,row,button,kind};entries.push(entry);
    for(const input of inputs)input.addEventListener('input',()=>{dirty.add(keyFor(entry));status.textContent='';refresh();});
    button.addEventListener('click',()=>{
      if(!isEditable()||inputs.some(input=>input.readOnly||input.disabled))return;
      const invalid=inputs.find(input=>!input.validity.valid);if(invalid){invalid.reportValidity();return;}
      let ok=false;try{ok=save();}catch{/* Keep the user's text and show an honest failure. */}
      if(ok)dirty.delete(keyFor(entry));
      refresh();
      status.textContent=ok?'Saved on this device.':'Could not save. Open Settings for saving and backup options.';
      if(!ok)button.textContent='Try again';
    });
  }
  for(const input of root.querySelectorAll('textarea[data-notes]'))register([input],{id:input.id,kind:input.dataset.notes.replace('-final',''),label:input.getAttribute('aria-label')||'notes',anchor:input.closest('.notes-input-shell')||input});
  for(const [id,label] of [['food-amounts','protein and calories'],['other-training-log','training minutes']]){const anchor=root.querySelector('#'+id);if(anchor)register([...anchor.querySelectorAll('input')],{id,kind:id,label,anchor,append:true});}
  refresh();return {refresh};
}
