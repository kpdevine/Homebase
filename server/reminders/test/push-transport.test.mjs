import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {sendPush} from '../worker.mjs';

function keyPair(){
  const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=pair.privateKey.export({format:'jwk'});
  return {publicKey:Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url'),privateKey:jwk.d};
}
function fixture(){
  const vapid=keyPair(),client=keyPair();
  return {subscription:{endpoint:'https://web.push.apple.com/test-only',keys:{p256dh:client.publicKey,auth:randomBytes(16).toString('base64url')}},env:{VAPID_PUBLIC_KEY:vapid.publicKey,VAPID_PRIVATE_KEY:vapid.privateKey}};
}
test('daily push encrypts its payload and uses the Cloudflare-supported redirect policy',async()=>{
  const {subscription,env}=fixture();let calls=0;
  const response=await sendPush(subscription,{body:'Test daily reminder',date:'2026-10-25'},env,{fetcher:async(url,options)=>{
    calls++;
    // workerd throws before networking for redirect:error, while Node accepts it.
    if(options.redirect==='error')throw new TypeError('Invalid redirect value');
    assert.equal(options.redirect,'manual');assert.equal(url,subscription.endpoint);
    assert.equal(options.method,'post');assert.equal(options.headers.ttl,'1800');
    assert.equal(options.headers['content-encoding'],'aes128gcm');assert.match(options.headers.authorization,/^vapid t=/);
    assert.ok(options.signal instanceof AbortSignal);assert.ok(options.body instanceof Uint8Array);
    assert.ok(options.body.byteLength>100);assert.equal(Buffer.from(options.body).includes(Buffer.from('Test daily reminder')),false);
    return new Response(null,{status:201});
  }});
  assert.equal(calls,1);assert.equal(response.status,201);
});
test('a redirect response is returned as a rejection without forwarding push credentials',async()=>{
  const {subscription,env}=fixture();let calls=0;
  const response=await sendPush(subscription,{body:'Test'},env,{fetcher:async(url,options)=>{
    calls++;assert.equal(options.redirect,'manual');
    return new Response(null,{status:307,headers:{Location:'https://example.com/untrusted'}});
  }});
  assert.equal(calls,1);assert.equal(response.status,307);assert.equal(response.ok,false);
});
