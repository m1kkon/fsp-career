import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {versionClientAssets} from '../scripts/version-client-assets.mjs';
test('published asset URLs change with content and the client imports the matching history module',()=>{
 const root=mkdtempSync(join(tmpdir(),'fsp-assets-'));
 try{
  mkdirSync(join(root,'public'));mkdirSync(join(root,'app'));
  for(const name of ['styles.css','enterprise.css','marketplace.css','mvp.css','resume-editor.css','product.css','resume-history.mjs'])writeFileSync(join(root,'public',name),name+' original');
  writeFileSync(join(root,'public/assessments.js'),'function assessmentTestsPage() {}');
  writeFileSync(join(root,'public/api-access.js'),'function apiAccessPage() {}');
  writeFileSync(join(root,'public/mvp.js'),"import {historyDefaults} from './resume-history.mjs';");
  const first=versionClientAssets(root);assert.deepEqual(versionClientAssets(root),first);
  writeFileSync(join(root,'public/mvp.css'),'updated navigation styles');const css=versionClientAssets(root);assert.notEqual(css['mvp.css'],first['mvp.css']);assert.equal(css['mvp.js'],first['mvp.js']);assert.ok(!existsSync(join(root,'public',first['mvp.css'])));
  writeFileSync(join(root,'public/resume-history.mjs'),'new history module');const modules=versionClientAssets(root);assert.notEqual(modules['resume-history.mjs'],first['resume-history.mjs']);assert.notEqual(modules['mvp.js'],first['mvp.js']);assert.ok(readFileSync(join(root,'public',modules['mvp.js']),'utf8').includes(modules['resume-history.mjs']));
  writeFileSync(join(root,'public/assessments.js'),'function assessmentTestsPage() {return 1;}');const assessment=versionClientAssets(root);assert.notEqual(assessment['mvp.js'],modules['mvp.js']);assert.ok(readFileSync(join(root,'public',assessment['mvp.js']),'utf8').includes('assessmentTestsPage'));
  for(const url of Object.values(assessment))assert.ok(existsSync(join(root,'public',url)));
  writeFileSync(join(root,'public/api-access.js'),'function apiAccessPage() {return 1;}');const access=versionClientAssets(root);assert.notEqual(access['mvp.js'],assessment['mvp.js']);
 }finally{rmSync(root,{recursive:true,force:true});}
});
