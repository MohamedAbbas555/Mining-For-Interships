# Mining-For-Interships
An application primarily focused on finding the best internships for Mining, Petroleum, and Geological engineers.

# ORE — Mining Internship Finder

A Canada-first mining internship finder inspired by the uploaded **Zinterno** project. Find student and co-op roles, filter by discipline/location, match skill keywords, and track your applications.

## Run it (Windows, macOS, Linux)

1. Install **Node.js 22.9 or newer** (Node.js 24 recommended).
2. Download this repository as a ZIP from GitHub's **Code → Download ZIP**, then extract it.
3. Open a terminal in the extracted folder and run:

   ```sh
   npm ci
   npm start
   ```
4. Open **http://localhost:3000**. Keep the terminal open while using it.

`npm ci` installs the PDF and DOCX readers. There is no database or account signup for local drafting. On Windows, you can double-click `START-WINDOWS.bat` after installing Node.js.

The first search reads live employer pages and can take one or two minutes. A slow provider can take longer. Results are cached in memory for 15 minutes; Refresh reads the cache until it expires. Restarting the process clears the cache. No refresh runs while the program is closed.

## What works without a key

- Discovers internship, co-op, and student URLs from Teck's public careers sitemap.
- Fetches employer pages, extracts job title, location, posting date, duration, start date and pay where present.
- Includes all student disciplines at this mining employer; use discipline filters to focus on technical roles.
- Canada is the default region; other regions are available when present in the feed.
- Shows source status, partial failures, and clearly labelled older cached results during outages.
- Autosaves applications, notes, eligibility checks, preparation tasks, follow-up dates and your profile to a local file. Export CSV for a spreadsheet or JSON for a restorable backup.
- Skill assessments show coverage of a fixed dictionary of skill keywords, matching/missing terms, and your self-reported eligibility checks. They do not estimate hiring probabilities.
- Links to Agnico Eagle's student portal as a separate directory entry.

## Dashboard, progress and job fit

The app opens on a graphical dashboard showing saved roles, applications, interviews, offers and next steps. In **My applications**, change stages, write notes, add a follow-up date, or add an external job link and its posting text. Open **Details** to check degree/enrolment, authorization, term and location requirements, and tick off preparation tasks. Follow-up dates are tracker notes, not automatic notifications.

Your edits autosave. Wait for **Saved to this computer** before closing. If disk saving fails, keep the tab open and download a backup. Conflicting edits from another tab are rejected rather than silently overwritten. Existing version 1 browser data migrates when the disk profile is empty. The profile is capped at 200 saved applications.

**Download backup** exports all progress as JSON. **Restore backup** validates and merges a version 2 backup: new applications and skills are added, existing application records are kept, and only empty profile fields are filled. CSV export is for viewing, not restoration. To move to another computer, restore the JSON backup there.

**When updating:** preserve the `data` folder, or download a JSON backup before replacing your app folder. You can choose another data directory with the `ORE_DATA_DIR` environment variable.

**About chances:** actual hiring probability is unknown. The displayed percentage is `matched recognized skill keywords / recognized skill keywords in the posting`, not chance of an offer. A fixed dictionary detects mentions, including optional skills, and can miss synonyms. The program cannot measure applicant competition, resume quality, interview performance or employer preferences. A “no” on any self-reported eligibility check flags the job regardless of keyword coverage. Degree and available-term profile fields are notes for those manual checks, not automatic qualification decisions.

## Resume and cover letters

1. Open **Resume & apply**, add your name, and upload a PDF, DOCX or TXT resume (maximum 2 MB, PDF up to 30 pages). Scanned PDFs need selectable text or a pasted text version.
2. Review extracted text and select **Save resume text** after corrections. The original document remains unchanged; upload a corrected document if needed.
3. Choose a discipline, country and optional location; select **Queue matching jobs**. This uses the discovered student roles, excludes senior titles, and skips previously saved IDs and duplicate URLs.
4. Select **Draft queued letters**, or **Prepare application** on a listing. Local drafting uses relevant resume passages; edit and review the result. A batch prepares at most 20 new letters and preserves existing letters.
5. Download the letter and open the employer portal. Complete its form and attach your resume. Update the status to Applied only after the employer confirms receipt.

Letters and queue settings autosave with your progress. Changing resume or job text invalidates a draft's review; changing your signature name also requires regenerating letters. JSON backups contain resume text and cover letters, but not the original uploaded document. Keep the `data/resumes` folder when updating, or upload the original again.

The optional **auto-prepare** switch searches every 15 minutes while this browser tab and server remain open, queues matching new jobs, and creates local drafts. It never submits applications. Background-tab throttling can delay a refresh. Existing letters, including stale ones, are preserved until you explicitly regenerate them.

### Optional AI drafting

Copy `.env.example` to `.env`. Set `OPENAI_API_KEY` and `OPENAI_MODEL` to a Responses API model available to your API account, then restart the server. Select AI drafting and the data-sharing checkbox. Requests send resume text, your signature name and job text to OpenAI, with `store: false`; API usage may be billed. ChatGPT's Gmail connection does not provide an API key to this local program. The API key stays on the server. Treat every generated letter as a draft and check its claims.

### Gmail and LinkedIn

Gmail connected in ChatGPT is separate from this local app. This version has no Gmail OAuth integration or employer-form submission adapter. No email-triggered auto-apply task is enabled. Paste alert text to extract direct LinkedIn job links, then add the full job description using **Add a job**. LinkedIn tracking links may need opening in Gmail first.

**Download ChatGPT handoff** exports resume text, selection criteria and queued applications for use in a ChatGPT session. It contains private information; upload it only where intended. Actual automated submission needs accessible mailbox tools, your resume and criteria, and a supported employer application flow with required answers. This app does not claim successful submission from a prepared draft or an opened link.

## Optional broader search: Adzuna

Get credentials at https://developer.adzuna.com/. Copy `.env.example` to `.env`, fill in `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`, then restart. Credentials remain on the server. Do not commit `.env`.

The adapter searches Canada's Adzuna endpoint for five mining/geology/geotechnical/metallurgy student queries, up to 50 records each. It excludes results without both student/internship and mining-related keywords, removes duplicate company/title/location combinations, and links through the provider. API usage is subject to your account's limits and terms.

## Coverage and privacy

This is a personal local application, not a complete index of every internship. Teck scans are capped at 60 student pages, with four concurrent requests. Page layouts and API availability can change. Unavailable fields say “See posting” or “Not specified”; deadlines are not inferred from posting dates. Read the employer's full page before applying.

The app reads public postings and accepts resume uploads to your local computer. It does not submit applications, send emails, or sign into employer accounts. Optional AI drafting sends resume text and the job description to OpenAI only when selected. Skills, notes, and saved application statuses are stored in `data/progress.json` on the computer running the app, with a browser recovery cache. Clearing browser storage does not erase successfully saved disk progress. They do not synchronize across devices. JSON and CSV exports contain your notes and URLs; store them privately. The data folder is excluded from Git, and static routes cannot serve it. This is a single-user app: anyone who can access your local server may access that profile.

The server binds to `127.0.0.1` by default. Do not expose it publicly without adding authentication, request limits, and durable shared caching. Optional auto-preparation refreshes every 15 minutes while the app is open; nothing runs after you close it. The app has no analytics or remote fonts.

## Blueprint mapping

Zinterno supplies the product blueprint: internship cards and detail views, company/skill filters, profile matching, and application links. ORE is a focused implementation of those patterns, with automatic discovery in place of manually populated MongoDB listings. The original login, admin and MongoDB components are not required for this single-user version. The upload also contained case-sensitive import mismatches; this implementation uses consistent module paths and starts on Linux, Windows, and macOS.

## Development

- `public/index.html`, `public/style.css`, `public/app.js`: responsive dashboard, application tracker, and fit details.
- `backend/jobs.js`: employer discovery, parser, optional Adzuna adapter, cache and filters.
- `backend/server.js`: local HTTP server, job search and progress APIs.
- `public/progress.js`: backup validation, merges, and transparent skill assessments.
- `backend/progress-store.js`: serialized atomic disk writes and revision conflict detection.
- `test/*.test.js`: 50 automated tests covering job parsing, persistence, PDF/DOCX/TXT extraction, cover-letter generation, queue filters, duplicate prevention, stale drafts, backup validation and HTTP boundaries.
- `backend/resume.js`, `backend/resume-worker.js`: bounded document extraction.
- `backend/letters.js`, `public/workflow.js`: cover letters and application preparation.

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

The 50 tests use real generated PDF/DOCX fixtures and mocked AI responses. They do not validate live AI output quality, Gmail delivery or employer submission, and they never send applications.
