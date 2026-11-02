import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createCatalog, filterJobs} from './jobs.js';
const catalog = createCatalog();
const files = {'/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css']};
export const server = http.createServer(async (req, res) => {
  const headers = {'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"};
  function send(status, type, body) {res.writeHead(status, {...headers, 'Content-Type': type + '; charset=utf-8'}); res.end(body);}
  try {
    if (req.method !== 'GET') return send(405, 'text/plain', 'Method not allowed');
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/health') return send(200, 'application/json', JSON.stringify({ok:true}));
    if (url.pathname === '/api/jobs') {
      const data = await catalog();
      return send(200, 'application/json', JSON.stringify({...data, at: undefined, retryAt: undefined, jobs: filterJobs(data.jobs, url.searchParams)}));
    }
    const file = files[url.pathname];
    if (!file) return send(404, 'text/plain', 'Not found');
    send(200, file[1], await readFile(new URL('../public/' + file[0], import.meta.url)));
  } catch {send(500, 'application/json', JSON.stringify({error:'Unable to load data. Please try again.'}));}
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const option = name => {const i = process.argv.indexOf(name);return i >= 0 ? process.argv[i+1] : undefined;};
  const port = Number(option('--port') || process.env.PORT || 3000);
  const host = option('--host') || '127.0.0.1';
  server.listen(port, host, () => console.log(`Mining Internship Finder: http://${host}:${port}`));
}
