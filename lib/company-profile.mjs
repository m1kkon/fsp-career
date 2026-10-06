import {requireValue,text} from './domain.mjs';

const sizes=['1–50','51–200','201–1000','1000+'];
const formats=['Удалённо','Гибрид','Офис'];
const limits={name:100,tagline:160,description:4000,product:2400,industry:100,city:80,teamDescription:2400,officeAddress:300,workingHours:300,hiringProcess:1800,contact:120,contactName:100,contactRole:100};
const link=value=>{
 const raw=text(value,300);if(!raw)return '';
 let url;try{url=new URL(raw);}catch{}
 requireValue(url&&['http:','https:'].includes(url.protocol)&&!url.username&&!url.password,'Ссылки компании должны начинаться с https:// или http:// и не содержать логин или пароль.');
 return url.href;
};
export function companyInput(body,previous={}){
 const next={...previous};
 for(const [key,max] of Object.entries(limits))if(key in body)next[key]=text(body[key],max);
 requireValue(next.name,'Укажите название компании.');
 if('size' in body){requireValue(!body.size||sizes.includes(body.size),'Выберите размер компании.');next.size=body.size||'';}
 for(const key of ['website','careersUrl'])if(key in body)next[key]=link(body[key]);
 if('foundedYear' in body){const year=text(body.foundedYear,10);requireValue(!year||/^\d{4}$/.test(year)&&Number(year)>=1800&&Number(year)<=new Date().getFullYear(),'Укажите корректный год основания.');next.foundedYear=year;}
 if('teamSize' in body){const size=text(body.teamSize,10);requireValue(!size||/^\d+$/.test(size)&&Number(size)>0&&Number(size)<=1000000,'Укажите размер IT-команды от 1 до 1 000 000.');next.teamSize=size;}
 for(const [key,max,length] of [['techStack',20,40],['benefits',12,160]])if(key in body){
  const values=Array.isArray(body[key])?body[key]:String(body[key]??'').split(key==='benefits'?/\n/:/,/);
  requireValue(values.length<=max,`Можно добавить до ${max} ${key==='benefits'?'условий':'технологий'}.`);
  next[key]=[...new Set(values.map(value=>text(value,length)).filter(Boolean))];
 }
 if('workFormats' in body){requireValue(Array.isArray(body.workFormats)&&body.workFormats.every(value=>formats.includes(value)),'Выберите доступные форматы работы.');next.workFormats=[...new Set(body.workFormats)];}
 return {...next,updated:Date.now()};
}

// Only information intended for candidates. Account and recruiting contacts
// remain outside the public vacancy/company projection.
export function publicCompany(company){
 if(!company?.name)return null;
 return Object.fromEntries(['name','tagline','description','product','industry','size','city','website','careersUrl','foundedYear','teamSize','teamDescription','techStack','workFormats','officeAddress','workingHours','benefits','hiringProcess'].map(key=>[key,company[key]??(['techStack','workFormats','benefits'].includes(key)?[]:'')]));
}
export function jobCompany(job,company){
 const profile=publicCompany(company);if(!profile)return job;
 return {...job,company:profile.name,companyAbout:profile.description,companyWebsite:profile.website,companyProfile:profile};
}
