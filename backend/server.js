import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createCatalog, filterJobs} from './jobs.js';
import {createProgressStore} from './progress-store.js';
const catalog = createCatalog();
const files = {'/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/progress.js': ['progress.js', 'text/javascript'], '/style.css': ['style.css', 'text/css']};
export function createServer({store = createProgressStore(process.env.ORE_DATA_DIR || fileURLToPath(new URL('../data/',import.meta.url))), getCatalog = catalog} = {}) {return http.createServer(async (req, res) => {
  const headers = {'Cache-Control':'no-store','X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"};
  function send(status, type, body) {res.writeHead(status, {...headers, 'Content-Type': type + '; charset=utf-8'}); res.end(body);}
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/progress') {
      // JSON-only same-origin writes prevent cross-site form submissions to localhost.
      if (req.headers['sec-fetch-site'] === 'cross-site') return send(403,'application/json',JSON.stringify({error:'Cross-site request blocked'}));
      if (req.headers.origin && !['http://'+req.headers.host,'https://'+req.headers.host].includes(req.headers.origin)) return send(403,'application/json',JSON.stringify({error:'Origin mismatch'}));
      if (req.method === 'GET') return send(200,'application/json',JSON.stringify(await store.read()));
      if (req.method === 'PUT') {
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415,'application/json',JSON.stringify({error:'JSON required'}));
        const chunks=[];let bytes=0;
        for await (const chunk of req) {bytes+=chunk.length;if(bytes>5_000_000)return send(413,'application/json',JSON.stringify({error:'Backup exceeds 5 MB'}));chunks.push(chunk);}
        let payload;try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,'application/json',JSON.stringify({error:'Invalid JSON'}));}
        if (!payload || !Number.isSafeInteger(payload.revision)) return send(400,'application/json',JSON.stringify({error:'Revision required'}));
        try {return send(200,'application/json',JSON.stringify(await store.write(payload.state,payload.revision)));}
        catch(e){return send(e.status || 400,'application/json',JSON.stringify({error:e.status===409?e.message:'Progress could not be saved. Check the backup format and local disk permissions.'}));}
      }
      return send(405,'text/plain','Method not allowed');
    }
    if (req.method !== 'GET') return send(405, 'text/plain', 'Method not allowed');
    if (url.pathname === '/api/health') return send(200, 'application/json', JSON.stringify({ok:true}));
    if (url.pathname === '/api/jobs') {
      const data = await getCatalog();
      return send(200, 'application/json', JSON.stringify({...data, at: undefined, retryAt: undefined, jobs: filterJobs(data.jobs, url.searchParams)}));
    }
    const file = files[url.pathname];
    if (!file) return send(404, 'text/plain', 'Not found');
    send(200, file[1], await readFile(new URL('../public/' + file[0], import.meta.url)));
  } catch {send(500, 'application/json', JSON.stringify({error:'Unable to load data. Please try again.'}));}
});}
export const server = createServer();
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const option = name => {const i = process.argv.indexOf(name);return i >= 0 ? process.argv[i+1] : undefined;};
  const port = Number(option('--port') || process.env.PORT || 3000);
  const host = option('--host') || '127.0.0.1';
  server.listen(port, host, () => console.log(`Mining Internship Finder: http://${host}:${port}`));
}
