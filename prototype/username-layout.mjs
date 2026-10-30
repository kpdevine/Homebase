let canvas;

// Measure the actual loaded handwriting face rather than guessing character
// widths. Safari can finish loading it after the card's initial layout.
export function fitShortUsernames(root=document){
  canvas??=document.createElement('canvas');
  const measure=canvas.getContext('2d');if(!measure)return;
  const names=root.querySelectorAll('.leaderboard-user-name,.solar-member-profile-link,.manage-friend-open,.profile-friend-grid [data-view-profile],.request-profile-link');
  for(const button of names){
    const label=button.querySelector('.profile-username')||button;
    const text=label.textContent.trim(),short=Array.from(text.replace(/^@/,'')).length<=12;
    button.classList.toggle('short-username',short);
    label.style.removeProperty('font-size');
    if(!short||!button.clientWidth)continue;
    const box=getComputedStyle(button),font=getComputedStyle(label);
    const available=button.clientWidth-parseFloat(box.paddingLeft)-parseFloat(box.paddingRight)-2;
    const base=parseFloat(font.fontSize);if(available<=0||!Number.isFinite(base))continue;
    measure.font=`${font.fontWeight} ${base}px ${font.fontFamily}`;
    const width=measure.measureText(text).width;
    label.style.fontSize=`${Math.floor(Math.min(base,base*available/Math.max(1,width))*10)/10}px`;
  }
}
