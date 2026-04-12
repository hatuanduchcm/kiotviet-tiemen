/**
 * Ensure specified columns exist on each row (adds empty string when missing).
 * This is a small helper to make sure downstream filter/exports include optional columns like 'N11'.
 */
export function ensureColumns(rows: any[], cols: string[] = ['N11', 'Ghi chú Canvas']): any[] {
  return rows.map(r => {
    const out = { ...r };
    for (const c of cols) {
      if (out[c] == null) out[c] = '';
    }
    return out;
  });
}

export default ensureColumns;
