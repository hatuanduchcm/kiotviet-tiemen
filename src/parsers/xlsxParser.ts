import * as fs from 'node:fs/promises';
import * as xlsx from 'xlsx';

export type ParsedTable = {
  headers: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
};

export async function parseFirstSheetAsTable(filePath: string): Promise<ParsedTable> {
  const buf = await fs.readFile(filePath);
  const wb = xlsx.read(buf, { type: 'buffer', cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('XLSX has no sheets');

  const sheet = wb.Sheets[sheetName];
  const rangeStr = sheet['!ref'];
  if (!rangeStr) return { headers: [], rows: [] };

  const range = xlsx.utils.decode_range(rangeStr);
  const numRows = range.e.r - range.s.r + 1;
  const numCols = range.e.c - range.s.c + 1;

  // Read header row directly by cell address — guarantees left-to-right column order.
  const headerRow: string[] = [];
  for (let ci = 0; ci < numCols; ci++) {
    const addr = xlsx.utils.encode_cell({ r: range.s.r, c: range.s.c + ci });
    const cell = sheet[addr];
    const val = cell ? xlsx.utils.format_cell(cell) : '';
    headerRow.push(String(val ?? '').trim());
  }

  // Map header name → FIRST column index (ignore duplicates after first).
  const firstIndexOf: Record<string, number> = {};
  for (let ci = 0; ci < headerRow.length; ci++) {
    const h = headerRow[ci]!;
    if (h && !(h in firstIndexOf)) firstIndexOf[h] = ci;
  }
  const headers = Object.keys(firstIndexOf);

  // Read data rows by cell address — same column index mapping as header.
  const rows: Array<Record<string, string | number | boolean | null>> = [];
  for (let ri = 1; ri < numRows; ri++) {
    const out: Record<string, string | number | boolean | null> = {};
    for (const h of headers) {
      const ci = firstIndexOf[h]!;
      const addr = xlsx.utils.encode_cell({ r: range.s.r + ri, c: range.s.c + ci });
      const cell = sheet[addr];
      if (!cell || cell.v == null) {
        out[h] = null;
      } else if (cell.t === 'd') {
        // Date cell — format as dd/mm/yyyy hh:mm:ss
        const d: Date = cell.v instanceof Date ? cell.v : new Date(cell.v);
        const pad = (n: number) => String(n).padStart(2, '0');
        out[h] = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      } else if (cell.t === 'n') {
        // Check if it's a date serial by looking at the numFmt
        const numFmt: string = (cell as any).numFmt ?? (wb.SSF ? wb.SSF[(cell as any).z] : '') ?? '';
        const isDateFmt = /[ymdh]/i.test(numFmt) && !/^0/.test(numFmt);
        if (isDateFmt) {
          const formatted = xlsx.utils.format_cell(cell);
          out[h] = String(formatted ?? '');
        } else {
          out[h] = cell.v as number;
        }
      } else if (cell.t === 'b') {
        out[h] = cell.v as boolean;
      } else {
        out[h] = String(cell.v);
      }
    }
    rows.push(out);
  }

  return { headers, rows };
}
