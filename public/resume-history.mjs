// Shared by the editor, API and PDF export. Text mirrors keep older clients compatible.
export const historyDefaults={
 workEntries:{company:'',position:'',start:'',end:'',current:false,description:''},
 educationEntries:{institution:'',program:'',level:'',start:'',end:'',description:''}
};
const clean=v=>String(v??'').trim();
export function meaningfulHistory(row){return Object.entries(row).some(([key,value])=>key!=='current'&&clean(value));}
export function historyPeriod(row){return [row.start,row.current?'настоящее время':row.end].map(clean).filter(Boolean).join(' - ');}
export function historyHeading(row,kind){return (kind==='workEntries'?[row.company,row.position]:[row.institution,row.program]).map(clean).filter(Boolean).join(' | ');}
export function historyText(rows,kind){return rows.filter(meaningfulHistory).map(row=>[historyHeading(row,kind),[row.level,historyPeriod(row)].map(clean).filter(Boolean).join(' · '),row.description].map(clean).filter(Boolean).join('\n')).join('\n\n');}
export function resumeHistory(profile,kind){
 const saved=profile.resume?.[kind];if(Array.isArray(saved))return structuredClone(saved);
 const raw=clean(profile[kind==='workEntries'?'work':'education']);if(!raw)return [];
 const paragraphs=raw.split(/\n\s*\n/);if(paragraphs.length>10)paragraphs.splice(9,paragraphs.length-9,paragraphs.slice(9).join('\n\n'));
 return paragraphs.map(paragraph=>{
  const row={...historyDefaults[kind]},lines=paragraph.split('\n'),parts=lines[0].split(/\s+[|·]\s+/);
  if(parts.length<2){row.description=paragraph;return row;}
  const isDate=value=>/\d{4}/.test(value);
  if(kind==='workEntries'){row.company=parts.shift();row.position=parts.shift()||'';}
  else{row.institution=parts.shift();if(parts[0]&&!isDate(parts[0]))row.program=parts.shift();}
  const period=parts.join(' | ');
  if(period){const dates=period.split(/\s+[–—-]\s+/);row.start=dates[0];row.current=/настоящее|сейчас/i.test(dates.slice(1).join(' '));row.end=row.current?'':dates.slice(1).join(' - ');}
  row.description=lines.slice(1).join('\n');if(Object.entries(row).some(([key,value])=>key!=='description'&&key!=='current'&&String(value).length>(key==='start'||key==='end'?40:160)))return {...historyDefaults[kind],description:paragraph};return row;
 });
}
