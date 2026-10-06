import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const sourceRoot=new URL('../',import.meta.url);
for(const failure of ['', 'container', 'timer', 'backup'])test(`release ${failure||'success'} preserves secrets and ${failure?'restores':'advances'} the current version`,()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'fsp-release-test-')));
 try{
  const previous=path.join(root,'previous'),release=path.join(root,'next'),bin=path.join(root,'bin'),systemd=path.join(root,'systemd');
  for(const dir of [previous,release,bin,systemd])fs.mkdirSync(dir);
  fs.symlinkSync(previous,path.join(root,'current'));
  const initial=`POSTGRES_PASSWORD=${'1'.repeat(64)}\nSITE_DOMAIN=fspcareer.space\nAPP_VERSION=previous\nSITE_REDIRECT_DOMAINS=www.fspcareer.space\nRESEND_API_KEY=re_test_not_real\nMAIL_TOKEN_KEY=${'2'.repeat(64)}\nEMAIL_FROM=Test <no-reply@fspcareer.space>\nRELEASE_SHA=${'b'.repeat(40)}\n`;
  fs.writeFileSync(path.join(root,'.env'),initial,{mode:0o600});
  for(const dir of [previous,release]){
   fs.mkdirSync(path.join(dir,'deploy'));
   fs.writeFileSync(path.join(dir,'deploy/backup.sh'),`#!/bin/bash\necho backup >> "$FSP_DEPLOY_ROOT/calls"\nif [ "$PWD" = "$FSP_DEPLOY_ROOT/next" ] && [ "$FSP_TEST_FAIL" = backup ]; then exit 1; fi\n`);
  }
  fs.copyFileSync(new URL('deploy/init-env.py',sourceRoot),path.join(release,'deploy/init-env.py'));
  for(const file of ['fsp-backup.service','fsp-backup.timer','fsp-mail.service','fsp-mail.timer'])fs.copyFileSync(new URL('deploy/'+file,sourceRoot),path.join(release,'deploy',file));
  const rootGuard='if [ "$EUID" -ne 0 ]; then echo \'Run with sudo.\' >&2; exit 1; fi\n';
  const script=fs.readFileSync(new URL('deploy/release.sh',sourceRoot),'utf8');
  assert.ok(script.includes(rootGuard));
  // Only bypass the root guard in the isolated fixture; all release logic runs.
  fs.writeFileSync(path.join(release,'release-test.sh'),script.replace(rootGuard,''));
  const mocks={
   docker:'echo "docker $PWD $*" >> "$FSP_DEPLOY_ROOT/calls"\nif [[ "$*" = "compose up"* && "$PWD" = "$FSP_DEPLOY_ROOT/next" && "$FSP_TEST_FAIL" = container ]]; then exit 1; fi\n',
   systemctl:'if [ "$FSP_TEST_FAIL" = timer ]; then exit 1; fi\n',
   readlink:'python3 -c \'import os,sys; print(os.path.realpath(sys.argv[-1]))\' "$@"\n'
  };
  for(const [name,body]of Object.entries(mocks))fs.writeFileSync(path.join(bin,name),'#!/bin/bash\n'+body,{mode:0o755});
  const run=spawnSync('bash',['release-test.sh','fspcareer.space','next','a'.repeat(40)],{cwd:release,env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,FSP_DEPLOY_ROOT:root,FSP_SYSTEMD_DIR:systemd,FSP_TEST_FAIL:failure},encoding:'utf8'});
  assert.equal(run.status,failure?1:0,run.stderr);
  assert.equal(fs.realpathSync(path.join(root,'current')),failure?previous:release);
  const after=fs.readFileSync(path.join(root,'.env'),'utf8');
  if(failure){assert.equal(after,initial);assert.match(fs.readFileSync(path.join(root,'calls'),'utf8'),/previous compose up/);}
  else{assert.ok(after.includes('POSTGRES_PASSWORD='+'1'.repeat(64)));assert.ok(after.includes('MAIL_TOKEN_KEY='+'2'.repeat(64)));assert.ok(after.includes('RESEND_API_KEY=re_test_not_real'));assert.ok(after.includes('RELEASE_SHA='+'a'.repeat(40)));assert.equal(fs.statSync(path.join(root,'.env')).mode&0o777,0o600);assert.equal(fs.readFileSync(path.join(root,'previous-release'),'utf8').trim(),previous);}
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
