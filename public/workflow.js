export const DISCIPLINES=['Mining','Geology','Geotechnical','Processing','Environment','Petroleum'];
export function canonicalURL(raw){try{const u=new URL(raw);if(!['http:','https:'].includes(u.protocol))return '';u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_|trk|tracking|ref$)/i.test(key))u.searchParams.delete(key);u.hostname=u.hostname.toLowerCase();return u.href.replace(/\/$/,'');}catch{return '';}}
export function contentSignature(text){let h=2166136261;for(const c of String(text||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
export function letterSignature(resume,job){return contentSignature([resume?.text||'',job.title,job.company,job.description].join('\n'));}
export function draftIsCurrent(entry,resume){return !!entry?.letter?.text&&entry.letter.signature===letterSignature(resume,entry.job);}
export function selectQueue(jobs,saved,settings){
  if(!DISCIPLINES.includes(settings.discipline))throw new Error('Select a discipline first.');
  const seen=new Set(Object.values(saved).map(e=>canonicalURL(e.job.url)));let duplicates=0,excluded=0;
  const selected=[];
  for(const job of jobs){
    if(job.discipline!==settings.discipline|| (settings.country!=='all'&&job.country!==settings.country) ||(settings.location&&!job.location.toLowerCase().includes(settings.location.toLowerCase())) || !/\b(intern(?:ship)?|co[ -]?op|student)\b/i.test(job.title) ||/\b(senior|principal|manager|director)\b/i.test(job.title)){excluded++;continue;}
    const url=canonicalURL(job.url);if(!url){excluded++;continue;}
    if(saved[job.id]||seen.has(url)){duplicates++;continue;}
    if(selected.length+Object.keys(saved).length>=200)break;
    seen.add(url);selected.push(job);
  }
  return {jobs:selected,duplicates,excluded};
}
export function applicationReadiness(entry,resume){
  const reasons=[];
  if(!resume?.text?.trim())reasons.push('Upload a resume');
  if(!draftIsCurrent(entry,resume))reasons.push('Generate a current cover letter');
  if(!entry?.letter?.reviewed)reasons.push('Review the cover letter');
  if(Object.values(entry?.eligibility||{}).includes('no'))reasons.push('Resolve eligibility mismatch');
  if(['enrollment','authorization','term','location'].some(k=>entry?.eligibility?.[k]!=='yes'))reasons.push('Confirm all eligibility checks');
  if(['Applied','Interview','Offer','Closed'].includes(entry?.status))reasons.push('Already applied or closed');
  return {ready:reasons.length===0,reasons};
}
export function parseAlertLinks(text){
  const found=[];const seen=new Set();
  for(const m of String(text||'').matchAll(/https?:\/\/[^\s<>"']+/g)){
    const clean=m[0].replace(/[),.;]+$/,'');const url=canonicalURL(clean);if(!url||seen.has(url))continue;
    const u=new URL(url);if(!['linkedin.com','www.linkedin.com'].includes(u.hostname)||!/^\/jobs\/view\//.test(u.pathname))continue;
    seen.add(url);found.push(url);
  }
  return found.slice(0,50);
}
