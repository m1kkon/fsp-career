import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resumeEvidenceFit,affirmativeResumeTaskText,candidateResumeSkills,candidateSkillDeclaration} from '../lib/resume-fit.mjs';
import {tfidfSimilarity} from '../lib/ats.mjs';

test('only completed affirmative work/project statements reach lexical evidence',()=>{
 for(const work of ['API, payments, Python','Буду разрабатывать API на Python.',"I have not yet measured API latency.",'За платежи не отвечал.'])assert.equal(affirmativeResumeTaskText({work}),'');
 assert.equal(affirmativeResumeTaskText({about:'Developed payment APIs.'}),'');
 assert.ok(affirmativeResumeTaskText({work:'Сопоставлял записи и сохранял ключ операции.'}));
 assert.ok(affirmativeResumeTaskText({resume:{projects:[{name:'Service',description:'Measured latency and restored a previous release.'}]}}));
});

test('technology names and repeated clauses do not inflate task-language similarity',()=>{
 const work='Measured latency of Python APIs.';
 assert.doesNotMatch(affirmativeResumeTaskText({work}),/python/i);
 assert.equal(affirmativeResumeTaskText({work:(work+' ').repeat(20)}),affirmativeResumeTaskText({work}));
});

test('lexical backfill is bounded within existing evidence credit and canonical full evidence stays full',()=>{
 const need={text:'',team:'Measured latency',stack:['Python']};
 const partial=resumeEvidenceFit({work:'Measured latency.'},need,{similarity:()=>({score:1,terms:['latency']})});
 assert.equal(partial.canonicalShare,0);assert.equal(partial.share,.5);
 const full=resumeEvidenceFit({work:'Measured latency in Python.'},need,{similarity:tfidfSimilarity});
 assert.equal(full.canonicalShare,1);assert.equal(full.share,1);
});

test('denied/planned new action verbs cannot satisfy professional skill evidence',()=>{
 for(const work of ['Не тестировал Python API.',"I didn't deploy a Python API.",'Планирую автоматизировать Python API.'])assert.deepEqual(candidateResumeSkills({work}),[]);
});

test('required-skill declarations distinguish absence, denial, plans and contradictions',()=>{
 assert.equal(candidateSkillDeclaration({},'Python'),'unknown');
 assert.equal(candidateSkillDeclaration({work:'Планирую разработать сервис на Python.'},'Python'),'unknown');
 assert.equal(candidateSkillDeclaration({work:'Изучаю Python.'},'Python'),'unknown');
 assert.equal(candidateSkillDeclaration({work:'Не знаю Python.'},'Python'),'denied');
 assert.equal(candidateSkillDeclaration({work:"I have not used Python."},'Python'),'denied');
 assert.equal(candidateSkillDeclaration({stack:['Python'],work:'Не знаю Python.'},'Python'),'unknown');
 assert.equal(candidateSkillDeclaration({work:'Used Python for a service. But I have no experience with Python.'},'Python'),'unknown');
 assert.equal(candidateSkillDeclaration({work:'Developed services in Python.'},'Python'),'confirmed');
 assert.equal(candidateSkillDeclaration({stack:['питон']},'Python'),'confirmed');
});
