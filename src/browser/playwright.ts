import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { loadConfig } from '../config.js';

export type BrowserBundle = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  downloadsDir: string;
};

export async function withBrowser<T>(fn: (b: BrowserBundle) => Promise<T>): Promise<T> {
  const cfg = loadConfig();
  const downloadsDir = path.resolve('downloads');
  const storageDir = path.resolve('.storage');

  // Trace is optional at runtime (config may be edited/partially loaded).
  const traceCfg = (cfg as any)?.browser?.trace as { enabled?: boolean; path?: string } | undefined;
  const tracingEnabled = !!traceCfg?.enabled;
  const traceOutPath = path.resolve(traceCfg?.path || '.storage/trace.zip');
  const traceOutDir = path.dirname(traceOutPath);

  await fs.mkdir(downloadsDir, { recursive: true });
  await fs.mkdir(storageDir, { recursive: true });
  if (tracingEnabled) {
    await fs.mkdir(traceOutDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: cfg.browser.headless,
    slowMo: cfg.browser.slowMoMs
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 }
  });

  context.setDefaultTimeout(cfg.browser.timeoutMs);
  context.setDefaultNavigationTimeout(cfg.browser.timeoutMs);

  const page = await context.newPage();

  if (tracingEnabled) {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }

  try {
    return await fn({ browser, context, page, downloadsDir });
  } finally {
    if (tracingEnabled) {
      await context.tracing.stop({ path: traceOutPath }).catch(() => undefined);
    }
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
