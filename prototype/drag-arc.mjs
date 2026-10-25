// Unwrap the pointer angle across the bottom gap. Preserve any overshoot so the
// handle cannot re-enter at the opposite pole during the same pointer gesture.
const normalized=angle=>((angle%360)+360)%360;
export const arcScore=position=>Math.max(0,Math.min(330,position))/33;
export function startArcDrag(angle){
  const offset=normalized(angle);
  return {previous:offset,position:offset>=345?offset-360:offset};
}
export function moveArcDrag(drag,angle){
  const offset=normalized(angle);
  const raw=offset-drag.previous;
  let delta=((raw+540)%360)-180;
  // Opposite points are ambiguous; preserve their signed direction instead of
  // forcing a clockwise upper-half drag to travel through the bottom gap.
  if(Math.abs(delta+180)<1e-8&&raw>0)delta=180;
  drag.previous=offset;drag.position+=delta;
  return arcScore(drag.position);
}
