import {headers} from 'next/headers';
import {getChatGPTUser} from './chatgpt-auth';
import {appSessionClosed} from '../lib/app-session.mjs';

export async function getAppUser(){
 const requestHeaders=await headers();
 if(appSessionClosed(requestHeaders.get('cookie')||''))return null;
 return getChatGPTUser();
}
