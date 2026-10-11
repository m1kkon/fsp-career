import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resumeEvidenceFit} from '../lib/resume-fit.mjs';
import {matching,rankCandidates} from '../lib/matching.mjs';

const need={spec:'Backend',grade:'Middle',stack:['Python','SQL'],requiredStack:['Python','SQL'],text:'Разработка API',team:'',adjacent:[],domains:[]};
const base={id:'candidate',spec:'Backend',grade:'Middle',verified:true,score:85,stack:['Python','SQL']};

test('technology evidence cannot compensate for missing requested tasks',()=>{
 const candidate={...base,work:'Разработал пакет на Python и SQL.'};
 const evidence=resumeEvidenceFit(candidate,need);
 assert.equal(evidence.skills.length,2);assert.equal(evidence.tasks.length,0);assert.equal(evidence.share,0);
});

test('task evidence cannot compensate for missing requested technologies',()=>{
 const candidate={...base,work:'Разработал API на Java.'};
 const evidence=resumeEvidenceFit(candidate,need);
 assert.equal(evidence.skills.length,0);assert.equal(evidence.tasks.length,1);assert.equal(evidence.share,0);
});

test('balanced partial evidence uses harmonic coverage without changing hard filters',()=>{
 const candidate={...base,work:'Разработал API на Python.'};
 const fit=matching(candidate,need);
 assert.equal(fit.resumeEvidence.share,2/3);
 assert.equal(fit.parts.find(p=>p.key==='resume').points,13);
 assert.equal(fit.eligibility.status,'pass');
 assert.equal(fit.score,fit.parts.reduce((sum,p)=>sum+p.points,0));
});

test('full relevant evidence earns the same maximum and outranks missing task evidence',()=>{
 const full={...base,id:'full',work:'Разработал API на Python и SQL.'};
 const missing={...base,id:'missing',work:'Разработал пакет на Python и SQL.'};
 const rows=[missing,full].map(c=>({...c,match:matching(c,need)}));
 assert.equal(rows[1].match.parts.find(p=>p.key==='resume').points,20);
 assert.deepEqual(rankCandidates(rows,need).map(c=>c.id),['full','missing']);
});

test('one evidence dimension remains unchanged when the other is not requested',()=>{
 assert.equal(resumeEvidenceFit({...base,work:'Разработал пакет на Python и SQL.'},{...need,text:''}).share,1);
 assert.equal(resumeEvidenceFit({...base,work:'Разработал API на Java.'},{...need,stack:[]}).share,1);
});
