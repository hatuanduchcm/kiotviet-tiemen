import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Page } from 'playwright';

export async function ensureStorageDir(): Promise<string> {
  const dir = path.resolve('.storage');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveScreenshot(page: Page, name: string): Promise<string> {
  const dir = await ensureStorageDir();
  const safe = name.replace(/[^a-zA-Z0-9_.-]+/g, '_');
  const outPath = path.join(dir, safe);
  await page.screenshot({ path: outPath, fullPage: true });
  return outPath;
}
