// Active choices stay separate from the old combined Legs category.
export const GROUPS = [
  { id:'chest', name:'Chest', target:12 },
  { id:'back', name:'Back', target:14 },
  { id:'triceps', name:'Triceps', target:8 },
  { id:'biceps', name:'Biceps', target:8 },
  { id:'shoulders', name:'Shoulders', target:10 },
  { id:'quads', name:'Quads', target:8 },
  { id:'hamstrings', name:'Hamstrings', target:8 },
];
export const ALL_GROUPS = [...GROUPS, { id:'legs', name:'Legs', target:16 }];
export const muscleName = id => ALL_GROUPS.find(group=>group.id===id)?.name || id;
