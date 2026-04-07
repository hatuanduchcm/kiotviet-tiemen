import { google } from 'googleapis';
import * as path from 'node:path';

type Cell = string | number | boolean;

function normalizeKeyPart(v: unknown) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

async function ensureSheetTabExists(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string, tabName: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = (meta.data.sheets ?? []).some((s) => s.properties?.title === tabName);
  if (existing) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }]
    }
  });
}

export async function writeTableToSheet(opts: {
  sheetId: string;
  tabName: string;
  serviceAccountKeyFile: string;
  headers: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
}) {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(process.cwd(), opts.serviceAccountKeyFile),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  await ensureSheetTabExists(sheets, opts.sheetId, opts.tabName);

  const values: Array<Array<Cell>> = [];
  values.push(opts.headers);

  for (const row of opts.rows) {
    values.push(
      opts.headers.map((h) => {
        const v = row[h];
        if (v === null || v === undefined) return '';
        return v;
      })
    );
  }

  // Legacy behavior: replace the whole tab.
  // Keep it for debugging, but avoid clearing beyond A:Z.
  await sheets.spreadsheets.values.update({
    spreadsheetId: opts.sheetId,
    range: `${opts.tabName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values }
  });
}

/**
 * Append rows to a sheet tab.
 *
 * - Ensures the tab exists.
 * - Ensures row 1 contains headers (writes them if sheet is empty).
 * - Appends provided rows (no dedup).
 */
export async function appendTableToSheet(opts: {
  sheetId: string;
  tabName: string;
  serviceAccountKeyFile: string;
  headers: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
}) {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(process.cwd(), opts.serviceAccountKeyFile),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  await ensureSheetTabExists(sheets, opts.sheetId, opts.tabName);

  // Read current headers.
  const headerResp = await sheets.spreadsheets.values.get({
    spreadsheetId: opts.sheetId,
    range: `${opts.tabName}!1:1`
  });

  const currentHeaders = ((headerResp.data.values?.[0] ?? []) as Array<unknown>)
    .map((x) => String(x ?? '').trim())
    .filter((x) => x !== '');

  if (currentHeaders.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: opts.sheetId,
      range: `${opts.tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [opts.headers] }
    });
  }

  // Re-read sheet headers after potential initialization.
  const headerResp2 = await sheets.spreadsheets.values.get({
    spreadsheetId: opts.sheetId,
    range: `${opts.tabName}!1:1`
  });
  const sheetHeaders = ((headerResp2.data.values?.[0] ?? []) as Array<unknown>).map((x) => String(x ?? ''));

  const headersIndex: Record<string, number> = {};
  for (let i = 0; i < sheetHeaders.length; i++) headersIndex[sheetHeaders[i] ?? ''] = i;

  const toAppend: Array<Array<Cell>> = [];
  for (const r of opts.rows) {
    const rowOut: Array<Cell> = new Array(sheetHeaders.length).fill('');
    for (const [h, v] of Object.entries(r)) {
      const idx = headersIndex[h];
      if (idx === undefined) continue;
      if (v === null || v === undefined) rowOut[idx] = '';
      else rowOut[idx] = v as Cell;
    }
    toAppend.push(rowOut);
  }

  if (toAppend.length === 0) return { appended: 0 };

  await sheets.spreadsheets.values.append({
    spreadsheetId: opts.sheetId,
    range: `${opts.tabName}!A:ZZ`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: toAppend }
  });

  return { appended: toAppend.length };
}

export async function readExistingOrderCodesFromSheet(opts: {
  sheetId: string;
  tabName: string;
  serviceAccountKeyFile: string;
  orderCodeHeader?: string;
}) {
  const orderHeader = opts.orderCodeHeader ?? 'Mã đặt hàng';

  const colIndexToA1 = (idx: number) => {
    // 0 -> A, 25 -> Z, 26 -> AA ...
    let n = idx + 1;
    let out = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  };

  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(process.cwd(), opts.serviceAccountKeyFile),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Read header row to locate the order-code column.
  let headerRow: string[] = [];
  try {
    const headerResp = await sheets.spreadsheets.values.get({
      spreadsheetId: opts.sheetId,
      range: `${opts.tabName}!1:1`
    });
    headerRow = ((headerResp.data.values?.[0] ?? []) as Array<unknown>).map((x) => String(x ?? '').trim());
  } catch {
    // If the tab doesn't exist yet, treat as empty.
    await ensureSheetTabExists(sheets, opts.sheetId, opts.tabName).catch(() => undefined);
    return new Set<string>();
  }

  const idx = headerRow.findIndex((h) => h === orderHeader);
  if (idx < 0) return new Set<string>();

  const col = colIndexToA1(idx);
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: opts.sheetId,
    range: `${opts.tabName}!${col}2:${col}`
  });

  const values = (resp.data.values ?? []) as Array<Array<unknown>>;
  const out = new Set<string>();
  for (const row of values) {
    const code = normalizeKeyPart(row?.[0]);
    if (code) out.add(code);
  }
  return out;
}
