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
  const json = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const headers = json.length ? Object.keys(json[0] ?? {}) : [];

  const rows = json.map((row) => {
    const out: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) out[k] = null;
      else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
      else out[k] = String(v);
    }
    return out;
  });

  return { headers, rows };
}
