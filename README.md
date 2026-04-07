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

To debug headless runs with trace:
1) Set `TRACE=true` in `.env` (default trace path is `.storage/trace.zip`)
2) Run `npm run sync -- orders`
3) If you stop the process (Ctrl+C), Playwright will write the trace file.
	Also, when `TRACE=true`, this project saves an additional trace on each error to `.storage/*_orders_error.trace.zip`.
4) Open trace viewer:

```bash
npx playwright show-trace .storage/trace.zip
```

Or open an error trace:

```bash
npx playwright show-trace .storage/<timestamp>_orders_error.trace.zip
```

## Customize
- Orders page automation: `src/orders/ordersPage.ts`
- Polling + cache + export pipeline: `src/sync/ordersWatch.ts` and `src/cache/orderCache.ts`
- Login: `src/kiotviet/login.ts`

## Browser note
- This project uses Playwright's bundled **Chromium** only (no Firefox/WebKit usage in code).
- If you run native and want to download only Chromium: `npx playwright install chromium`
