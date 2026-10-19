export function profileName(value) {
  return typeof value==='string'&&value.trim()&&value.trim().length<=30?value.trim():null;
}

export function needsWelcome({preview,preferences={},snapshot,error}) {
  if(preview||error||preferences.welcomed||profileName(preferences.name))return false;
  // Keep established local workspaces intact, including older nameless installs.
  return !snapshot||![snapshot.days,snapshot.entries,snapshot.templates].some(records=>records?.length);
}
