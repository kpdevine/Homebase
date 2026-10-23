import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {REACTION_ASSETS} from '../prototype/reaction-assets.mjs';
import {REACTIONS} from '../prototype/social-model.mjs';

test('all planets have valid, small WebP variants with immutable content hashes',async()=>{
  assert.equal(REACTIONS.length,22);
  assert.equal(Object.keys(REACTION_ASSETS).length,REACTIONS.length);
  let total=0;
  for(const {id} of REACTIONS)for(const kind of ['icon','portrait']){
    const path=REACTION_ASSETS[id][kind],data=await readFile(new URL('../prototype/'+path.slice(2),import.meta.url));
    assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');
    assert.ok(path.includes(createHash('sha256').update(data).digest('hex').slice(0,12)));
    assert.ok(data.length<(kind==='icon'?30000:60000));total+=data.length;
  }
  assert.ok(total<1000000,'all 22 icons and portraits stay below 1 MB combined');
});
