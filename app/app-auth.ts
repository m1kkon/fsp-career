import {headers} from 'next/headers';
import {currentUser} from '../lib/auth.mjs';
export async function getAppUser() { return currentUser((await headers()).get('cookie') || ''); }
