import {canonical,recordChanges} from './cloud-records.mjs';

export function validEditTime(value,now=Date.now()) {
  return Number.isSafeInteger(value)&&value>0&&value<=now+60000;
}
// A compact identity check ties each edit time to its exact saved payload.
// This is a storage checksum, not a security/authentication mechanism.
function fingerprint(payload) {
  if(payload===null)return null;
  let a=2166136261,b=5381;
  for(let index=0;index<payload.length;index++){const c=payload.charCodeAt(index);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}
  return `${payload.length}:${a>>>0}:${b>>>0}`;
}
export function createRecordEdits({records,load=()=>null,save=()=>{},now=Date.now}) {
  let previous=new Map(records),ledger={};
  try {const value=load();if(value&&typeof value==='object'&&!Array.isArray(value))ledger=value;}catch{}
  const persist=()=>{try{save(ledger);}catch{/* Unknown times safely fall back to manual choice after reload. */}};
  return {
    capture(next,at=now()) {
      if(!validEditTime(at,now()))return;
      for(const change of recordChanges(previous,next))ledger[change.id]={fingerprint:fingerprint(change.after),at};
      previous=new Map(next);persist();
    },
    times(current) {
      return new Map([...current].flatMap(([id,payload])=>{const entry=ledger[id];return entry&&entry.fingerprint===fingerprint(payload)&&validEditTime(entry.at,now())?[[id,entry.at]]:[];}));
    },
    adopt(current,times) {
      const next={};for(const [id,payload] of current){const at=times.get(id);if(validEditTime(at,now()))next[id]={fingerprint:fingerprint(payload),at};}
      ledger=next;previous=new Map(current);persist();
    },
  };
}
export function unpackCloudPayload(payload) {
  const value=JSON.parse(payload),editedAt=value._editedAt;delete value._editedAt;
  return {payload:canonical(value),editedAt:validEditTime(editedAt)?editedAt:null};
}
export function matchesCloudVersion(record,change) {
  return (record?.payload??null)===change.before&&(record?.editedAt??null)===(change.beforeEditedAt??null);
}
export function packCloudPayload(payload,editedAt) {
  const value=JSON.parse(payload);delete value._editedAt;
  if(validEditTime(editedAt))value._editedAt=editedAt;
  const packed=canonical(value);
  if(new TextEncoder().encode(packed).length<=850000)return packed;
  delete value._editedAt;return canonical(value);
}
