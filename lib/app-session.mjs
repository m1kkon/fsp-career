const COOKIE='fsp_app_session';

// Hosting identity and the career workspace session have separate lifecycles.
// This marker closes the workspace while retaining the hosting sign-in.
export function appSessionClosed(cookie=''){
 return cookie.split(';').some(part=>part.trim()===COOKIE+'=signed_out');
}
export function appSessionCookie(signedOut,url){
 return `${COOKIE}=${signedOut?'signed_out':''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${signedOut?31536000:0}${new URL(url).protocol==='https:'?'; Secure':''}`;
}
