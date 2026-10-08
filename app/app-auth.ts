import {headers} from 'next/headers';
import {currentUser} from '../lib/auth.mjs';
import {demoIdentity} from '../lib/demo-memory.mjs';
export async function getAppUser() { return process.env.FSP_DEMO_MODE === '1' ? demoIdentity() : currentUser((await headers()).get('cookie') || ''); }
