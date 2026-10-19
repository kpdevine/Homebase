import test from 'node:test';
import assert from 'node:assert/strict';
import {authDomainFor,firebaseConfig} from '../prototype/firebase-config.mjs';

test('custom-domain authentication uses the same origin while existing app addresses retain their auth domain',()=>{
  assert.equal(authDomainFor('pocketplanet.day'),'pocketplanet.day');
  for(const hostname of ['homebase-d3c6c.firebaseapp.com','homebase-d3c6c.web.app','localhost','127.0.0.1',''])assert.equal(authDomainFor(hostname),'homebase-d3c6c.firebaseapp.com');
  assert.equal(firebaseConfig.projectId,'homebase-d3c6c');
  assert.equal(firebaseConfig.appId,'1:1097810811129:web:d56ab286536d254c3eea28');
});

test('unconfigured subdomains and lookalike hosts cannot become authentication destinations',()=>{
  for(const hostname of ['pocketplanet.day.example.com','notpocketplanet.day','www.pocketplanet.day'])assert.equal(authDomainFor(hostname),'homebase-d3c6c.firebaseapp.com');
});
