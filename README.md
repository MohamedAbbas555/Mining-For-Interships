# Mining-For-Interships
An application primarily focused on finding the best internships for Mining, Petroleum, and Geological engineers.

# ORE — Mining Internship Finder

A Canada-first mining internship finder inspired by the uploaded **Zinterno** project. Find student and co-op roles, filter by discipline/location, match skill keywords, and track your applications.

## Run it (Windows, macOS, Linux)

1. Install **Node.js 22.9 or newer** (Node.js 24 recommended).
2. Download this repository as a ZIP from GitHub's **Code → Download ZIP**, then extract it.
3. Open a terminal in the extracted folder and run:

   ```sh
   npm start
   ```
4. Open **http://localhost:3000**. Keep the terminal open while using it.

There are **no packages to install**, no database, and no account signup. On Windows, you can double-click `START-WINDOWS.bat` after installing Node.js.

The first search reads live employer pages and can take one or two minutes. A slow provider can take longer. Results are cached in memory for 15 minutes; Refresh reads the cache until it expires. Restarting the process clears the cache. No refresh runs while the program is closed.

## What works without a key

- Discovers internship, co-op, and student URLs from Teck's public careers sitemap.
- Fetches employer pages, extracts job title, location, posting date, duration, start date and pay where present.
- Includes all student disciplines at this mining employer; use discipline filters to focus on technical roles.
- Canada is the default region; other regions are available when present in the feed.
- Shows source status, partial failures, and clearly labelled older cached results during outages.
- Saves applications and notes in this browser; export the tracker to CSV for backup.
- Skill matching is literal keyword matching, not AI ranking or a guarantee of eligibility.
- Links to Agnico Eagle's student portal as a separate directory entry.

## Optional broader search: Adzuna

Get credentials at https://developer.adzuna.com/. Copy `.env.example` to `.env`, fill in `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`, then restart. Credentials remain on the server. Do not commit `.env`.

The adapter searches Canada's Adzuna endpoint for five mining/geology/geotechnical/metallurgy student queries, up to 50 records each. It excludes results without both student/internship and mining-related keywords, removes duplicate company/title/location combinations, and links through the provider. API usage is subject to your account's limits and terms.

## Coverage and privacy

This is a personal local application, not a complete index of every internship. Teck scans are capped at 60 student pages, with four concurrent requests. Page layouts and API availability can change. Unavailable fields say “See posting” or “Not specified”; deadlines are not inferred from posting dates. Read the employer's full page before applying.

The app only reads public postings. It does not submit applications, send emails, upload resumes, or sign into employer accounts. Skills, notes, and saved application statuses stay in localStorage for the current browser/origin. They do not synchronize across devices. Clearing browser storage deletes them. CSV export contains notes and URLs; store it privately.

The server binds to `127.0.0.1` by default. Do not expose it publicly without adding authentication, request limits, and durable shared caching. No scheduled searches run automatically. The app has no analytics or remote fonts.

## Blueprint mapping

Zinterno supplies the product blueprint: internship cards and detail views, company/skill filters, profile matching, and application links. ORE is a focused implementation of those patterns, with automatic discovery in place of manually populated MongoDB listings. The original login, admin, resume-upload and MongoDB components are not required for this single-user version. The upload also contained case-sensitive import mismatches; this implementation uses consistent module paths and starts on Linux, Windows, and macOS.

## Development

- `public/index.html`, `public/style.css`, `public/app.js`: responsive UI and browser-local tracker.
- `backend/jobs.js`: employer discovery, parser, optional Adzuna adapter, cache and filters.
- `backend/server.js`: local HTTP server and read-only API.
- `test/jobs.test.js`: parser, provider filtering, caching, failure handling, and HTTP tests.

```sh
npm test
```

API: `GET /api/jobs?country=ca&discipline=Geology&location=Vancouver&q=excel`.
Use `country=all` for all available regions. `GET /api/health` checks the local server.

## Source references

- https://jobs.teck.com/sitemap.xml — live discovery
- https://jobs.teck.com/careers/ — employer application portal
- https://developer.adzuna.com/overview — optional search API
- https://agnicoeagle.com/English/careers/student-experiences/default.aspx — student directory link
