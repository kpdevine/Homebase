/* A brief, local-only welcome; never wait for cloud sync or block interaction. */
(()=>{
  const params=new URLSearchParams(location.search);
  const demo=params.get('preview')==='1'&&params.get('opening')==='1';
  if(!/iPhone|iPod/.test(navigator.userAgent)&&!demo)return;
  const root=document.documentElement,ringDuration=400,exitDuration=180;
  let ready=false,imageReady=false,imageFailed=false,image,started=Date.now();
  let hiding,cleanup,deadline,hiddenAt=null,active=false;
  let motion='full';
  try{motion=JSON.parse(localStorage.getItem('homebase.preferences.v1'+(params.get('preview')==='1'?'.preview':'')))?.motion||'full';}catch{}
  root.dataset.launchMotion=motion==='reduced'||motion!=='full'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'reduced':'full';
  const mascotSource=()=>`./assets/mascots/pocket-planet-${root.dataset.theme==='mars'?'mars':'blue'}.png?v=20261021-cutout`;
  function clear(){clearTimeout(hiding);clearTimeout(cleanup);clearTimeout(deadline);}
  function remove(){clear();active=false;delete root.dataset.phoneLaunch;delete root.dataset.launchImage;}
  function finish(){
    if(!active)return;
    clear();root.dataset.phoneLaunch='leaving';
    cleanup=setTimeout(remove,root.dataset.launchMotion==='reduced'?0:exitDuration);
  }
  function settle(){
    if(!active||!ready)return;
    clearTimeout(hiding);
    // Decorative assets never extend the wait once the app is ready.
    hiding=setTimeout(finish,root.dataset.launchMotion==='reduced'?0:Math.max(0,started+ringDuration-Date.now()));
  }
  function reveal(){
    if(!active||!imageReady)return;
    root.dataset.launchImage=imageFailed?'unavailable':'ready';
    settle();
  }
  function show(){
    clear();started=Date.now();active=true;delete root.dataset.launchImage;
    root.dataset.phoneLaunch='show';
    if(image&&image.getAttribute('src')!==mascotSource()){
      imageReady=false;imageFailed=false;image.src=mascotSource();
    }
    reveal();
    // Neither a failed render nor a missing asset can leave a permanent cover.
    deadline=setTimeout(finish,1400);
  }
  show();
  document.addEventListener('DOMContentLoaded',()=>{
    image=document.getElementById('phone-launch-mascot');
    if(!image){remove();return;}
    image.addEventListener('load',()=>{image.hidden=false;imageReady=true;imageFailed=false;reveal();});
    image.addEventListener('error',()=>{image.hidden=true;imageReady=true;imageFailed=true;reveal();});
    image.src=mascotSource();
    if(image.complete&&image.naturalWidth){imageReady=true;reveal();}
  },{once:true});
  window.pocketLaunch={ready(){ready=true;settle();}};
  if(demo)window.pocketLaunch.replay=show;
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hiddenAt=Date.now();remove();}
    else if(hiddenAt!==null){const away=Date.now()-hiddenAt;hiddenAt=null;if(ready&&away>=30000)show();}
  });
  window.addEventListener('pageshow',event=>{if(event.persisted&&ready)show();});
})();
