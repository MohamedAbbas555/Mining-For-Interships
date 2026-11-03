import {assess, normalizeState, emptyState, mergeBackup, STAGES, CHECKS, TASKS} from './progress.js';
'use strict';
const $ = s => document.querySelector(s);
let jobs = [], sourceState = [], selectedDiscipline = '', view = 'find', loading = false;
function read(key, fallback) {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}}
let saved = {}, skills = [], profile = {program:'',term:''}, revision = 0, ready = false, dirty = false, saving = false, conflict = false, generation = 0, timer;
function state(){return {schema:2,saved,skills,profile};}
function adopt(value){const clean=normalizeState(value);saved=clean.saved;skills=clean.skills;profile=clean.profile;$('#skills').value=skills.join(', ');$('#program').value=profile.program;$('#term').value=profile.term;}
function toast(s) {$('#toast').textContent = s; $('#toast').style.display = 'block'; setTimeout(() => $('#toast').style.display = 'none', 3500);}
function saveLabel(text,error=false){$('#save-state').textContent=text;$('#save-state').classList.toggle('error',error);}
function cache(){try{localStorage.setItem('ore-progress-v2',JSON.stringify({revision,dirty,state:state()}));return true;}catch{return false;}}
function persist(){dirty=true;generation++;const cached=cache();saveLabel(cached?'Saving progress…':'Saving… browser backup unavailable');clearTimeout(timer);timer=setTimeout(flush,350);}
async function flush(){
  if(!ready||saving||!dirty||conflict)return;
  saving=true;const sent=generation;
  try{const r=await fetch('/api/progress',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,state:state()}),signal:AbortSignal.timeout(15000)});const data=await r.json();
    if(!r.ok){if(r.status===409)conflict=true;throw Error(data.error||'Save failed');}
    revision=data.revision;if(generation===sent)dirty=false;cache();saveLabel('✓ Saved to this computer · '+new Date(data.savedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
  }catch(e){saveLabel('Not saved to disk — '+e.message,true);toast('Keep this tab open or download a backup.');}
  finally{saving=false;if(dirty&&!conflict&&generation!==sent)flush();}
}
function downloadJSON(value,name='ore-progress-backup.json'){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function showRecovery(value,message){const box=$('#recovery');box.hidden=false;box.replaceChildren(el('p',message),button('Download recovered backup',()=>downloadJSON(value,'ore-recovered-progress.json')));}
async function bootstrap(){
  const local=read('ore-progress-v2',null);
  try{
    const r=await fetch('/api/progress',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const data=await r.json();revision=data.revision;
    let candidate=data.state,migrate=false;
    if(local?.dirty && local.revision===revision){candidate=local.state;migrate=true;}
    else if(local?.dirty){showRecovery(local.state,'Unsaved changes from this browser differ from the disk version. Download them before reloading. Restore merges missing applications; existing records are kept.');}
    if(!revision && !migrate){try{candidate=local?.state || normalizeState({schema:2,saved:read('ore-applications-v1',{}),skills:read('ore-skills-v1',[]),profile:{}});migrate=Object.keys(candidate.saved).length>0||candidate.skills.length>0;}catch{candidate=emptyState();}}
    adopt(candidate);ready=true;conflict=false;saveLabel(data.savedAt?'✓ Progress restored from this computer':'Ready · progress saves automatically');if(migrate)persist();
  }catch{try{adopt(local?.state || emptyState());}catch{adopt(emptyState());}ready=false;saveLabel('Disk unavailable — browser-only until reconnected',true);}
  $('main').inert=false;render();
}
function el(tag, text, className) {const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e;}
function link(text, url) {const e = el('a',text); try {const u = new URL(url); if (!['https:','http:'].includes(u.protocol)) throw Error(); e.href=u.href; e.target='_blank'; e.rel='noopener noreferrer';} catch {e.removeAttribute('href');} return e;}
function button(text, fn) {const b = el('button',text); b.type='button'; b.addEventListener('click',fn); return b;}
function matches(j) {return assess(j,skills,saved[j.id]).matched;}
function updateCount() {$('#saved-count').textContent=Object.keys(saved).length;}
function saveJob(j) {if(!saved[j.id]&&Object.keys(saved).length>=200){toast('Your tracker is full. Export a backup before removing old roles.');return;}if (saved[j.id]) {delete saved[j.id]; toast('Removed from your tracker.');} else {saved[j.id]={job:j,status:'Saved',notes:'',savedAt:new Date().toISOString(),followUp:'',eligibility:{},tasks:{}};toast('Saved to My applications.');} persist();render();}
function showDetails(j) {
  const box=$('#detail-content');box.replaceChildren(el('p',j.company,'eyebrow'),el('h2',j.title),el('p',`${j.location} · ${j.duration}`),el('p',`${j.salary} · ${j.deadline}`));
  if(j.start) box.append(el('p','Start date: '+j.start));
  const full=el('details');full.append(el('summary','Read posting text'),el('p',j.description,'detail-text'));
  box.append(full,el('p','Source: '+j.source+' · retrieved '+new Date(j.fetchedAt).toLocaleString(),'small'),link('Check full posting & apply ↗',j.url));
  box.prepend(fitBox(j));
  if(saved[j.id])box.append(assessmentEditor(j));else box.append(button('Save role to track eligibility & preparation',()=>{saveJob(j);showDetails(j);}));
  if(!$('#details').open)$('#details').showModal();
}
function card(j, tracked=false) {
  const c=el('article',undefined,'card'),head=el('div',undefined,'card-head'),titles=el('div');
  titles.append(el('p',j.company,'company'),el('h3',j.title));head.append(el('div',j.company[0],'logo'),titles,el('span',j.discipline,'badge'));
  const meta=el('div',undefined,'meta');meta.append(el('span','↗ '+j.location),el('span','◷ '+j.duration),el('span',j.postedAt?'Posted '+j.postedAt:'Posting date unavailable'));
  const matched=matches(j);const foot=el('div',undefined,'card-foot');foot.append(button(saved[j.id]?'✓ Saved · remove':'+ Save',()=>saveJob(j)),button('Details',()=>showDetails(j)),link('View & apply ↗',j.url));
  c.append(head,meta,el('p',j.salary,'summary'),el('p',matched.length?'Skill keywords: '+matched.join(', '):'Review eligibility and term dates on the employer posting.','small'),el('span',j.source+' · '+j.deadline,'source-label'),fitBox(j),foot);
  if(tracked){const entry=saved[j.id],row=el('div',undefined,'tracker'),label=el('label','Application status'),select=el('select');
    for(const s of ['Saved','Preparing','Applied','Interview','Offer','Closed']){const o=el('option',s);o.value=s;select.append(o);}select.value=entry.status;select.addEventListener('change',()=>{entry.status=select.value;persist();render();});label.append(select);
    const noteLabel=el('label','Notes'),notes=el('textarea');notes.value=entry.notes;notes.placeholder='Deadline, contact, next step…';notes.rows=2;notes.maxLength=5000;notes.addEventListener('input',()=>{entry.notes=notes.value;persist();});noteLabel.append(notes);const dateLabel=el('label','Follow-up date'),date=el('input');date.type='date';date.value=entry.followUp||'';date.addEventListener('change',()=>{entry.followUp=date.value;persist();renderDashboard();});dateLabel.append(date);row.append(label,noteLabel,dateLabel);c.append(row);}
  return c;
}
function render() {
  updateCount();renderDashboard();
  const q=$('#query').value.trim().toLowerCase().split(/\s+/).filter(Boolean),where=$('#location').value.toLowerCase().trim(),country=$('#country').value;
  const filtered=jobs.filter(j=>(country==='all'||j.country===country)&&(!selectedDiscipline||j.discipline===selectedDiscipline)&&j.location.toLowerCase().includes(where)&&q.every(w=>`${j.title} ${j.company} ${j.description}`.toLowerCase().includes(w)));
  filtered.sort((a,b)=>$('#sort').value==='match'?(assess(b,skills,saved[b.id]).score??-1)-(assess(a,skills,saved[a.id]).score??-1):(b.postedAt||'').localeCompare(a.postedAt||''));
  $('#result-count').textContent=filtered.length;$('#results').replaceChildren(...filtered.map(j=>card(j)));
  if(!filtered.length) $('#results').append(el('div',loading?'Reading employer postings. The first scan can take a minute or two.':'No matching listings. Try fewer keywords, another region, or check Sources & setup for feed status and employer links.','empty'));
  $('#saved-results').replaceChildren(...Object.values(saved).filter(v=>v?.job?.id&&(!$('#stage-filter').value||v.status===$('#stage-filter').value)).map(v=>card(v.job,true)));
  if(!$('#saved-results').children.length) $('#saved-results').append(el('div','Your next opportunity starts with a shortlist. Save a role from Find internships to track it here.','empty'));
  $('#feed-health').replaceChildren(...sourceState.map(s=>el('p',`${s.name}: ${s.status} · ${s.count} listings${s.message?' · '+s.message:''}${s.limited?' · Coverage limit applies':''}`)));
}
async function load() {
  if(loading)return;loading=true;$('#refresh').disabled=true;$('#status').textContent='Searching employer postings… First scan may take a minute or two.';render();
  try {const r=await fetch('/api/jobs?country=all',{signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error();const data=await r.json();jobs=data.jobs;sourceState=data.sources;
    const errors=data.sources.filter(s=>s.status==='error');
    $('#status').textContent=(data.stale?'Feed unavailable. '+(data.updatedAt?'Showing an older cached result. ':'No live results available. '):'')+(data.updatedAt?'Last scan: '+new Date(data.updatedAt).toLocaleString()+'. ':'')+'Teck feed cached for 15 minutes. '+(errors.length?'Some feeds failed; see Sources & setup. ':'')+(data.sources.some(s=>s.status==='not configured')?'Optional Adzuna search is not configured.':'');
  }catch{$('#status').textContent='Could not reach the finder. Make sure the program is running, then refresh. Previous results are kept.';}
  finally{loading=false;$('#refresh').disabled=false;render();}
}
function navigate(name){view=name;for(const v of ['dashboard','find','saved','sources'])$('#'+v+'-view').hidden=v!==name;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===name));render();}
function fitBox(j){
  const a=assess(j,skills,saved[j.id]),box=el('div',undefined,'fit-box'+(a.blocked?' blocked':'')),title=el('div',undefined,'fit-title');
  title.append(el('b',a.label),el('span',a.score===null?'Unscored':a.score+'% keyword coverage'));box.append(title);
  if(a.score!==null){const meter=el('progress');meter.max=100;meter.value=a.score;meter.setAttribute('aria-label','Recognized skill keyword coverage');box.append(meter);}
  box.append(el('p',`${a.matched.length} of ${a.mentioned.length} recognized skill mentions matched · ${a.verified}/4 eligibility checks confirmed`,'small'),el('p','Hiring probability: unknown. This is not your chance of an offer.','small'));return box;
}
function assessmentEditor(j){
  const entry=saved[j.id],a=assess(j,skills,entry),section=el('section');entry.eligibility ||= {};entry.tasks ||= {};
  section.append(el('h3','Your fit & next steps'),el('p','Skills are detected with a fixed keyword dictionary. A missing keyword may be optional, and a match does not prove proficiency.','small'));
  const tags=el('div',undefined,'pill-row');a.matched.forEach(x=>tags.append(el('span','✓ '+x,'pill')));a.missing.forEach(x=>tags.append(el('span','Not in profile: '+x,'pill missing')));section.append(tags);
  if(a.missing.length)section.append(el('p','Next step: check whether '+a.missing.slice(0,3).join(', ')+' are required or optional. Add skills you already have, or identify relevant coursework and projects.','small'));
  const grid=el('div',undefined,'check-grid');for(const [key,name] of Object.entries(CHECKS)){const label=el('label',name),select=el('select');for(const [v,t] of [['unknown','Not checked'],['yes','I meet this requirement'],['no','I do not meet this requirement']]){const o=el('option',t);o.value=v;select.append(o);}select.value=entry.eligibility[key]||'unknown';select.addEventListener('change',()=>{entry.eligibility[key]=select.value;persist();render();showDetails(j);});label.append(select);grid.append(label);}section.append(el('h3','Check against the full employer posting'),grid);
  section.append(el('h3','Application preparation — '+a.ready+'/3 complete'));
  for(const [key,name] of Object.entries(TASKS)){const label=el('label',undefined,'task-label'),input=el('input');input.type='checkbox';input.checked=!!entry.tasks[key];input.addEventListener('change',()=>{entry.tasks[key]=input.checked;persist();render();showDetails(j);});label.append(input,document.createTextNode(name));section.append(label);}return section;
}
function renderDashboard(){
  const entries=Object.values(saved),counts=Object.fromEntries(STAGES.map(s=>[s,entries.filter(x=>x.status===s).length]));
  $('#metrics').replaceChildren(...[['Saved roles',entries.length],['Applications active',counts.Applied],['Interviews',counts.Interview],['Offers',counts.Offer]].map(([name,n])=>{const c=el('div',undefined,'metric');c.append(el('span',name),el('strong',n));return c;}));
  $('#pipeline').replaceChildren(...STAGES.map(stage=>{const b=button('',()=>{$('#stage-filter').value=stage;navigate('saved');});b.className='pipeline-stage';const p=el('progress');p.max=Math.max(1,entries.length);p.value=counts[stage];p.setAttribute('aria-label',stage+' applications');b.append(el('span',stage),p,el('b',counts[stage]));return b;}));
  const next=$('#next-moves');next.replaceChildren();
  const active=entries.filter(x=>x.status!=='Closed'&&x.status!=='Offer').sort((a,b)=>(a.followUp||'9999').localeCompare(b.followUp||'9999')).slice(0,4);
  for(const entry of active){const a=assess(entry.job,skills,entry),row=el('div',undefined,'next-move');row.append(el('b',entry.job.title),el('p',entry.followUp?'Follow up: '+entry.followUp:a.blocked?'Resolve the eligibility issue before applying.':a.verified<4?'Check remaining eligibility requirements.':a.ready<3?'Finish your application preparation.':'Check the employer portal for your next step.','small'),button('Review application',()=>showDetails(entry.job)));next.append(row);}
  if(!active.length)next.append(el('p','Save a role to start your application plan. Your next steps will appear here.','small'));
}
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>navigate(b.dataset.view));
$('#add-job').addEventListener('click',()=>$('#manual-job').showModal());
$('#cancel-manual').addEventListener('click',()=>$('#manual-job').close());
$('#manual-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);let url;try{url=new URL(f.get('url'));if(!['https:','http:'].includes(url.protocol))throw Error();}catch{toast('Enter an http or https application URL.');return;}
  const job={id:'manual-'+Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),title:f.get('title').trim(),company:f.get('company').trim(),location:f.get('location').trim()||'See posting',url:url.href,description:f.get('description').trim(),country:'other',discipline:'Other',source:'Added by you · not verified',fetchedAt:new Date().toISOString(),postedAt:'',salary:'See posting',duration:'See posting',deadline:'Check employer posting',start:''};
  if(!job.title||!job.company||!job.description){toast('Add a title, company and posting text.');return;}saveJob(job);$('#manual-job').close();e.target.reset();navigate('saved');
});
$('#discover').addEventListener('click',()=>navigate('find'));
$('#stage-filter').addEventListener('change',render);
$('#search').addEventListener('submit',e=>{e.preventDefault();render();});
for(const id of ['query','location','country','sort'])$('#'+id).addEventListener(id==='query'||id==='location'?'input':'change',render);
for(const b of document.querySelectorAll('[data-discipline]'))b.addEventListener('click',()=>{selectedDiscipline=b.dataset.discipline;document.querySelectorAll('[data-discipline]').forEach(x=>x.classList.toggle('selected',x===b));render();});
function saveProfile(){skills=[...new Set($('#skills').value.split(',').map(s=>s.trim()).filter(Boolean))].slice(0,40);profile={program:$('#program').value,term:$('#term').value};persist();render();}
for(const id of ['program','term','skills'])$('#'+id).addEventListener('input',saveProfile);
$('#save-skills').addEventListener('click',()=>{saveProfile();flush();toast('Profile updated. Fit assessments refreshed.');});
$('#backup').addEventListener('click',()=>downloadJSON(state()));
$('#restore').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5_000_000)throw Error('Backup is larger than 5 MB.');const merged=mergeBackup(state(),JSON.parse(await file.text()));adopt(merged);persist();render();toast('Backup merged. Existing application records kept.');}catch(error){toast('Restore failed: '+error.message);}e.target.value='';});
$('#retry-save').addEventListener('click',async()=>{if(conflict){toast('Another tab changed progress. Download a backup, then reload.');return;}if(!ready)await bootstrap();await flush();});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
$('#refresh').addEventListener('click',load);$('#close-dialog').addEventListener('click',()=>$('#details').close());
$('#export').addEventListener('click',()=>{const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';const rows=[['Company','Role','Location','Status','Notes','URL','Saved at'],...Object.values(saved).filter(x=>x?.job).map(x=>[x.job.company,x.job.title,x.job.location,x.status,x.notes,x.job.url,x.savedAt])];const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mining-applications.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
await bootstrap();navigate('dashboard');load();
