# Short Game

A simple mobile-first par-3 practice app. Play nine holes with three or four balls, then see a complete round summary you can record in your own notes or spreadsheet. No account, Google connection, credentials, or database is needed. Scores stay on your device.

## Use the app

1. Start a practice round and enter the course name.
2. Choose four balls, or three balls (Pressure omitted by default).
3. Enter each ball's result on each hole. Every tap automatically saves your draft.
4. On hole nine, review and finish the round.
5. The results screen shows challenge points, total strokes, average strokes per hole, GIR%, up-and-down%, a point breakdown by ball, and the nine-hole scorecard. Tap **Copy round summary** to paste the stats into your own records, or take a screenshot. If clipboard access is unavailable, the app displays selectable summary text.

Completed rounds remain available under **Rounds**. **Progress** retains local statistics, trends, and personal bests. Existing drafts and rounds from the earlier version remain compatible; there is no data migration or reset.

## Scoring

| Ball | Result | Points |
| --- | --- | --- |
| Scoring | Actual strokes including penalties | Tracked separately |
| Accuracy | Green in regulation: tee shot on green | 2 |
| Accuracy | Tee shot within 15 feet of the pin | +1 |
| Up-and-down | Down in 2 / 3 / 4+ from off the green | 2 / 1 / 0 |
| Pressure | Ace / birdie / par / bogey or worse | 5 / 3 / 2 / 0 |

Four-ball maximum: **90** points, as confirmed during development. Three-ball mode always keeps Scoring and omits one challenge ball: Pressure omitted = 45 maximum; Accuracy omitted = 63; Up-and-down omitted = 72.

Tap **+** to start the scoring ball at par (3), then adjust. Tap a selected challenge result to clear it. Unanswered fields differ from zero-point results; all active balls on nine holes must be answered to finish. GIR% is based on the Accuracy Ball. Up-and-down% means two-stroke successes. Skipped challenges are excluded from statistics.

## Run locally

Requires Node.js 22+ (tested with 24.22.1).

```sh
npm ci
npm start
```

The server listens on port 3000, or the host's `PORT`. `npm run dev` restarts it when server files change. There are no runtime dependencies or external service calls. The Node server only serves the public files and a health check at `/api/status`; it never receives your scores.

## Deploy using the existing Render configuration

1. In [Render](https://dashboard.render.com/), choose **New → Blueprint** and connect [ma-xsimon/three](https://github.com/ma-xsimon/three).
2. Select the `main` branch and use the included `render.yaml`.
3. Review the hosting plan and deploy. No secrets need to be added.
4. Open the HTTPS address Render provides. Start a draft, reload, finish a round, and check the results.

If already deployed with automatic deploys enabled, pushing this update to `main` triggers a new deployment. Otherwise use **Manual Deploy → Deploy latest commit**. Old Google or sync environment variables can be removed from the Render dashboard; the app no longer reads them. The previous `/api/status` health-check URL remains supported so existing deployments keep working.

A free Render service may sleep; check [current pricing and limits](https://render.com/pricing). The cached app remains usable offline. The included Dockerfile is an alternative for hosts that run containers; build with `docker build -t short-game .` and run with `docker run --rm -p 3000:3000 short-game`. No environment file is needed.

All app files under `public/` can also be served directly by an HTTPS static host, without Node. Keep the files at the domain root. No build step or backend is needed for the app itself.

## Add to iPhone Home Screen

1. Open the deployed HTTPS site in Safari while online.
2. Tap **Share → Add to Home Screen → Add**. Keep **Open as Web App** enabled if offered.
3. Launch Short Game once while online so the offline files can cache.
4. Play normally. After finishing, copy your summary to Notes or your manual tracker.

The app includes a manifest, Apple touch icon, standalone mode, safe-area navigation, and offline caching. On an existing install, open online and close/reopen after the update to refresh cached files.

## Local saving and backup

Drafts and history use this browser's `localStorage`. Normal restarts retain them, and earlier saved data is preserved by this update. Clearing site data, private browsing, OS storage eviction, switching domains, or losing the phone can remove them. Safari and home-screen storage can differ by iOS version. Keep the hostname stable and record results manually as desired.

Settings retains **Export JSON backup** and **Restore a backup**. Export includes completed rounds and your active draft. Restore validates the backup, merges completed rounds by ID and newest revision, and restores a draft only if none is already active. These optional files provide a way to transfer or preserve your local data without connecting to a service.

## Tests

```sh
npm run check
npm test
# With npm start running in another terminal:
npx playwright install chromium
npm run test:browser
# Or use an installed Chromium:
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Tests cover scoring awards, maximums, three-ball exclusion, completeness, stats, backup validation, history ordering, serving files, and removal of authentication/data endpoints. Mobile browser checks cover a complete round and its summary, no API requests, reload/restart draft recovery, JSON restoration, offline use, and small-screen layouts. Physical iPhone/Safari validation remains a deployment check.

## Source

- `public/app.js`, `style.css`, `index.html`: interface, round summaries, and local persistence.
- `public/model.js`: scoring, statistics, validation, and backup merging.
- `public/sw.js`, manifest, icons: installation and offline use.
- `server.js`: small static-file server.
- `test/`, `scripts/`: unit, server, and mobile browser tests.
- `render.yaml`, `Dockerfile`: hosting configuration.

Google Sheets integration has been removed. Its previous implementation remains recoverable from Git history if requested later. No analytics, ads, trackers, or external runtime services are used.
