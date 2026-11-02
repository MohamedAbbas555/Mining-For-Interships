'use strict';
const $ = s => document.querySelector(s);
let jobs = [], sourceState = [], selectedDiscipline = '', view = 'find', loading = false;
function read(key, fallback) {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}}
let saved = read('ore-applications-v1', {}), skills = read('ore-skills-v1', []);
if (!saved || Array.isArray(saved) || typeof saved !== 'object') saved = {};
if (!Array.isArray(skills)) skills = [];
function toast(s) {$('#toast').textContent = s; $('#toast').style.display = 'block'; setTimeout(() => $('#toast').style.display = 'none', 3500);}
function persist() {try {localStorage.setItem('ore-applications-v1', JSON.stringify(saved)); localStorage.setItem('ore-skills-v1', JSON.stringify(skills));} catch {toast('Browser storage is unavailable. Export your tracker before closing.');}}
function el(tag, text, className) {const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e;}
function link(text, url) {const e = el('a',text); try {const u = new URL(url); if (!['https:','http:'].includes(u.protocol)) throw Error(); e.href=u.href; e.target='_blank'; e.rel='noopener noreferrer';} catch {e.removeAttribute('href');} return e;}
function button(text, fn) {const b = el('button',text); b.type='button'; b.addEventListener('click',fn); return b;}
function matches(j) {return skills.filter(s => s && `${j.title} ${j.description}`.toLowerCase().includes(s.toLowerCase()));}
function updateCount() {$('#saved-count').textContent=Object.keys(saved).length;}
function saveJob(j) {if (saved[j.id]) {delete saved[j.id]; toast('Removed from your tracker.');} else {saved[j.id]={job:j,status:'Saved',notes:'',savedAt:new Date().toISOString()};toast('Saved to My applications.');} persist();render();}
function showDetails(j) {
  const box=$('#detail-content');box.replaceChildren(el('p',j.company,'eyebrow'),el('h2',j.title),el('p',`${j.location} · ${j.duration}`),el('p',`${j.salary} · ${j.deadline}`));
  if(j.start) box.append(el('p','Start date: '+j.start));
  box.append(el('p',j.description,'detail-text'),el('p','Source: '+j.source+' · retrieved '+new Date(j.fetchedAt).toLocaleString(),'small'),link('Check full posting & apply ↗',j.url));
  $('#details').showModal();
}
function card(j, tracked=false) {
  const c=el('article',undefined,'card'),head=el('div',undefined,'card-head'),titles=el('div');
  titles.append(el('p',j.company,'company'),el('h3',j.title));head.append(el('div',j.company[0],'logo'),titles,el('span',j.discipline,'badge'));
  const meta=el('div',undefined,'meta');meta.append(el('span','↗ '+j.location),el('span','◷ '+j.duration),el('span',j.postedAt?'Posted '+j.postedAt:'Posting date unavailable'));
  const matched=matches(j);const foot=el('div',undefined,'card-foot');foot.append(button(saved[j.id]?'✓ Saved · remove':'+ Save',()=>saveJob(j)),button('Details',()=>showDetails(j)),link('View & apply ↗',j.url));
  c.append(head,meta,el('p',j.salary,'summary'),el('p',matched.length?'Skill keywords: '+matched.join(', '):'Review eligibility and term dates on the employer posting.','small'),el('span',j.source+' · '+j.deadline,'source-label'),foot);
  if(tracked){const entry=saved[j.id],row=el('div',undefined,'tracker'),label=el('label','Application status'),select=el('select');
    for(const s of ['Saved','Preparing','Applied','Interview','Offer','Closed']){const o=el('option',s);o.value=s;select.append(o);}select.value=entry.status;select.addEventListener('change',()=>{entry.status=select.value;persist();});label.append(select);
    const noteLabel=el('label','Notes'),notes=el('textarea');notes.value=entry.notes;notes.placeholder='Deadline, contact, next step…';notes.rows=2;notes.maxLength=5000;notes.addEventListener('input',()=>{entry.notes=notes.value;persist();});noteLabel.append(notes);row.append(label,noteLabel);c.append(row);}
  return c;
}
function render() {
  updateCount();
  const q=$('#query').value.trim().toLowerCase().split(/\s+/).filter(Boolean),where=$('#location').value.toLowerCase().trim(),country=$('#country').value;
  const filtered=jobs.filter(j=>(country==='all'||j.country===country)&&(!selectedDiscipline||j.discipline===selectedDiscipline)&&j.location.toLowerCase().includes(where)&&q.every(w=>`${j.title} ${j.company} ${j.description}`.toLowerCase().includes(w)));
  filtered.sort((a,b)=>$('#sort').value==='match'?matches(b).length-matches(a).length:(b.postedAt||'').localeCompare(a.postedAt||''));
  $('#result-count').textContent=filtered.length;$('#results').replaceChildren(...filtered.map(j=>card(j)));
  if(!filtered.length) $('#results').append(el('div',loading?'Reading employer postings. The first scan can take a minute or two.':'No matching listings. Try fewer keywords, another region, or check Sources & setup for feed status and employer links.','empty'));
  $('#saved-results').replaceChildren(...Object.values(saved).filter(v=>v?.job?.id).map(v=>card(v.job,true)));
  if(!Object.keys(saved).length) $('#saved-results').append(el('div','Your next opportunity starts with a shortlist. Save a role from Find internships to track it here.','empty'));
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
for(const b of document.querySelectorAll('[data-view]')) b.addEventListener('click',()=>{view=b.dataset.view;for(const name of ['find','saved','sources'])$('#'+name+'-view').hidden=name!==view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));render();});
$('#search').addEventListener('submit',e=>{e.preventDefault();render();});
for(const id of ['query','location','country','sort'])$('#'+id).addEventListener(id==='query'||id==='location'?'input':'change',render);
for(const b of document.querySelectorAll('[data-discipline]'))b.addEventListener('click',()=>{selectedDiscipline=b.dataset.discipline;document.querySelectorAll('[data-discipline]').forEach(x=>x.classList.toggle('selected',x===b));render();});
$('#skills').value=skills.join(', ');$('#save-skills').addEventListener('click',()=>{skills=[...new Set($('#skills').value.split(',').map(s=>s.trim()).filter(Boolean))].slice(0,30);persist();render();toast('Skills saved. Choose Skill matches to sort.');});
$('#refresh').addEventListener('click',load);$('#close-dialog').addEventListener('click',()=>$('#details').close());
$('#export').addEventListener('click',()=>{const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';const rows=[['Company','Role','Location','Status','Notes','URL','Saved at'],...Object.values(saved).filter(x=>x?.job).map(x=>[x.job.company,x.job.title,x.job.location,x.status,x.notes,x.job.url,x.savedAt])];const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mining-applications.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
render();load();
