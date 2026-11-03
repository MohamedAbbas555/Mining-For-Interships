// Public employer pages are fetched politely, cached, and never submitted to.
export const TECK = 'https://jobs.teck.com';
export function plain(s = '') {
  return String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => Number(n) <= 0x10ffff ? String.fromCodePoint(+n) : '').replace(/\s+/g, ' ').trim();
}
export function safeURL(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
export function discipline(s) {
  if (/petroleum|reservoir|oil.and.gas/i.test(s)) return 'Petroleum';
  if (/geolog|geochem|geophys|exploration/i.test(s)) return 'Geology';
  if (/geotech|tailings|rock mechanics/i.test(s)) return 'Geotechnical';
  if (/process|metallurg|mineral/i.test(s)) return 'Processing';
  if (/environment|water/i.test(s)) return 'Environment';
  if (/mine|mining|haulage/i.test(s)) return 'Mining';
  return 'Other';
}
export function sitemapJobs(xml) {
  return [...new Set([...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map(m => plain(m[1])).filter(value => {
    try { const u = new URL(value); return u.origin === TECK && u.pathname.startsWith('/job/') && /co-?op|intern|student/i.test(decodeURIComponent(u.pathname)); } catch { return false; }
  }))];
}
export function parseTeck(html, url, now = new Date()) {
  const title = plain(html.match(/<[^>]+itemprop=["']title["'][^>]*>([\s\S]*?)<\//i)?.[1]);
  if (!title || !/co[ -]?op|intern|student/i.test(title) || /position has been filled|job is no longer available/i.test(html)) return null;
  const text = plain(html);
  const location = text.match(/Location:\s*(.{1,90}?)\s*Employment Type:/i)?.[1] || 'See employer posting';
  const descriptionStart = text.indexOf('Job Description');
  const description = text.slice(Math.max(0, descriptionStart), Math.max(0, descriptionStart) + 18000);
  const closing = text.match(/(?:Closing Date|Application Deadline):\s*([A-Z][a-z]+ \d{1,2}, \d{4})/)?.[1] || '';
  if (closing && new Date(closing + ' 23:59:59 GMT').getTime() < now.getTime()) return null;
  const dateRaw = text.match(/Posting Start Date:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/)?.[1];
  const parts = dateRaw?.split('/').map(Number);
  const posted = parts ? new Date(Date.UTC(parts[2] < 100 ? 2000 + parts[2] : parts[2], parts[0] - 1, parts[1])) : null;
  const postedAt = posted && !isNaN(posted) ? posted.toISOString().slice(0,10) : '';
  return {id: 'teck-' + url.split('/').filter(Boolean).pop(), company: 'Teck', title, location,
    country: /Canada/i.test(location) ? 'ca' : /USA|United States|AK\b|Alaska/i.test(location) ? 'us' : 'other',
    discipline: discipline(title), description, url, source: 'Teck careers', fetchedAt: now.toISOString(), postedAt,
    salary: text.match(/Pay Range:\s*(.{1,90}?)(?=The actual|In addition|Apply with|Why|$)/i)?.[1]?.trim() || 'Not specified',
    duration: text.match(/Duration:\s*(\d+\s*months?)/i)?.[1] || 'See posting',
    start: text.match(/Start Date:\s*([A-Z][a-z]+ \d{1,2}, \d{4})/)?.[1] || '',
    deadline: closing || (/rolling.basis/i.test(text) ? 'Rolling applications' : 'Check employer posting')};
}
async function getText(url, fetcher) {
  const r = await fetcher(url, {signal: AbortSignal.timeout(18000), headers: {'User-Agent': 'MiningInternshipFinder/1.0'}});
  if (!r.ok) throw new Error('Provider HTTP ' + r.status);
  const text = await r.text();
  if (text.length > 5_000_000) throw new Error('Provider response too large');
  return text;
}
export async function fetchTeck(fetcher = fetch) {
  const urls = sitemapJobs(await getText(TECK + '/sitemap.xml', fetcher));
  if (!urls.length) throw new Error('No student URLs found; employer feed may have changed');
  const selected = urls.slice(0, 60), jobs = [];
  let next = 0, failures = 0;
  await Promise.all(Array.from({length: 4}, async () => {
    while (next < selected.length) {
      const url = selected[next++];
      try { const job = parseTeck(await getText(url, fetcher), url); if (job) jobs.push(job); else failures++; }
      catch { failures++; }
    }
  }));
  if (!jobs.length) throw new Error('Employer postings could not be read');
  return {jobs, warning: failures ? `${failures} employer pages could not be read.` : '', limited: urls.length > 60};
}
export function normalizeAdzuna(job, now = new Date()) {
  const url = safeURL(job.redirect_url);
  const title = plain(job.title), description = plain(job.description);
  if (!url || !/\b(intern(?:ship)?|co[ -]?op|student)\b/i.test(title + ' ' + description) || !/mining|mine\b|geolog|geotech|mineral|metallurg|exploration/i.test(title + ' ' + description)) return null;
  return {id: 'adzuna-' + job.id, title, company: plain(job.company?.display_name || 'See posting'),
    location: plain(job.location?.display_name || 'Canada'), country: 'ca', discipline: discipline(title), description,
    url, source: 'Adzuna', fetchedAt: now.toISOString(), postedAt: job.created?.slice(0,10) || '',
    salary: 'See posting', duration: 'See posting', deadline: 'Check employer posting', start: ''};
}
export async function fetchAdzuna(env = process.env, fetcher = fetch) {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) return {jobs: [], disabled: true};
  const queries = ['mining intern', 'mining student', 'geology co op', 'geotechnical intern', 'metallurgy student'];
  const results = await Promise.allSettled(queries.map(async q => {
    const u = new URL('https://api.adzuna.com/v1/api/jobs/ca/search/1');
    u.search = new URLSearchParams({app_id: env.ADZUNA_APP_ID, app_key: env.ADZUNA_APP_KEY, what: q, results_per_page: '50', sort_by: 'date', 'content-type': 'application/json'});
    const data = JSON.parse(await getText(u, fetcher));
    if (!Array.isArray(data.results)) throw new Error('Unexpected provider response');
    return data.results.map(j => normalizeAdzuna(j)).filter(Boolean);
  }));
  const ok = results.filter(r => r.status === 'fulfilled');
  if (!ok.length) throw new Error('Adzuna unavailable; check credentials or quota');
  return {jobs: dedupe(ok.flatMap(r => r.value)), warning: ok.length < queries.length ? 'Some Adzuna queries failed.' : '', limited: true};
}
export function dedupe(jobs) {
  const seen = new Set();
  return jobs.filter(j => { const key = [j.company, j.title, j.location].join('|').toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function filterJobs(jobs, params) {
  const q = (params.get('q') || '').toLowerCase().split(/\s+/).filter(Boolean);
  const location = (params.get('location') || '').toLowerCase();
  const country = params.get('country') || 'ca', type = params.get('discipline') || '';
  return jobs.filter(j => (!country || country === 'all' || j.country === country) && (!type || j.discipline === type)
    && j.location.toLowerCase().includes(location) && q.every(word => `${j.title} ${j.company} ${j.description}`.toLowerCase().includes(word)));
}
export function createCatalog({fetcher = fetch, env = process.env, clock = () => Date.now()} = {}) {
  let snapshot = null, running = null;
  async function refresh() {
    const results = await Promise.allSettled([fetchTeck(fetcher), fetchAdzuna(env, fetcher)]);
    const names = ['Teck careers', 'Adzuna'];
    const sources = results.map((r, i) => ({name: names[i], status: r.status === 'rejected' ? 'error' : r.value.disabled ? 'not configured' : 'ok',
      message: r.status === 'rejected' ? (i === 0 ? 'Employer feed unavailable. Try again later or use the employer links.' : 'Check Adzuna credentials and quota.') : r.value.warning || '',
      count: r.status === 'fulfilled' ? r.value.jobs.length : 0, limited: r.status === 'fulfilled' && !!r.value.limited}));
    const jobs = dedupe(results.flatMap(r => r.status === 'fulfilled' ? r.value.jobs : []));
    if (sources.some(s => s.status === 'ok')) snapshot = {jobs, sources, updatedAt: new Date(clock()).toISOString(), at: clock(), stale: false};
    else if (snapshot) snapshot = {...snapshot, sources, stale: true, retryAt: clock()};
    else snapshot = {jobs: [], sources, updatedAt: null, at: clock(), stale: true, retryAt: clock()};
    return snapshot;
  }
  return async () => {
    const age = snapshot ? clock() - (snapshot.retryAt || snapshot.at) : Infinity;
    if (snapshot && age < (snapshot.stale ? 60000 : 900000)) return snapshot;
    if (!running) running = refresh().finally(() => {running = null;});
    return running;
  };
}
