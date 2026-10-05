import {spawn} from 'node:child_process';
import {versionClientAssets} from './version-client-assets.mjs';
const [command, ...args] = process.argv.slice(2);
if (!['dev', 'build'].includes(command)) throw new Error('Expected dev or build');
versionClientAssets();
const child = spawn(process.execPath, ['./node_modules/next/dist/bin/next', command, ...args], {stdio:'inherit'});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
