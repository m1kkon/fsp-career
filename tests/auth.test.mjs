import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {hashPassword, verifyPassword, sessionCookie, sessionToken} from '../lib/auth.mjs';
import {checkOrigin, jsonBody} from '../lib/http.mjs';
test('passwords have independent salts and only the right password verifies', async () => {
 const password = 'a sufficiently long password';
 const a = await hashPassword(password), b = await hashPassword(password);
 assert.notEqual(a,b); assert.equal(a.includes(password),false);
 assert.equal(await verifyPassword(password,a),true);
 assert.equal(await verifyPassword('wrong',a),false);
 assert.equal(await verifyPassword(password,'invalid'),false);
});
test('the initial scrypt format remains readable while new passwords use the stronger version', async () => {
 const salt='0123456789abcdef0123456789abcdef', password='a sufficiently long password';
 const key=scryptSync(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 assert.equal(await verifyPassword(password,`scrypt:${salt}:${key.toString('hex')}`),true);
 assert.match(await hashPassword(password),/^scrypt-v2:/);
});
test('session cookie is opaque, HTTP-only, secure in production and can be cleared', () => {
 const previous = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
 try {
  const token = 'a'.repeat(64), cookie = sessionCookie(token);
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);
  assert.equal(sessionToken(cookie),token);assert.equal(sessionToken('fsp_session=forged'),null);
  assert.match(sessionCookie(),/Max-Age=0/);
 } finally { if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous; }
});
test('write origin is checked against the configured public HTTPS URL behind a proxy', () => {
 const previous = process.env.APP_URL;process.env.APP_URL='https://career.example.com';
 try {
  assert.doesNotThrow(()=>checkOrigin(new Request('http://app:3000/api/action',{headers:{origin:'https://career.example.com'}})));
  assert.throws(()=>checkOrigin(new Request('http://app:3000/api/action',{headers:{origin:'https://evil.example'}})),e=>e.status===403);
 }finally{if(previous===undefined)delete process.env.APP_URL;else process.env.APP_URL=previous;}
});
test('JSON body limits include chunked bodies without content-length', async () => {
 const request = body => new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body});
 assert.deepEqual(await jsonBody(request('{"action":"profile"}')),{action:'profile'});
 await assert.rejects(jsonBody(request('[')),e=>e.status===400);
 await assert.rejects(jsonBody(request('[]')),e=>e.status===400);
 await assert.rejects(jsonBody(request(JSON.stringify({value:'a'.repeat(30001)}))),e=>e.status===413);
});
