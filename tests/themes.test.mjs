import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../prototype/',import.meta.url);
const script=await readFile(new URL('theme-init.js',root),'utf8');
function boot(saved){const fields=new Map(),document={documentElement:{dataset:{}},querySelector:selector=>{if(!fields.has(selector))fields.set(selector,{});return fields.get(selector);}};
 const window={};vm.runInNewContext(script,{window,document,URLSearchParams,location:{search:''},localStorage:{getItem:()=>saved}});return {window,document,fields};}
test('Mars preference applies before paint and switches browser, Apple and manifest icons together',()=>{
 const {window,document,fields}=boot(JSON.stringify({theme:'mars'}));assert.equal(document.documentElement.dataset.theme,'mars');assert.match(fields.get('link[rel="apple-touch-icon"]').href,/mars-180/);assert.match(fields.get('link[rel="icon"]').href,/mars-48/);assert.match(fields.get('link[rel="manifest"]').href,/manifest-mars/);
 const color=window.pocketTheme.color('#5279bd'),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));assert.ok(rgb[0]>rgb[1]&&rgb[1]>rgb[2],'Mars maps blue to burnt orange');
 window.pocketTheme.apply('blue');assert.equal(window.pocketTheme.color('#5279bd'),'#5279bd');assert.doesNotMatch(fields.get('link[rel="apple-touch-icon"]').href,/mars/);
});
test('corrupt or unknown preferences fall back to the original blue theme',()=>{
 for(const saved of ['bad json',JSON.stringify({theme:'unknown'}),null])assert.equal(boot(saved).document.documentElement.dataset.theme,'blue');
});
test('all generated LCD tokens have a Mars value; theme-specific manifests reference real PNG assets',async()=>{
 const theme=await readFile(new URL('themes.css',root),'utf8'),defined=new Set([...theme.matchAll(/(--lcd-[\w]+):/g)].map(match=>match[1]));
 for(const file of (await readdir(root)).filter(file=>file.endsWith('.css')&&file!=='themes.css'))for(const match of (await readFile(new URL(file,root),'utf8')).matchAll(/var\((--lcd-[\w]+),/g))assert.ok(defined.has(match[1]),`${file}: ${match[1]}`);
 for(const file of ['manifest.webmanifest','manifest-mars.webmanifest'])for(const icon of JSON.parse(await readFile(new URL(file,root),'utf8')).icons){const data=await readFile(new URL(icon.src.split('?')[0],root));assert.equal(data.subarray(1,4).toString(),'PNG');}
});
