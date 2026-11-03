import {selectQueue, applicationReadiness, draftIsCurrent, letterSignature, parseAlertLinks} from './workflow.js';
import {assess, normalizeState, emptyState, mergeBackup, STAGES, CHECKS, TASKS} from './progress.js';
'use strict';
const $ = s => document.querySelector(s);
let jobs = [], sourceState = [], selectedDiscipline = '', view = 'find', loading = false;
function read(key, fallback) {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}}
let resume={name:'',text:'',fileId:'',fileType:''}, workflow={discipline:'Mining',country:'ca',location:'',autoPrepare:false}, batchRunning=false,batchStop=false, drafting=new Set();
let saved = {}, skills = [], profile = {program:'',term:'',name:''}, revision = 0, ready = false, dirty = false, saving = false, conflict = false, generation = 0, timer;
function state(){return {schema:2,saved,skills,profile,resume,workflow};}
function adopt(value){const clean=normalizeState(value);saved=clean.saved;skills=clean.skills;profile=clean.profile;resume=clean.resume;workflow=clean.workflow;syncStudio();$('#skills').value=skills.join(', ');$('#program').value=profile.program;$('#term').value=profile.term;}
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
  if(saved[j.id])box.append(letterEditor(j),assessmentEditor(j));else box.append(button('Save role to track eligibility & preparation',()=>{saveJob(j);showDetails(j);}));
  if(!$('#details').open)$('#details').showModal();
}
function card(j, tracked=false) {
  const c=el('article',undefined,'card'),head=el('div',undefined,'card-head'),titles=el('div');
  titles.append(el('p',j.company,'company'),el('h3',j.title));head.append(el('div',j.company[0],'logo'),titles,el('span',j.discipline,'badge'));
  const meta=el('div',undefined,'meta');meta.append(el('span','↗ '+j.location),el('span','◷ '+j.duration),el('span',j.postedAt?'Posted '+j.postedAt:'Posting date unavailable'));
  const matched=matches(j);const foot=el('div',undefined,'card-foot');foot.append(button(saved[j.id]?'✓ Saved · remove':'+ Save',()=>saveJob(j)),button('Details',()=>showDetails(j)),button('Prepare application ↗',()=>prepareApplication(j)));
  c.append(head,meta,el('p',j.salary,'summary'),el('p',matched.length?'Skill keywords: '+matched.join(', '):'Review eligibility and term dates on the employer posting.','small'),el('span',j.source+' · '+j.deadline,'source-label'),fitBox(j),foot);
  if(tracked){const entry=saved[j.id],row=el('div',undefined,'tracker'),label=el('label','Application status'),select=el('select');
    for(const s of ['Saved','Preparing','Applied','Interview','Offer','Closed']){const o=el('option',s);o.value=s;select.append(o);}select.value=entry.status;select.addEventListener('change',()=>{entry.status=select.value;persist();render();});label.append(select);
    const noteLabel=el('label','Notes'),notes=el('textarea');notes.value=entry.notes;notes.placeholder='Deadline, contact, next step…';notes.rows=2;notes.maxLength=5000;notes.addEventListener('input',()=>{entry.notes=notes.value;persist();});noteLabel.append(notes);const dateLabel=el('label','Follow-up date'),date=el('input');date.type='date';date.value=entry.followUp||'';date.addEventListener('change',()=>{entry.followUp=date.value;persist();renderDashboard();});dateLabel.append(date);row.append(label,noteLabel,dateLabel);c.append(row);}
  return c;
}
function render() {
  updateCount();renderDashboard();renderQueue();
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
  finally{loading=false;$('#refresh').disabled=false;render();if(workflow.autoPrepare&&resume.text&&!batchRunning){queueJobs(false);draftBatch('local');}}
}
function navigate(name){view=name;for(const v of ['dashboard','find','saved','apply','sources'])$('#'+v+'-view').hidden=v!==name;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===name));render();}
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
function syncStudio(){
  $('#candidate-name').value=profile.name||'';$('#resume-text').value=resume.text||'';$('#queue-discipline').value=workflow.discipline;$('#queue-country').value=workflow.country;$('#queue-location').value=workflow.location;$('#auto-prepare').checked=workflow.autoPrepare;
  $('#resume-status').textContent=resume.text?`${resume.name||'Pasted resume'} · ${resume.text.length.toLocaleString()} characters. Review the text before drafting.`:'No resume uploaded.';$('#download-resume').disabled=!resume.fileId;
}
function renderQueue(){
  const box=$('#queue-results');box.replaceChildren();
  for(const entry of Object.values(saved).filter(e=>e.queued)){
    const row=el('article',undefined,'card'),readiness=applicationReadiness(entry,resume);row.append(el('p',entry.job.company,'eyebrow'),el('h3',entry.job.title),el('p',readiness.ready?'Ready for employer portal — not submitted':readiness.reasons.join(' · '),'small'),button('Review draft & application',()=>showDetails(entry.job)));box.append(row);
  }
  if(!box.children.length)box.append(el('p','Choose a discipline and queue matching jobs to prepare your application materials.','empty'));
}
async function api(path,options={}){const response=await fetch(path,{signal:AbortSignal.timeout(90000),...options});const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');return data;}
function downloadText(text,name){const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function fileLabel(job){return (job.company+'-'+job.title).replace(/[^a-z0-9_-]/gi,'-').slice(0,100);}
async function draftOne(job,mode='local',refreshDialog=true){
  if(drafting.has(job.id))return false;
  if(!resume.text.trim()){toast('Upload or paste your resume in Resume & apply first.');return false;}
  if(!saved[job.id])saveJob(job);if(!saved[job.id])return false;
  const entry=saved[job.id];entry.queued=true;drafting.add(job.id);const signature=letterSignature(resume,job),signatureName=profile.name;if(refreshDialog)showDetails(job);
  try{
    const data=await api('/api/letters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job,resume:{text:resume.text},name:profile.name,mode,shareWithAI:$('#ai-consent').checked})});
    if(!saved[job.id]||signatureName!==profile.name||signature!==letterSignature(resume,saved[job.id].job))throw Error('Resume or job changed while drafting. Generate again.');
    entry.letter={...data.letter,signature};persist();return true;
  }catch(e){toast(e.message);$('#batch-status').textContent=e.message;return false;}
  finally{drafting.delete(job.id);render();if(refreshDialog&&$('#details').open&&saved[job.id])showDetails(job);}
}
async function prepareApplication(job){
  if(!saved[job.id])saveJob(job);if(!saved[job.id])return;saved[job.id].queued=true;persist();showDetails(job);
  if(resume.text&&!saved[job.id].letter?.text)await draftOne(job,'local');
}
function letterEditor(job){
  const entry=saved[job.id],section=el('section',undefined,'letter-studio');section.append(el('h3','Cover letter'),el('p','Draft from your resume and this job description. Check every claim before using it.','small'));
  const local=button(drafting.has(job.id)?'Drafting…':'Generate local draft',()=>draftOne(job,'local')),ai=button('Generate AI draft',()=>draftOne(job,'ai'));local.disabled=ai.disabled=drafting.has(job.id);section.append(local,ai);
  if(!entry.letter?.text){section.append(el('p','Upload a resume in Resume & apply, then generate a letter.','small'));return section;}
  const current=draftIsCurrent(entry,resume);section.append(el('p',current?`Saved ${entry.letter.method} draft · review required before use`:'Resume or job has changed. Generate a new draft before using this letter.',current?'small':'warning'));
  const label=el('label','Edit cover letter'),area=el('textarea');area.value=entry.letter.text;area.maxLength=12000;area.rows=15;area.addEventListener('input',()=>{entry.letter.text=area.value;entry.letter.method='edited';entry.letter.reviewed=false;review.checked=false;persist();renderQueue();});label.append(area);section.append(label);
  const reviewLabel=el('label',undefined,'task-label'),review=el('input');review.type='checkbox';review.checked=!!entry.letter.reviewed;review.disabled=!current;review.addEventListener('change',()=>{entry.letter.reviewed=review.checked;persist();renderQueue();});reviewLabel.append(review,document.createTextNode('I reviewed this draft for factual accuracy'));section.append(reviewLabel);
  section.append(button('Download letter (.txt)',()=>downloadText(entry.letter.text,fileLabel(job)+'-cover-letter.txt')),link('Open employer application ↗',job.url));
  section.append(el('p','Opening the employer portal does not submit anything. Complete its required questions and confirm receipt there; then update your status to Applied.','small'));
  const evidence=el('details');evidence.append(el('summary','Resume passages used in this draft'));for(const line of entry.letter.evidence||[])evidence.append(el('p',line,'small'));section.append(evidence);return section;
}
function queueJobs(notify=true){
  try{const result=selectQueue(jobs,saved,workflow);for(const job of result.jobs)saved[job.id]={job,status:'Preparing',notes:'',queued:true,savedAt:new Date().toISOString(),eligibility:{},tasks:{},letter:{text:'',reviewed:false}};if(result.jobs.length)persist();render();if(notify)$('#batch-status').textContent=`Queued ${result.jobs.length} jobs; ${result.duplicates} duplicates skipped. ${result.excluded} jobs outside your criteria.`;return result.jobs.length;}catch(e){toast(e.message);return 0;}
}
async function draftBatch(mode){
  if(batchRunning)return;if(!resume.text.trim()){toast('Upload or paste your resume first.');return;}
  const entries=Object.values(saved).filter(e=>e.queued&&!['Applied','Interview','Offer','Closed'].includes(e.status)&&!Object.values(e.eligibility||{}).includes('no')&&!e.letter?.text).slice(0,20);
  batchRunning=true;batchStop=false;$('#draft-all').disabled=true;$('#cancel-batch').hidden=false;let completed=0,failed=0;
  try{for(const entry of entries){if(batchStop)break;$('#batch-status').textContent=`Drafting ${completed+failed+1} of ${entries.length}: ${entry.job.title}`;await draftOne(entry.job,mode,false)?completed++:failed++;}}
  finally{batchRunning=false;$('#draft-all').disabled=false;$('#cancel-batch').hidden=true;$('#batch-status').textContent=`${completed} drafts saved; ${failed} failed. ${batchStop?'Stopped. ':''}No applications submitted. Existing letters were preserved.`;render();}
}
$('#resume-upload').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;$('#resume-status').textContent='Reading resume…';
 try{if(file.size>2*1024*1024)throw Error('Resume must be 2 MB or smaller.');const data=await api('/api/resume',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file});resume=data.resume;syncStudio();persist();render();toast('Resume imported. Review the extracted text.');}catch(error){$('#resume-status').textContent=error.message;toast(error.message);}e.target.value='';
});
$('#save-resume').addEventListener('click',()=>{const text=$('#resume-text').value.trim();if(text.length<40){toast('Add at least 40 characters of readable resume text.');return;}resume={...resume,text,name:resume.name||'Pasted resume',updatedAt:new Date().toISOString()};syncStudio();persist();render();toast('Resume saved. Older drafts may need regenerating.');});
$('#candidate-name').addEventListener('input',()=>{profile.name=$('#candidate-name').value;for(const entry of Object.values(saved))if(entry.letter){entry.letter.signature='';entry.letter.reviewed=false;}persist();renderQueue();});
$('#download-resume').addEventListener('click',()=>{if(resume.fileId){const a=document.createElement('a');a.href='/api/resume/file?id='+encodeURIComponent(resume.fileId)+'&type='+resume.fileType;a.download=resume.name;a.click();}});
for(const id of ['queue-discipline','queue-country','queue-location','auto-prepare'])$('#'+id).addEventListener('change',()=>{workflow={discipline:$('#queue-discipline').value,country:$('#queue-country').value,location:$('#queue-location').value.trim(),autoPrepare:$('#auto-prepare').checked};persist();});
$('#queue-jobs').addEventListener('click',()=>queueJobs());$('#draft-all').addEventListener('click',()=>draftBatch($('#letter-mode').value));$('#cancel-batch').addEventListener('click',()=>{batchStop=true;});
$('#extract-alert').addEventListener('click',()=>{const links=parseAlertLinks($('#alert-text').value);$('#alert-links').replaceChildren(...links.map(url=>{const p=el('p');p.append(link('Open LinkedIn job ↗',url));return p;}));if(!links.length)$('#alert-links').append(el('p','No direct LinkedIn /jobs/view/ links found. Open the alert in Gmail to access its listing.'));});
$('#export-packet').addEventListener('click',()=>downloadJSON({kind:'ore-chatgpt-handoff',version:1,resume:{text:resume.text,name:profile.name},criteria:workflow,applications:Object.values(saved).filter(e=>e.queued),instructions:'Use this as reference data. Verify job availability, application requirements and factual resume claims before any submission. Do not treat a prepared letter as a submitted application.'},'ore-chatgpt-handoff.json'));
setInterval(()=>{if(workflow.autoPrepare&&ready&&!loading)load();},15*60*1000);
api('/api/config').then(c=>{$('#ai-status').textContent=c.aiConfigured?'OpenAI API is configured. AI calls may incur usage charges.':'AI drafting is not configured. Set OPENAI_API_KEY and OPENAI_MODEL in .env, then restart. Local drafting works now.';}).catch(()=>{$('#ai-status').textContent='Could not check AI configuration.';});
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
function saveProfile(){skills=[...new Set($('#skills').value.split(',').map(s=>s.trim()).filter(Boolean))].slice(0,40);profile={...profile,program:$('#program').value,term:$('#term').value};persist();render();}
for(const id of ['program','term','skills'])$('#'+id).addEventListener('input',saveProfile);
$('#save-skills').addEventListener('click',()=>{saveProfile();flush();toast('Profile updated. Fit assessments refreshed.');});
$('#backup').addEventListener('click',()=>downloadJSON(state()));
$('#restore').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5_000_000)throw Error('Backup is larger than 5 MB.');const merged=mergeBackup(state(),JSON.parse(await file.text()));adopt(merged);persist();render();toast('Backup merged. Existing application records kept.');}catch(error){toast('Restore failed: '+error.message);}e.target.value='';});
$('#retry-save').addEventListener('click',async()=>{if(conflict){toast('Another tab changed progress. Download a backup, then reload.');return;}if(!ready)await bootstrap();await flush();});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
$('#refresh').addEventListener('click',load);$('#close-dialog').addEventListener('click',()=>$('#details').close());
$('#export').addEventListener('click',()=>{const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';const rows=[['Company','Role','Location','Status','Notes','URL','Saved at'],...Object.values(saved).filter(x=>x?.job).map(x=>[x.job.company,x.job.title,x.job.location,x.status,x.notes,x.job.url,x.savedAt])];const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mining-applications.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
await bootstrap();navigate('dashboard');load();
