# Short Game

A complete mobile-first par-3 practice app. Nine holes, three or four balls, immediate scoring, local draft recovery, round history, statistics, personal bests, offline installation, and optional private Google Sheets backup.

## Run

Requires Node.js 22 or newer (tested with 24.22.1).

```sh
cd /workspace/three
npm ci
npm start
```

The server listens on port 3000, or `$PORT`. For local development, open the local server in your browser. `npm run dev` restarts the server when files change. No runtime dependencies, database, external fonts, or paid API is required. Development dependencies are only for browser tests.

## Scoring

As confirmed during development, the maximum is **90**, rather than 72, for a four-ball round. Scoring strokes do not contribute challenge points.

| Ball | Result | Points |
| --- | --- | --- |
| Scoring | Actual strokes, including penalties | Tracked separately |
| Accuracy | Green in regulation: tee shot on green | 2 |
| Accuracy | Tee shot finishes within 15 feet of the pin | +1 |
| Up-and-down | Down in 2 from a practice drop off the green | 2 |
| Up-and-down | Down in 3 | 1 |
| Up-and-down | Down in 4+ | 0 |
| Pressure | Hole-in-one / birdie / par / bogey+ | 5 / 3 / 2 / 0 |

Three-ball mode keeps Scoring and skips a selectable challenge ball. The default skips Pressure (maximum **45**). Skipping Accuracy allows 63 points; skipping Up-and-down allows 72. The model also understands legacy capped scoring policies in backups; newly created rounds use the uncapped awards above.

Tap **+** to begin the scoring ball at par, then adjust. Tap a selected challenge result again to clear it. Unanswered and zero are distinct. All active fields on nine holes must be answered before finishing. View the scorecard at any time; an incomplete round remains a draft.

Statistics use completed rounds. GIR% uses Accuracy Ball attempts; up-and-down% means two-stroke successes, divided by played Up-and-down Ball attempts. Skipped balls are excluded. Average strokes uses the Scoring Ball. Trends show percent of the round maximum so different formats have a meaningful scale. Use format filters for like-for-like comparisons. Round detail compares challenge points against the preceding round with the same ball format and scoring policy.

## Data and recovery

Every input saves immediately to `localStorage`. Normal Safari/app restarts retain the draft on the same device and origin. Offline operation becomes available after one online visit and completion of service-worker caching. The home screen app and Safari may have different storage contexts depending on the iOS version; use JSON export/import or Sheets sync to transfer rounds if needed.

Browser data is not a permanent backup: clearing website data, private browsing, OS storage eviction, switching domains, or losing the phone can remove it. Settings includes JSON export/import. Import validates every round, merges by ID and newest update timestamp, and never replaces an existing draft. Export includes the active draft; **Sheets sync backs up completed rounds only**. Storage failures display an explicit warning.

Sheets sync is explicit: unlock it in Settings and tap **Sync completed rounds** after finishing. It both uploads local rounds and pulls cloud rounds. Repeated syncs merge by ID, and revisions append without destroying older spreadsheet records. There is no delete operation in the first version; cloud rows and completed history are retained. JSON backups are plain text and contain course names and scores; keep them private.

## Private Google Sheets setup

The public browser bundle contains **no** Google credentials, spreadsheet ID, private round data, or sync password. Only your Node server talks to Google. A shared private password protects your personal single-user backup; it is not a multi-user account system. Anyone with that password can read/upload the connected completed rounds. Use a unique password, do not share it, and deploy behind HTTPS.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project. Enable **Google Sheets API**.
2. Create a service account and a JSON key. Keep the downloaded key private; never commit it. Organization policies may prohibit keys; if so, arrange an approved credential method before live sync.
3. Create a private Google spreadsheet. Create a tab named **Rounds** (exact capitalization).
4. Add this header row, in columns A through F:

   ```text
   id | updated_at | date | course | points | round_json
   ```

   Put each header in its own cell. Do not use this six-column tab for unrelated data, formulas, sorting partial columns, or manual editing of `round_json`. Other tabs are fine. A malformed row deliberately stops sync to avoid silently losing records.
5. Share the spreadsheet with the service account's `client_email` as **Editor**. Do not enable public link access.
6. In your host's **secret environment variables**, configure:

   | Variable | Value |
   | --- | --- |
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The JSON key's `client_email` |
   | `GOOGLE_PRIVATE_KEY` | The complete JSON key's `private_key`, including BEGIN/END lines; actual newlines or literal `\n` both work |
   | `GOOGLE_SHEET_ID` | The ID between `/d/` and `/edit` in the spreadsheet URL |
   | `SYNC_PASSWORD` | Unique random password, at least 16 characters |
   | `SESSION_SECRET` | Separate random secret, at least 32 characters |
   | `NODE_ENV` | `production` on your deployed host |

   Generate suitable independent values locally with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Never paste the results into source code or chat. `.env.example` lists names only; `.env` is ignored. For trusted local testing, `node --env-file=.env server.js` loads a private local file. `npm start` expects the host to inject variables; it does not automatically read `.env`.
7. Restart the server, open Settings, enter `SYNC_PASSWORD`, and sync. The password is sent only to your own server and is not saved in browser storage. The server issues a signed HttpOnly, SameSite=Strict cookie, secure in production, valid for seven days. Lock it with **Lock connection**. Rotating `SESSION_SECRET` invalidates existing sessions.
8. Verify the round appears as a row in the private sheet, then open a second browser/device, unlock, and sync to confirm it downloads. This real-Google check requires your credentials; automated tests use a simulated Google service.

Google JWT signing, token exchange, and Sheets calls happen server-side. TLS verification remains enabled. Sheet writes use `RAW` so a course name starting with `=` is not evaluated as a spreadsheet formula. The service worker never caches API responses. Authentication failures do not delete local rounds. The server serializes sync operations within an instance; run a single instance for this small personal app. Append revisions can produce duplicate rows after an ambiguous network retry or between instances, but reads deduplicate by ID and update timestamp. Device clocks determine revision ordering.

For restricted networking, the server requires HTTPS access to `oauth2.googleapis.com` and `sheets.googleapis.com`. Repository/development setup also needs GitHub and `registry.npmjs.org`.

## Publish on Render (simple default)

A `render.yaml` blueprint is included for a single Node web service. The app has no runtime database or persistent server disk requirement. Check [Render's current pricing](https://render.com/pricing): a free service may sleep and has quotas, so initial page loads and Sheets sync can take longer after inactivity. A paid instance avoids sleep if needed. The installed offline app still supports local practice while the server is asleep.

1. Push these source files to your own private GitHub repository. This workspace was supplied as an empty `ma-xsimon/three` repository; no remote push or commit has been performed automatically.
2. In [Render](https://dashboard.render.com/), connect that repository and create a **Blueprint**, using `render.yaml`. Alternatively create a Node Web Service with:
   - Build: `npm ci --omit=dev --ignore-scripts`
   - Start: `npm start`
   - Node: `24.22.1`
   - Health check: `/api/status`
   - Environment: `NODE_ENV=production`
3. Deploy. Render supplies `PORT` and HTTPS. Test creating a draft, reloading, completing a round, and opening history. The app works immediately in local-only mode.
4. Add the private Google variables above to the Render environment settings, then redeploy/restart. Verify real sync using step 8 above.
5. Keep the hostname stable: browser storage is bound to it. Export or sync before switching domains. Never add secret values to `render.yaml` or public JavaScript.

No hosting account or Google credential was supplied during implementation, so no public deployment or live Google verification is claimed. An authenticated host connection is needed to perform publication on your behalf. The repository includes everything necessary to deploy through its dashboard.

## Other hosts / Docker

Any HTTPS Node host that supports environment secrets and a long-running Node service can run `npm start`. Bind the provider's supplied port. The included Dockerfile uses `node:24-alpine`, runs as a non-root user, and copies only server/public files. Build and run with your own secret injection:

```sh
docker build -t short-game .
docker run --rm -p 3000:3000 --env-file .env short-game
```

The image defaults to production cookies. For plain HTTP local Docker testing of login, add `-e NODE_ENV=development`; production deployments must keep HTTPS and production cookies. The Docker image is provided as an alternative and was not built in this environment. Pure static hosting supports the local app, but **does not** support the private Sheets API; deploy the Node server for full functionality.

## Add to iPhone Home Screen

1. Open the deployed **HTTPS** site in Safari, online.
2. Tap **Share** → **Add to Home Screen** (it may be under More). Keep **Open as Web App** enabled if offered, then tap Add.
3. Open **Short Game** from the home screen once while online. After caching, test opening it in airplane mode.
4. Play normally; each tap saves the draft. Reconnect before syncing. Export JSON regularly if you do not configure Sheets.

The app includes a web manifest, standalone mode, Apple touch icon, safe-area navigation, and an offline service worker. iOS can evict website data, so local storage alone cannot guarantee permanent retention. Current browser validation uses mobile Chromium; physical iPhone/Safari validation remains a deployment check.

## Tests

```sh
npm run check
npm test
# For browser tests, start the server in another terminal:
npm start
# Then (downloads browser only when needed):
npx playwright install chromium
npm run test:browser
# Or use an existing Chromium installation:
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

The test suite checks exact challenge awards, maximums, three-ball exclusion, completeness, statistics denominators, merge validation, HTTP asset access, password/cookie protection, cross-origin writes, and server-side Sheets JWT/read/write/error handling with simulated Google responses. The browser tests exercise a complete nine-hole round, reload recovery, history, statistics, offline access, and three-ball controls at iPhone dimensions. They require permission to start a local browser/server. No Google calls or credentials are needed for automated tests.

## Source map

- `public/index.html`, `style.css`, `app.js`: accessible responsive interface and state persistence.
- `public/model.js`: scoring, validation, completion, statistics, merge logic, shared with server.
- `server.js`: static server, private session authentication, server-side Sheets adapter.
- `public/sw.js`, manifest, icons: installability and offline shell.
- `test/`: model, HTTP, Google-adapter tests.
- `scripts/browser-smoke.cjs`: mobile functional checks.
- `render.yaml`, `Dockerfile`: deployment options.

No analytics, ads, or external tracking scripts are used. The optional Sheets service is the only external runtime data destination.
