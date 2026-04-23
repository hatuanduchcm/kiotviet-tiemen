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

  // Parse header row with raw: false to get formatted text (headers are always strings).
  const rawHeaders = xlsx.utils.sheet_to_json<Array<unknown>>(sheet, {
    header: 1,
    defval: null,
    raw: false,
    dateNF: 'dd/mm/yyyy hh:mm:ss'
  });

  if (rawHeaders.length === 0) return { headers: [], rows: [] };

  const headerRow = (rawHeaders[0] as Array<unknown>).map((h) => (h == null ? '' : String(h)));

  // Build a mapping: header name → first column index (ignore duplicates after first).
  const firstIndexOf: Record<string, number> = {};
  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i] ?? '';
    if (h && !(h in firstIndexOf)) firstIndexOf[h] = i;
  }

  const headers = Object.keys(firstIndexOf);

  // Parse data rows with raw: true so numeric cells come back as numbers (no comma formatting).
  // Date cells (type 'd') are formatted explicitly below.
  const rawData = xlsx.utils.sheet_to_json<Array<unknown>>(sheet, {
    header: 1,
    defval: null,
    raw: true
  });

  const rows = (rawData.slice(1) as Array<Array<unknown>>).map((rowArr, rowOffset) => {
    const sheetRowIdx = rowOffset + 1; // 0-based index in sheet (row 0 = header)
    const out: Record<string, string | number | boolean | null> = {};
    for (const h of headers) {
      const idx = firstIndexOf[h]!;
      const v = rowArr[idx];
      if (v === null || v === undefined) {
        out[h] = null;
      } else if (typeof v === 'number') {
        // Check if this cell is a date by looking at its type/numFmt in the sheet object.
        const cellAddr = xlsx.utils.encode_cell({ r: sheetRowIdx, c: idx });
        const cell = sheet[cellAddr];
        const isDateCell =
          cell &&
          (cell.t === 'd' ||
            (cell.t === 'n' &&
              typeof cell.z === 'string' &&
              /[yYmMdDhHsS]/.test(cell.z) &&
              !/^0/.test(cell.z)));
        if (isDateCell) {
          // Convert serial to Date using xlsx utility (handles 1900/1904 date systems).
          const dateVal = xlsx.SSF ? xlsx.SSF.parse_date_code(v) : null;
          if (dateVal) {
            const pad = (n: number) => String(n).padStart(2, '0');
            out[h] = `${pad(dateVal.d)}/${pad(dateVal.m)}/${dateVal.y} ${pad(dateVal.H)}:${pad(dateVal.M)}:${pad(dateVal.S)}`;
          } else if (cell.t === 'd') {
            const d: Date = cell.v instanceof Date ? cell.v : new Date(cell.v);
            const pad = (n: number) => String(n).padStart(2, '0');
            out[h] = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          } else {
            out[h] = v;
          }
        } else {
          // Plain number — store as number, no comma formatting.
          out[h] = v;
        }
      } else if (typeof v === 'string' || typeof v === 'boolean') {
        if (typeof v === 'string') {
          // Only convert strings that look like thousand-separated integers (e.g. "18,700,000").
          // Pattern: optional leading digits, then groups of exactly 3 digits separated by comma.
          // This avoids stripping commas from real text values like "A, B".
          const isThousandSeparatedInt = /^\d{1,3}(,\d{3})+$/.test(v.trim());
          if (isThousandSeparatedInt) {
            out[h] = Number(v.replace(/,/g, ''));
          } else {
            out[h] = v;
          }
        } else {
          out[h] = v;
        }
      } else if (v instanceof Date) {
        const pad = (n: number) => String(n).padStart(2, '0');
        out[h] = `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()} ${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;
      } else {
        out[h] = String(v);
      }
    }
    return out;
  });

  return { headers, rows };
}
