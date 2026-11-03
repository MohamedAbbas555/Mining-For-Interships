import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
export const MAX_UPLOAD=2*1024*1024;
export function validateUpload(bytes,name){
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw new Error('Choose a nonempty resume file.');
  if(bytes.length>MAX_UPLOAD)throw new Error('Resume must be 2 MB or smaller.');
  const ext=String(name||'').split('.').pop().toLowerCase();
  if(!['pdf','docx','txt'].includes(ext))throw new Error('Use a PDF, DOCX or UTF-8 TXT resume.');
  if(ext==='pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('The file is not a valid PDF.');
  if(ext==='docx'&&(bytes[0]!==0x50||bytes[1]!==0x4b))throw new Error('The file is not a valid DOCX.');
  return ext;
}
export function cleanResume(text){
  const clean=String(text||'').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  if(clean.length<40)throw new Error('Not enough readable text. For a scanned PDF, upload a text-based PDF or paste your resume text.');
  if(clean.length>50000)throw new Error('Resume text exceeds 50,000 characters. Use a shorter document.');
  return clean;
}
export function resumeHash(text){return createHash('sha256').update(text).digest('hex');}
export async function parseResume(bytes,name){
  const ext=validateUpload(bytes,name);
  let text;
  if(ext==='txt'){try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('TXT files must use UTF-8 encoding.');}}
  else text=await new Promise((resolve,reject)=>{
    const w=new Worker(new URL('./resume-worker.js',import.meta.url),{workerData:{bytes,ext},resourceLimits:{maxOldGenerationSizeMb:128}});
    const timer=setTimeout(()=>{w.terminate();reject(new Error('Resume parsing timed out. Try a simpler PDF or TXT file.'));},20000);
    w.once('message',result=>{clearTimeout(timer);w.terminate();result.error?reject(new Error(result.error)):resolve(result.text);});
    w.once('error',()=>{clearTimeout(timer);reject(new Error('Cannot read this resume. Try exporting a new PDF or TXT file.'));});
    w.once('exit',code=>{clearTimeout(timer);if(code)reject(new Error('Resume parser could not finish. Try a smaller TXT file.'));});
  });
  text=cleanResume(text);
  return {name:String(name).split(/[\\/]/).pop().replace(/[^\p{L}\p{N} ._-]/gu,'_').slice(0,150),text,hash:resumeHash(text),updatedAt:new Date().toISOString()};
}
