export const STAGES = ['Saved','Preparing','Applied','Interview','Offer','Closed'];
export const CHECKS = {enrollment:'Degree and enrolment requirements',authorization:'Work authorization requirements',term:'Start date and term length',location:'Location and travel requirements'};
export const TASKS = {resume:'Tailored resume',evidence:'Relevant project or experience examples',review:'Application reviewed'};
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const string = (x, limit = 5000) => typeof x === 'string' ? x.slice(0, limit) : '';
export function normalizeState(value) {
  if (!object(value) || value.schema !== 2 || !object(value.saved) || !Array.isArray(value.skills) || !object(value.profile)) throw new Error('Not a valid ORE version 2 backup.');
  if (Object.keys(value.saved).length > 200) throw new Error('Maximum 200 saved applications per backup.');
  const saved = Object.create(null);
  for (const [id, entry] of Object.entries(value.saved)) {
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id) || ['__proto__','constructor','prototype'].includes(id) || !object(entry) || !object(entry.job)) throw new Error('Invalid application record.');
    const j = entry.job;
    if (j.id !== id || !string(j.title) || !string(j.company)) throw new Error('Application is missing its title or company.');
    let url; try {url = new URL(j.url);if (!['http:','https:'].includes(url.protocol)) throw Error();} catch {throw new Error('Invalid application URL.');}
    const job = {id, url:url.href};
    for (const key of ['title','company','location','country','discipline','source','fetchedAt','postedAt','salary','duration','deadline','start']) job[key] = string(j[key],500);
    job.description = string(j.description,18000);
    const eligibility = {}, tasks = {};
    for (const key of Object.keys(CHECKS)) eligibility[key] = ['yes','no','unknown'].includes(entry.eligibility?.[key]) ? entry.eligibility[key] : 'unknown';
    for (const key of Object.keys(TASKS)) tasks[key] = entry.tasks?.[key] === true;
    saved[id] = {job, status: STAGES.includes(entry.status) ? entry.status : 'Saved', notes:string(entry.notes), savedAt:string(entry.savedAt,40), followUp:/^\d{4}-\d{2}-\d{2}$/.test(entry.followUp || '') ? entry.followUp : '', eligibility,tasks};
  }
  return {schema:2,saved,skills:[...new Set(value.skills.filter(x=>typeof x==='string').map(x=>x.trim().slice(0,80)).filter(Boolean))].slice(0,40),profile:{program:string(value.profile.program,150),term:string(value.profile.term,100)}};
}
export function emptyState(){return {schema:2,saved:{},skills:[],profile:{program:'',term:''}};}
const SKILLS = {
  Excel:['excel'], Python:['python'], SQL:['sql','t-sql'], AutoCAD:['autocad'], GIS:['gis','arcgis','qgis'],
  MATLAB:['matlab'], R:['r programming','r scripting','r'], Surveying:['surveying','survey'],
  'Mine planning':['mine planning','mine plans'], 'Rock mechanics':['rock mechanics'],
  'Geological mapping':['geological mapping','geologic mapping'], 'Core logging':['core logging','core-logging','drill-core logging'],
  'Data analysis':['data analysis','data analytics'], 'Data management':['data management','database management'],
  'Technical writing':['technical writing','report writing'], 'Communication':['communication','interpersonal'],
  'Driver’s licence':["driver’s license","driver's license","driver’s licence","driver's licence"],
  Leapfrog:['leapfrog'], Vulcan:['vulcan'], Deswik:['deswik'], Surpac:['surpac'], 'Safety':['safety'],
  'Geochemistry':['geochemistry','geochemical'], 'Geotechnical':['geotechnical'], 'Metallurgy':['metallurgy','metallurgical']
};
function contains(text, word) {const escaped=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(^|[^a-z0-9])'+escaped+'(?=$|[^a-z0-9])','i').test(text);}
export function assess(job, skills, entry) {
  const text = `${job.title || ''} ${job.description || ''}`;
  const mentioned = Object.entries(SKILLS).filter(([,aliases])=>aliases.some(a=>contains(text,a))).map(([name])=>name);
  const matched = mentioned.filter(name=>skills.some(s=>[name,...SKILLS[name]].some(a=>a.toLowerCase()===s.toLowerCase())));
  const missing = mentioned.filter(s=>!matched.includes(s));
  const score = mentioned.length && skills.length ? Math.round(matched.length/mentioned.length*100) : null;
  const checks = Object.keys(CHECKS).map(k=>entry?.eligibility?.[k] || 'unknown');
  const blocked = checks.includes('no'), verified = checks.filter(v=>v==='yes').length;
  const label = blocked ? 'Eligibility issue to resolve' : !skills.length ? 'Add your skills' : !mentioned.length ? 'Manual review needed' : score >= 75 ? 'Strong keyword overlap' : score >= 40 ? 'Partial keyword overlap' : 'Limited keyword overlap';
  return {score,mentioned,matched,missing,label,blocked,verified,ready:Object.keys(TASKS).filter(k=>entry?.tasks?.[k]).length};
}
export function mergeBackup(current, incoming) {
  const a=normalizeState(current),b=normalizeState(incoming);
  return normalizeState({schema:2,saved:{...b.saved,...a.saved},skills:[...a.skills,...b.skills],profile:{program:a.profile.program||b.profile.program,term:a.profile.term||b.profile.term}});
}
