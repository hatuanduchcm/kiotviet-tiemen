# kiotviet-tiemen

Automation pipeline:
1) Open KiotViet web, login
2) Navigate to Orders page, apply filters
3) Detect new orders, export "File chi tiết" (xlsx)
4) Parse xlsx and print JSON (upload to Google Sheets can be added later)

## Setup

Prerequisites:
- Node.js LTS (recommended v20+ or v22+). Make sure `node` and `npm` are available in PATH.

```bash
npm i
npx playwright install chromium
```

Create `.env` from `.env.example` (do not commit real credentials).

### Google Sheets (optional)

If you want to upload to Google Sheets:
1) Create a Google Cloud project + enable **Google Sheets API**
2) Create a **Service Account** and download the JSON key file
3) Share your target Sheet with the service account email (Viewer/Editor)
4) Set `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_TAB_NAME`, `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` in `.env`

## Run

```bash
npm run sync
```

Watch Orders page (poll + export detail file when new orders appear):

```bash
npm run sync -- orders
```

## See the browser / debug

To see the browser window:
- Set `HEADLESS=false` (and optionally `SLOW_MO_MS=200`) in `.env`
- Run `npm run sync -- orders`



## Customize
- Orders page automation: `src/orders/ordersPage.ts`
- Polling + cache + export pipeline: `src/sync/ordersWatch.ts` and `src/cache/orderCache.ts`
- Login: `src/kiotviet/login.ts`

## GitHub Actions (develop/prod)

This repo includes a workflow that runs:
- `develop` → GitHub Environment: `develop`
- `main` → GitHub Environment: `prod`

It triggers in 2 ways:
1) Immediate run on merge/push to `develop` or `main`
2) Scheduled runs for `prod` during business hours

Workflow file: `.github/workflows/sync-orders.yml`

### Schedule (prod)
GitHub Actions is not designed to run a single job continuously for many hours.
Instead, we run the sync on a cron schedule.

- Prod schedule: every 10 minutes from 08:00 to 20:00 (Vietnam time, UTC+7)
- GitHub cron uses UTC, so the workflow uses 01:00–13:00 UTC

### 1) Create Environments
In your GitHub repo:
1) Settings → Environments
2) Create environments named exactly:
   - `develop`
   - `prod`

Optional: set required reviewers for `prod`.

### 2) Add Environment Secrets
Add these secrets to BOTH environments (with environment-specific values if needed):

- `KIOTVIET_BASE_URL` (example: `https://hatuanduc.kiotviet.vn`)
- `KIOTVIET_USERNAME`
- `KIOTVIET_PASSWORD`

- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_TAB_NAME`

- `GOOGLE_SERVICE_ACCOUNT_KEY_JSON`
  - Value: the full JSON content of your Google Service Account key.
  - The workflow writes it to `.secrets/kiotviet-service-account.json` during the run.

### 3) Add Environment Variables (optional)
You can configure these as Environment Variables (Settings → Environments → Variables):

- `ORDERS_URL`
- `ORDERS_TIME_PRESET` (default: `Hôm nay`)
- `ORDERS_POLL_INTERVAL_MS` (default: `10000`)
- `ORDERS_EXPORT_TIMEOUT_MS` (default: `120000`)
- `ORDERS_MAX_POLLS` (default: `1`)
- `ORDERS_DELETE_DOWNLOADED_AFTER_UPLOAD` (default: `true`)

Note: the script is a watcher by default; in GitHub Actions we set `ORDERS_MAX_POLLS=1` so the job finishes.

If you want a "run forever" process, run it on your own server/VM instead of Actions.

## Browser note
- This project uses Playwright's bundled **Chromium** only (no Firefox/WebKit usage in code).
- If you run native and want to download only Chromium: `npx playwright install chromium`
