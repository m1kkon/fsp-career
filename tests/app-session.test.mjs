import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appSessionClosed,appSessionCookie} from '../lib/app-session.mjs';

test('workspace logout is independent of the hosting cookie',()=>{
 assert.equal(appSessionClosed('hosting_identity=still_active; fsp_app_session=signed_out'),true);
 assert.equal(appSessionClosed('hosting_identity=still_active'),false);
 assert.equal(appSessionClosed('other_fsp_app_session=signed_out'),false);
 assert.equal(appSessionClosed('fsp_app_session=; other=value'),false);
});
test('workspace cookies are scoped, HTTP-only and secure in production; login clears the logout marker',()=>{
 const logout=appSessionCookie(true,'https://example.test/api/session');
 assert.match(logout,/fsp_app_session=signed_out/);assert.match(logout,/Path=\/; HttpOnly; SameSite=Lax/);assert.match(logout,/; Secure$/);
 assert.match(appSessionCookie(false,'https://example.test/api/session'),/Max-Age=0/);
 assert.ok(!appSessionCookie(true,'http://127.0.0.1:4173/api/session').includes('Secure'));
});
