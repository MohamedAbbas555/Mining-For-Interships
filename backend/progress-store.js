import {readFile,mkdir,writeFile,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {emptyState,normalizeState} from '../public/progress.js';
export function createProgressStore(directory) {
  const path=join(directory,'progress.json');let queue=Promise.resolve();
  async function read(){try{const data=JSON.parse(await readFile(path,'utf8'));if(!Number.isSafeInteger(data.revision)||data.revision<1)throw Error('Invalid revision');return {...data,state:normalizeState(data.state)};}catch(e){if(e.code==='ENOENT')return {revision:0,savedAt:null,state:emptyState()};throw e;}}
  function write(state,expectedRevision){
    const operation=queue.then(async()=>{const clean=normalizeState(state),current=await read();if(expectedRevision!==current.revision){const e=Error('Progress changed in another tab. Export this tab as a backup, then reload.');e.status=409;throw e;}
      const next={revision:current.revision+1,savedAt:new Date().toISOString(),state:clean};await mkdir(directory,{recursive:true,mode:0o700});const temp=path+'.'+randomUUID()+'.tmp';
      try{await writeFile(temp,JSON.stringify(next),{mode:0o600});await rename(temp,path);}finally{await unlink(temp).catch(()=>{});}return next;});
    queue=operation.catch(()=>{});return operation;
  }
  return {read,write};
}
