import { google } from 'googleapis';
import * as path from 'node:path';

type Cell = string | number | boolean;

function normalizeKeyPart(v: unknown) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function colIndexToA1(idx: number): string {
  let n = idx + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
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

  // Use spreadsheets.get with includeGridData to read header values at their ACTUAL column indices.
  // values.get skips hidden columns and returns a compressed array, causing index misalignment.
  const metaResp = await sheets.spreadsheets.get({
    spreadsheetId: opts.sheetId,
    ranges: [`${opts.tabName}!1:5`],
    includeGridData: true
  });

  type GridCell = { formattedValue?: string | null };
  type GridRow = { values?: GridCell[] };

  const allRowData = ((metaResp.data.sheets?.[0]?.data?.[0]?.rowData ?? []) as GridRow[]);

  // headerColMap: header name → actual column index (0 = col A), including hidden columns.
  // formattedValue is returned for ALL cells regardless of column visibility.
  let headerColMap: Record<string, number> = {};
  let headerFound = false;

  for (const rowData of allRowData) {
    const cells = rowData.values ?? [];
    const tempMap: Record<string, number> = {};
    for (let ci = 0; ci < cells.length; ci++) {
      const val = String(cells[ci]?.formattedValue ?? '').trim();
      if (val && !(val in tempMap)) tempMap[val] = ci;
    }
    if (opts.headers.length > 0 && opts.headers.every((h) => h in tempMap)) {
      headerColMap = tempMap;
      headerFound = true;
      break;
    }
  }

  if (!headerFound) {
    const hasData = allRowData.some((row) => (row.values ?? []).some((v) => v?.formattedValue));
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
    for (let i = 0; i < opts.headers.length; i++) {
      headerColMap[opts.headers[i]!] = i;
    }
  }

  // Total row array length = max column index + 1
  const totalCols = Math.max(...Object.values(headerColMap)) + 1;

  const toAppend: Array<Array<Cell>> = [];
  for (const r of opts.rows) {
    const rowOut: Array<Cell> = new Array(totalCols).fill('');
    for (const [h, v] of Object.entries(r)) {
      const idx = headerColMap[h];
      if (idx === undefined) continue;
      rowOut[idx] = v === null || v === undefined ? '' : (v as Cell);
    }
    toAppend.push(rowOut);
  }

  if (toAppend.length === 0) return { appended: 0 };

  // Use values.update with an explicit row range instead of values.append.
  // values.append with INSERT_ROWS skips hidden columns causing data misalignment.
  // We find the last used row via a reliable non-hidden column (first header col that is not col A),
  // then write rows starting at the next empty row.
  const reliableColIdx = Object.values(headerColMap).find((i) => i > 0) ?? 1;
  const reliableColLetter = colIndexToA1(reliableColIdx);
  const lastRowResp = await sheets.spreadsheets.values.get({
    spreadsheetId: opts.sheetId,
    range: `${opts.tabName}!${reliableColLetter}:${reliableColLetter}`,
    majorDimension: 'COLUMNS'
  });
  const filledCount = lastRowResp.data.values?.[0]?.length ?? 0;
  const startRow = filledCount + 1; // 1-indexed next empty row

  const lastColLetter = colIndexToA1(totalCols - 1);
  const endRow = startRow + toAppend.length - 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: opts.sheetId,
    range: `${opts.tabName}!A${startRow}:${lastColLetter}${endRow}`,
    valueInputOption: 'RAW',
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
