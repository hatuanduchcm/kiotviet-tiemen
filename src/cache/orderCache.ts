import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type OrdersCache = {
  /**
   * Orders we have already seen (used to detect new orders across refresh loops).
   */
  seenOrderCodes: Record<string, true>;

  /**
   * Snapshot of the last list page scan (used to detect "no change" situations).
   */
  lastSnapshot: {
    orderCodesInList: string[];
    capturedAtIso: string;
  } | null;

  /**
   * Cutoff time derived from the newest "Thời gian" value we've processed.
   *
   * Note: KiotViet grid time is usually minute-level (dd/MM/yyyy HH:mm), so this value
   * should be treated as minute-level as well.
   */
  lastScanAtMs?: number;
  lastScanAtIso?: string;
};

const defaultCache: OrdersCache = {
  seenOrderCodes: {},
  lastSnapshot: null,
  lastScanAtMs: undefined,
  lastScanAtIso: undefined
};

/**
 * Load cache from `.state/orders-cache.json`.
 */
export async function loadOrdersCache(): Promise<{ cache: OrdersCache; cachePath: string }> {
  const cachePath = path.resolve('.state', 'orders-cache.json');
  await fs.mkdir(path.dirname(cachePath), { recursive: true });

  try {
    const raw = await fs.readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw) as OrdersCache;
    return {
      cache: {
        ...defaultCache,
        ...parsed,
        seenOrderCodes: parsed.seenOrderCodes ?? {},
        lastSnapshot: parsed.lastSnapshot ?? null,
        lastScanAtMs: typeof (parsed as any).lastScanAtMs === 'number' ? (parsed as any).lastScanAtMs : undefined,
        lastScanAtIso: typeof (parsed as any).lastScanAtIso === 'string' ? (parsed as any).lastScanAtIso : undefined
      },
      cachePath
    };
  } catch {
    return { cache: { ...defaultCache }, cachePath };
  }
}

/**
 * Persist cache to disk.
 */
export async function saveOrdersCache(cachePath: string, cache: OrdersCache) {
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}
