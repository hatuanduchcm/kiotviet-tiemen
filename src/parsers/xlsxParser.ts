import * as fs from 'node:fs/promises';
import * as xlsx from 'xlsx';

export type ParsedTable = {
  headers: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
};

export async function parseFirstSheetAsTable(filePath: string): Promise<ParsedTable> {
  const buf = await fs.readFile(filePath);
  const wb = xlsx.read(buf, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('XLSX has no sheets');

  const sheet = wb.Sheets[sheetName];

  // Parse as raw arrays to handle duplicate column names correctly.
  const raw = xlsx.utils.sheet_to_json<Array<unknown>>(sheet, {
    header: 1,
    defval: null,
    raw: false,
    dateNF: 'dd/mm/yyyy hh:mm:ss'
  });

  if (raw.length === 0) return { headers: [], rows: [] };

  const headerRow = (raw[0] as Array<unknown>).map((h) => (h == null ? '' : String(h)));

  // Build a mapping: header name → first column index (ignore duplicates after first).
  const firstIndexOf: Record<string, number> = {};
  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i] ?? '';
    if (h && !(h in firstIndexOf)) firstIndexOf[h] = i;
  }

  const headers = Object.keys(firstIndexOf);

  const rows = (raw.slice(1) as Array<Array<unknown>>).map((rowArr) => {
    const out: Record<string, string | number | boolean | null> = {};
    for (const h of headers) {
      const idx = firstIndexOf[h]!;
      const v = rowArr[idx];
      if (v === null || v === undefined) out[h] = null;
      else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[h] = v;
      else out[h] = String(v);
    }
    return out;
  });

  return { headers, rows };
}
