export function profileName(value) {
  return typeof value==='string'&&value.trim()&&value.trim().length<=30?value.trim():null;
}

export function googleFirstName(displayName) {
  return profileName(typeof displayName==='string'?displayName.trim().split(/\s+/)[0].slice(0,30):null)||'Friend';
}

export function needsWelcome({preview,preferences={},snapshot,error}) {
  if(preview||error||preferences.welcomed||profileName(preferences.name)||snapshot?.settings?.setupComplete||snapshot?.settings?.tabsChosen)return false;
  // Keep established local workspaces intact, including older nameless installs.
  return !snapshot||![snapshot.days,snapshot.entries,snapshot.templates].some(records=>records?.length);
}

export function needsLoggingSetup({snapshot,preview=false,cloudStatus='loading',hasUser=false,error=false}={}) {
  if(error||snapshot?.settings?.setupComplete||snapshot?.settings?.tabsChosen)return false;
  // Older installs had no setup flag. Real logs still establish a workspace;
  // the empty record written on first launch does not.
  if(snapshot?.entries?.length||snapshot?.templates?.length||snapshot?.days?.some(day=>
    day.completedAt||day.checklistTouched||day.tasks?.length||day.nutrition!=null||day.trainingMode&&day.trainingMode!=='unlogged'||
    day.food?.protein!=null||day.food?.calories!=null||day.trainingMinutes!=null||day.sleep?.minutes!=null||day.prayer?.minutes!=null||
    day.sentiments?.rating!=null||day.sentiments?.notes?.trim()||Object.values(day.notes||{}).some(value=>value?.trim())||Object.values(day.reviewed||{}).some(Boolean)
  ))return false;
  // Let authentication and the first cloud merge finish before opening a modal.
  // A setup modal would otherwise block that merge as an active editor.
  if(preview)return true;
  return hasUser?cloudStatus==='synced':['signed-out','unconfigured'].includes(cloudStatus);
}
