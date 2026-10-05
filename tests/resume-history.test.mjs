import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resumeHistory,historyText} from '../public/resume-history.mjs';
test('legacy text migrates without dropping ambiguous prose or multiple jobs',()=>{
 const raw='Vector | ML Engineer | 2023 - настоящее время\n• Built search\n\nEarlier job without delimiters\nDetails remain';
 const rows=resumeHistory({work:raw},'workEntries');assert.equal(rows.length,2);assert.equal(rows[0].company,'Vector');assert.equal(rows[0].current,true);assert.equal(rows[1].description,'Earlier job without delimiters\nDetails remain');
 const text=historyText(rows,'workEntries');assert.match(text,/Built search/);assert.match(text,/Earlier job without delimiters/);
 const school=resumeHistory({education:'University | 2018 - 2022\nMathematics'},'educationEntries')[0];assert.equal(school.start,'2018');assert.equal(school.end,'2022');assert.equal(school.description,'Mathematics');
});
test('explicitly deleted cards stay deleted and free-form legacy text remains recoverable',()=>{
 assert.deepEqual(resumeHistory({work:'Old work',resume:{workEntries:[]}},'workEntries'),[]);
 const raw=Array.from({length:13},(_,i)=>'Paragraph '+i).join('\n\n');const rows=resumeHistory({work:raw},'workEntries');assert.equal(rows.length,10);assert.equal(historyText(rows,'workEntries'),raw);
});
