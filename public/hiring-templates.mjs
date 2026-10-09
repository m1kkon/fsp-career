// Role suggestions are editable preferences, never verified facts or hard filters.
export const hiringTemplates = [
  {id:'python-backend',label:'Python · Backend',spec:'Backend',anchors:['Python','FastAPI','Django'],core:['Python','SQL'],middle:['PostgreSQL','Docker','Pytest'],senior:['Redis','Kafka','CI/CD']},
  {id:'go-backend',label:'Go · Backend',spec:'Backend',anchors:['Go'],core:['Go','SQL'],middle:['PostgreSQL','Docker'],senior:['Redis','Kafka','Kubernetes']},
  {id:'java-backend',label:'Java · Backend',spec:'Backend',anchors:['Java','Kotlin'],core:['Java','SQL'],middle:['PostgreSQL','Docker'],senior:['Kafka','Redis','Kubernetes']},
  {id:'node-backend',label:'Node.js · Backend',spec:'Backend',anchors:['Node.js'],core:['Node.js','JavaScript'],middle:['TypeScript','PostgreSQL','Docker'],senior:['Redis','Kafka','CI/CD']},
  {id:'general-backend',label:'Backend · базовый стек',spec:'Backend',anchors:[],core:['SQL','Postman'],middle:['PostgreSQL','Docker'],senior:['Redis','CI/CD']},
  {id:'react-frontend',label:'React · Frontend',spec:'Frontend',anchors:['React','Next.js'],core:['React','JavaScript','HTML','CSS'],middle:['TypeScript','Playwright'],senior:['Next.js','CI/CD']},
  {id:'vue-frontend',label:'Vue · Frontend',spec:'Frontend',anchors:['Vue'],core:['Vue','JavaScript','HTML','CSS'],middle:['TypeScript','Playwright'],senior:['CI/CD']},
  {id:'web-frontend',label:'Frontend · базовый стек',spec:'Frontend',anchors:[],core:['JavaScript','HTML','CSS'],middle:['TypeScript','Playwright'],senior:['CI/CD']},
  {id:'data-science',label:'Data Science',spec:'Data Science',anchors:[],core:['Python','SQL','Pandas'],middle:['scikit-learn'],senior:['Spark','Airflow','Docker']},
  {id:'ml-engineering',label:'ML Engineering',spec:'ML Engineering',anchors:[],core:['Python','Pandas','scikit-learn'],middle:['PyTorch','Docker','SQL'],senior:['Kubernetes','Airflow']},
  {id:'devops',label:'DevOps',spec:'DevOps',anchors:[],core:['Linux','Docker','CI/CD'],middle:['Kubernetes','Terraform','Prometheus','Grafana'],senior:['Ansible']},
  {id:'qa',label:'QA · тестирование',spec:'QA',anchors:[],core:['Postman','SQL'],middle:['Playwright'],senior:['CI/CD','Docker']},
];

export function templateSkills(template,grade){
  if(!template)return [];
  return [...new Set([...template.core,...(['Middle','Senior'].includes(grade)?template.middle:[]),...(grade==='Senior'?template.senior:[])])];
}

export function skillDisplayOrder(available,required,preferred,template){
  const allowed=new Set(available),templateOrder=templateSkills(template,'Senior'),selected=new Set(preferred);
  return [...new Set([...required,...[...preferred].filter(name=>!templateOrder.includes(name)),...templateOrder.filter(name=>selected.has(name)),...templateOrder,...available])].filter(name=>allowed.has(name));
}

export function suggestedTemplate(need){
  if(!need.spec||need.ambiguous?.spec)return null;
  const eligible=hiringTemplates.filter(item=>item.spec===need.spec);
  const specific=eligible.filter(item=>item.anchors.some(skill=>need.stack?.includes(skill)));
  // Multiple language/framework families need an employer decision.
  if(specific.length>1)return null;
  return specific[0]||eligible.find(item=>!item.anchors.length)||null;
}

export function initialSkillSelection(need,rules,hasOverrides=false){
  const names=value=>Array.isArray(value)?value:String(value||'').split(',').map(item=>item.trim()).filter(Boolean);
  const required=new Set(names(rules.requiredStack)),preferred=new Set(names(rules.preferredStack));
  for(const name of required)preferred.delete(name);
  if(!hasOverrides&&!required.size&&!preferred.size)for(const name of need.stack||[])preferred.add(name);
  const template=hasOverrides?null:suggestedTemplate(need),suggested=new Set();
  for(const name of templateSkills(template,need.grade))if(!required.has(name)&&!preferred.has(name)){preferred.add(name);suggested.add(name);}
  return {required,preferred,template,suggested};
}
