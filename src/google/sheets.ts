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

  // Use spreadsheets.get with includeGridData to get header row values AND column visibility.
  // values.get alone truncates trailing empty cells and has no visibility info.
  const metaResp = await sheets.spreadsheets.get({
    spreadsheetId: opts.sheetId,
    ranges: [`${opts.tabName}!1:5`],
    includeGridData: true,
    fields: 'sheets(data(columnMetadata(hiddenByUser),rowData(values(formattedValue))))'
  });

  type ColMeta = { hiddenByUser?: boolean };
  type GridCell = { formattedValue?: string };
  type GridRow = { values?: GridCell[] };

  const sheetGridData = metaResp.data.sheets?.[0]?.data?.[0];
  const colMeta: ColMeta[] = ((sheetGridData?.columnMetadata ?? []) as ColMeta[]).slice();
  const gridRows: GridRow[] = (sheetGridData?.rowData ?? []) as GridRow[];

  const isColHidden = (colIdx: number): boolean => colMeta[colIdx]?.hiddenByUser === true;

  // Find the header row among first 5 rows.
  let sheetHeaders: string[] = [];
  let headerFound = false;
  for (const gridRow of gridRows) {
    const rowVals = (gridRow.values ?? []).map((v) => String(v?.formattedValue ?? '').trim());
    if (opts.headers.length > 0 && opts.headers.every((h) => rowVals.includes(h))) {
      sheetHeaders = rowVals;
      headerFound = true;
      break;
    }
  }

  if (!headerFound) {
    const hasData = gridRows.some((row) =>
      (row.values ?? []).some((v) => String(v?.formattedValue ?? '').trim() !== '')
    );
    if (hasData) {
      throw new Error(
        `appendTableToSheet: sheet "${opts.tabName}" has existing data but expected header columns (${opts.headers.slice(0, 3).join(', ')}...) were not found in the first 5 rows. Refusing to append to avoid data corruption.`
      );
    }
    // Sheet is empty — safe to write headers to A1.
    await sheets.spreadsheets.values.update({
      spreadsheetId: opts.sheetId,
      range: `${opts.tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [opts.headers] }
    });
    sheetHeaders = opts.headers;
    // Columns just written are all visible — pad colMeta if needed.
    while (colMeta.length < sheetHeaders.length) colMeta.push({});
  }

  // Build headersIndex: two-pass — prefer visible columns; fall back to hidden if no visible found.
  const headersIndex: Record<string, number> = {};
  // Pass 1: visible columns only.
  for (let i = 0; i < sheetHeaders.length; i++) {
    const h = sheetHeaders[i] ?? '';
    if (h && !isColHidden(i) && !(h in headersIndex)) headersIndex[h] = i;
  }
  // Pass 2: hidden columns as fallback (only if name not already mapped by a visible column).
  for (let i = 0; i < sheetHeaders.length; i++) {
    const h = sheetHeaders[i] ?? '';
    if (h && isColHidden(i) && !(h in headersIndex)) headersIndex[h] = i;
  }

  const toAppend: Array<Array<Cell>> = [];
  for (const r of opts.rows) {
    const rowOut: Array<Cell> = new Array(sheetHeaders.length).fill('');
    for (const [h, v] of Object.entries(r)) {
      const idx = headersIndex[h];
      if (idx === undefined) continue;
      rowOut[idx] = v === null || v === undefined ? '' : (v as Cell);
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

  // Scan first 5 rows to find the header row containing orderHeader.
  let headerRow: string[] = [];
  let headerRowNum = 1; // 1-based
  try {
    const scanResp = await sheets.spreadsheets.values.get({
      spreadsheetId: opts.sheetId,
      range: `${opts.tabName}!A1:ZZ5`
    });
    const scanRows = (scanResp.data.values ?? []) as Array<Array<unknown>>;
    for (let i = 0; i < scanRows.length; i++) {
      const row = scanRows[i].map((x) => String(x ?? '').trim());
      if (row.includes(orderHeader)) {
        headerRow = row;
        headerRowNum = i + 1;
        break;
      }
    }
  } catch {
    // If the tab doesn't exist yet, treat as empty.
    await ensureSheetTabExists(sheets, opts.sheetId, opts.tabName).catch(() => undefined);
    return new Set<string>();
  }

  const idx = headerRow.findIndex((h) => h === orderHeader);
  if (idx < 0) return new Set<string>();

  const col = colIndexToA1(idx);
  const dataStartRow = headerRowNum + 1;
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: opts.sheetId,
    range: `${opts.tabName}!${col}${dataStartRow}:${col}`
  });

  const values = (resp.data.values ?? []) as Array<Array<unknown>>;
  const out = new Set<string>();
  for (const row of values) {
    const code = normalizeKeyPart(row?.[0]);
    if (code) out.add(code);
  }
  return out;
}
