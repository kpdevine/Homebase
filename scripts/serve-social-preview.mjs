import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../prototype/',import.meta.url));
const fixture=fileURLToPath(new URL('./fixtures/social-preview.mjs',import.meta.url));
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),pathname=url.pathname;
    if(pathname==='/phone-preview'){
      const width=[320,375,390,430].includes(Number(url.searchParams.get('width')))?Number(url.searchParams.get('width')):390;
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pocket Planet · iPhone width ${width}px</title><style>html,body{margin:0;background:#172235;color:#edf5ff;font:12px sans-serif}p{text-align:center;margin:10px}iframe{display:block;width:${width}px;height:844px;max-width:100%;margin:0 auto;border:1px solid #49628f;border-radius:12px;background:#7890bf}</style></head><body><p>iPhone-sized layout · ${width}px · sample records only</p><iframe title="Pocket Planet phone preview" src="/?preview=1&socialDemo=1"></iframe></body></html>`);return;
    }
    const target=pathname==='/sample-social.mjs'?fixture:path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
    if(target!==fixture&&path.relative(root,target).startsWith('..')){res.writeHead(403).end();return;}
    let body=await readFile(target);
    if(pathname==='/app.mjs'){
      let source=body.toString();
      source=source.replace("const suffix = preview ? '.preview' : '';","const demoMode=preview&&new URLSearchParams(location.search).get('socialDemo')==='1';\nconst suffix = preview ? '.preview' : '';");
      source=source.replace('seed: preview, snapshot: loaded.snapshot','seed: preview&&!demoMode, snapshot: loaded.snapshot');
      source=source.replace('socialUI=mountSocial({','const demoCloud=demoMode?(await import(\'/sample-social.mjs\')).createSocialPreview(store,editableToday):null;\nsocialUI=mountSocial({');
      source=source.replace('getCloud:()=>cloud,showFriends:','getCloud:()=>demoCloud||cloud,showFriends:');
      source+='\nif(demoCloud){await socialUI.setUser({uid:"demo-me"});setView("friends");document.querySelector("#friend-manager").open=true;const banner=document.createElement("p");banner.className="hint";banner.textContent="Sample Solar System · disconnected demo · search nina or leo to test profiles and friend requests. Log today to test required vibes.";document.querySelector("#friends-view").prepend(banner);}\n';
      body=source;
    }
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'self'"}).end(body);
  }catch(error){res.writeHead(404).end('Not found');}
});
const port=Number(process.env.PORT||4215);
server.listen(port,'127.0.0.1',()=>console.log(`Pocket Planet sample Solar System: http://127.0.0.1:${port}/?preview=1&socialDemo=1`));
