import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicApiSchema} from '../scripts/generate-public-api.mjs';
import {API_ACTIONS} from '../lib/public-api.mjs';
import {SPECS} from '../lib/taxonomy.mjs';
test('published OpenAPI matches the implementation and every local reference resolves',()=>{
 const schema=JSON.parse(readFileSync(new URL('../public/api-v1.openapi.json',import.meta.url),'utf8'));assert.deepEqual(schema,publicApiSchema());
 assert.equal(readFileSync(new URL('../public/api-guide.md',import.meta.url),'utf8'),readFileSync(new URL('../docs/api.md',import.meta.url),'utf8'));
 const ids=new Set();for(const path of Object.values(schema.paths))for(const operation of Object.values(path)){assert.ok(!ids.has(operation.operationId));ids.add(operation.operationId);}
 const refs=[];function visit(node){if(!node||typeof node!=='object')return;if(node.$ref)refs.push(node.$ref);for(const item of Object.values(node))visit(item);}visit(schema);
 for(const ref of refs){assert.ok(ref.startsWith('#/'));let target=schema;for(const key of ref.slice(2).split('/'))target=target?.[key.replaceAll('~1','/').replaceAll('~0','~')];assert.ok(target,ref);}
 assert.deepEqual(schema.components.schemas.Candidate.properties.spec.enum,SPECS);
 assert.deepEqual(schema.paths['/actions'].post.requestBody.content['application/json'].schema.oneOf.map(r=>r.$ref.split('/').at(-1)),API_ACTIONS);
 assert.ok(!API_ACTIONS.some(a=>a.startsWith('maintainer-')||a.startsWith('assessment-')));
});
