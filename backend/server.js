import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createCatalog, filterJobs} from './jobs.js';
import {createProgressStore} from './progress-store.js';
import {parseResume,MAX_UPLOAD} from './resume.js';
import {generateLetter} from './letters.js';
const catalog = createCatalog();
const files = {'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/progress.js':['progress.js','text/javascript'],'/workflow.js':['workflow.js','text/javascript'],'/style.css':['style.css','text/css']};
async function body(req,max){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max){const e=Error('Upload exceeds the size limit.');e.status=413;throw e;}chunks.push(chunk);}return Buffer.concat(chunks);}
async function json(req,max=250000){if(!req.headers['content-type']?.startsWith('application/json')){const e=Error('JSON required');e.status=415;throw e;}try{return JSON.parse((await body(req,max)).toString('utf8'));}catch(e){if(e.status)throw e;const error=Error('Invalid JSON');error.status=400;throw error;}}
export function createServer({dataDir=process.env.ORE_DATA_DIR||fileURLToPath(new URL('../data/',import.meta.url)),store=createProgressStore(dataDir),getCatalog=catalog,env=process.env,fetcher=fetch}={}){
  let activeUploads=0,activeDrafts=0;
  return http.createServer(async(req,res)=>{
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"};
    const send=(status,type,data,extra={})=>{res.writeHead(status,{...headers,'Content-Type':type,...extra});res.end(data);};
    const respond=(status,data)=>send(status,'application/json; charset=utf-8',JSON.stringify(data));
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')){
        if(req.headers['sec-fetch-site']==='cross-site')return respond(403,{error:'Cross-site request blocked'});
        if(req.headers.origin&&!['http://'+req.headers.host,'https://'+req.headers.host].includes(req.headers.origin))return respond(403,{error:'Origin mismatch'});
        if(!['localhost','127.0.0.1','[::1]','terminal.local'].includes(new URL('http://'+req.headers.host).hostname))return respond(403,{error:'Use localhost to access the local app.'});
      }
      if(url.pathname==='/api/progress'){
        if(req.method==='GET')return respond(200,await store.read());
        if(req.method==='PUT'){
          const payload=await json(req,5_000_000);
          if(!payload||!Number.isSafeInteger(payload.revision))return respond(400,{error:'Revision required'});
          try{return respond(200,await store.write(payload.state,payload.revision));}
          catch(e){return respond(e.status||400,{error:e.status===409?e.message:'Progress could not be saved. Check the backup format and local disk permissions.'});}
        }
        return respond(405,{error:'Method not allowed'});
      }
      if(url.pathname==='/api/resume'&&req.method==='POST'){
        if(activeUploads>=2)return respond(429,{error:'Another resume is being read. Try again shortly.'});
        activeUploads++;
        try{
          if(req.headers['content-type']!=='application/octet-stream')return respond(415,{error:'Upload a file as binary data.'});
          const bytes=await body(req,MAX_UPLOAD);let name;try{name=decodeURIComponent(req.headers['x-file-name']||'');}catch{return respond(400,{error:'Invalid filename'});}
          let resume;try{resume=await parseResume(bytes,name);}catch(e){return respond(422,{error:e.message});}
          const fileId=createHash('sha256').update(bytes).digest('hex');const ext=name.split('.').pop().toLowerCase();
          const dir=join(dataDir,'resumes');await mkdir(dir,{recursive:true,mode:0o700});await writeFile(join(dir,fileId+'.'+ext),bytes,{mode:0o600});
          return respond(200,{resume:{...resume,fileId,fileType:ext}});
        }finally{activeUploads--;}
      }
      if(url.pathname==='/api/resume/file'&&req.method==='GET'){
        const id=url.searchParams.get('id'),type=url.searchParams.get('type');if(!/^[a-f0-9]{64}$/.test(id||'')||!['pdf','docx','txt'].includes(type))return respond(400,{error:'Invalid resume reference'});
        try{const bytes=await readFile(join(dataDir,'resumes',id+'.'+type));return send(200,'application/octet-stream',bytes,{'Content-Disposition':`attachment; filename="resume.${type}"`});}catch{return respond(404,{error:'Original resume is not available on this computer. Upload it again.'});}
      }
      if(url.pathname==='/api/letters'&&req.method==='POST'){
        if(activeDrafts)return respond(429,{error:'A cover letter is already being drafted. Try again shortly.'});activeDrafts++;
        try{const input=await json(req);try{return respond(200,{letter:await generateLetter(input,{env,fetcher})});}catch(e){return respond(422,{error:e.message.includes('fetch')?'AI service is unreachable. Try the local draft.':e.message});}}finally{activeDrafts--;}
      }
      if(req.method!=='GET')return respond(405,{error:'Method not allowed'});
      if(url.pathname==='/api/config')return respond(200,{aiConfigured:!!(env.OPENAI_API_KEY&&env.OPENAI_MODEL),autoSubmit:false,gmailConnected:false});
      if(url.pathname==='/api/health')return respond(200,{ok:true});
      if(url.pathname==='/api/jobs'){const data=await getCatalog();return respond(200,{...data,at:undefined,retryAt:undefined,jobs:filterJobs(data.jobs,url.searchParams)});}
      const file=files[url.pathname];if(!file)return send(404,'text/plain','Not found');send(200,file[1]+'; charset=utf-8',await readFile(new URL('../public/'+file[0],import.meta.url)));
    }catch(e){respond(e.status||500,{error:e.status?e.message:'Unable to complete this request. Check the local server and try again.'});}
  });
}
export const server=createServer();
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const option=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
 const port=Number(option('--port')||process.env.PORT||3000),host=option('--host')||'127.0.0.1';
 server.listen(port,host,()=>console.log(`Mining Internship Finder: http://${host}:${port}`));
}
