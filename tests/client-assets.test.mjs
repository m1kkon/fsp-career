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
  for(const name of ['styles.css','enterprise.css','marketplace.css','mvp.css','resume-editor.css','product.css','resume-history.mjs','hiring-templates.mjs'])writeFileSync(join(root,'public',name),name+' original');
  writeFileSync(join(root,'public/assessments.js'),'function assessmentTestsPage() {}');
  writeFileSync(join(root,'public/api-access.js'),'function apiAccessPage() {}');
  writeFileSync(join(root,'public/city-autocomplete.js'),'function syncLocationPreference() {}');
  writeFileSync(join(root,'public/city-data.mjs'),'export const cityRows=[];');
  writeFileSync(join(root,'public/world-city-data.mjs'),'export const worldCityRows=[]; export const russianCityAliases=[];');
  writeFileSync(join(root,'public/cities.mjs'),"import {cityRows} from './city-data.mjs'; import {worldCityRows} from './world-city-data.mjs';");
  writeFileSync(join(root,'public/mvp.js'),"import {historyDefaults} from './resume-history.mjs'; import {citySuggestions} from './cities.mjs'; import {hiringTemplates} from './hiring-templates.mjs';");
  const first=versionClientAssets(root);assert.deepEqual(versionClientAssets(root),first);
  writeFileSync(join(root,'public/mvp.css'),'updated navigation styles');const css=versionClientAssets(root);assert.notEqual(css['mvp.css'],first['mvp.css']);assert.equal(css['mvp.js'],first['mvp.js']);assert.ok(!existsSync(join(root,'public',first['mvp.css'])));
  writeFileSync(join(root,'public/resume-history.mjs'),'new history module');const modules=versionClientAssets(root);assert.notEqual(modules['resume-history.mjs'],first['resume-history.mjs']);assert.notEqual(modules['mvp.js'],first['mvp.js']);assert.ok(readFileSync(join(root,'public',modules['mvp.js']),'utf8').includes(modules['resume-history.mjs']));
  writeFileSync(join(root,'public/assessments.js'),'function assessmentTestsPage() {return 1;}');const assessment=versionClientAssets(root);assert.notEqual(assessment['mvp.js'],modules['mvp.js']);assert.ok(readFileSync(join(root,'public',assessment['mvp.js']),'utf8').includes('assessmentTestsPage'));
  for(const url of Object.values(assessment))assert.ok(existsSync(join(root,'public',url)));
  writeFileSync(join(root,'public/api-access.js'),'function apiAccessPage() {return 1;}');const access=versionClientAssets(root);assert.notEqual(access['mvp.js'],assessment['mvp.js']);
  writeFileSync(join(root,'public/city-data.mjs'),'export const cityRows=[["Москва","Москва",1]];');const cities=versionClientAssets(root);assert.notEqual(cities['city-data.mjs'],access['city-data.mjs']);assert.notEqual(cities['cities.mjs'],access['cities.mjs']);assert.notEqual(cities['mvp.js'],access['mvp.js']);assert.ok(readFileSync(join(root,'public',cities['cities.mjs']),'utf8').includes(cities['city-data.mjs']));
  writeFileSync(join(root,'public/world-city-data.mjs'),'export const worldCityRows=[["Тбилиси","GE","Tbilisi",1,["Тбилиси","Tbilisi"]]];');const world=versionClientAssets(root);assert.notEqual(world['world-city-data.mjs'],cities['world-city-data.mjs']);assert.notEqual(world['cities.mjs'],cities['cities.mjs']);assert.notEqual(world['mvp.js'],cities['mvp.js']);assert.ok(readFileSync(join(root,'public',world['cities.mjs']),'utf8').includes(world['world-city-data.mjs']));
  writeFileSync(join(root,'public/hiring-templates.mjs'),'export const hiringTemplates=[];');const templates=versionClientAssets(root);assert.notEqual(templates['hiring-templates.mjs'],world['hiring-templates.mjs']);assert.notEqual(templates['mvp.js'],world['mvp.js']);assert.ok(readFileSync(join(root,'public',templates['mvp.js']),'utf8').includes(templates['hiring-templates.mjs']));
 }finally{rmSync(root,{recursive:true,force:true});}
});
