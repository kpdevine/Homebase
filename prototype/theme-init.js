/* Runs before styles paint; keeps appearance local to each device. */
(()=>{
 const suffix=new URLSearchParams(location.search).get('preview')==='1'?'.preview':'';
 function color(hex){
  if(document.documentElement.dataset.theme!=='mars')return hex;
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),hi=Math.max(r,g,b),lo=Math.min(r,g,b),l=((hi+lo)/510)*((hi+lo)/510<.8?.9:1);
  if(hi-lo<12)return hex;
  const mobile=window.matchMedia?.('(max-width:767px), (max-width:1000px) and (max-height:600px) and (orientation:landscape)')?.matches;
  const sat=Math.min(.66,Math.max(.50,(hi-lo)/(255-Math.abs(hi+lo-255))*.55+.16)),c=(1-Math.abs(2*l-1))*sat,x=c*(mobile?10:14)/60,m=l-c/2;
  return '#'+[c+m,x+m,m].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
 }
 function apply(value){
  const theme=value==='mars'?'mars':'blue';document.documentElement.dataset.theme=theme;
  const mars=theme==='mars',base='./assets/icons/pocket-planet'+(mars?'-mars':'');
  document.querySelector('link[rel="icon"]').href=base+'-48.png?v=20261021-stars';
  document.querySelector('link[rel="apple-touch-icon"]').href=base+'-180.png?v=20261021-stars';
  document.querySelector('link[rel="manifest"]').href=mars?'./manifest-mars.webmanifest':'./manifest.webmanifest';
  document.querySelector('meta[name="theme-color"]').content=mars?color('#7890bf'):'#7890bf';
 }
 window.pocketTheme={apply,color};
 try{apply(JSON.parse(localStorage.getItem('homebase.preferences.v1'+suffix))?.theme);}catch{apply('blue');}
})();
