import type { Page, ConsoleMessage, Request, Response } from 'playwright';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ensureStorageDir } from './artifacts.js';

export type PageDiagnostics = {
  dump: (name: string) => Promise<{ jsonPath: string; htmlPath?: string } | undefined>;
};

type DiagEvent =
  | {
      ts: string;
      kind: 'console';
      type: string;
      text: string;
      location?: ReturnType<ConsoleMessage['location']>;
    }
  | {
      ts: string;
      kind: 'pageerror';
      message: string;
      stack?: string;
    }
  | {
      ts: string;
      kind: 'requestfailed';
      url: string;
      method: string;
      resourceType: string;
      failure?: string;
    }
  | {
      ts: string;
      kind: 'badresponse';
      url: string;
      status: number;
      statusText: string;
      method: string;
      resourceType: string;
    };

function isoNow() {
  return new Date().toISOString();
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]+/g, '_');
}

function reqMeta(req: Request) {
  return {
    url: req.url(),
    method: req.method(),
    resourceType: req.resourceType()
  };
}

export function attachPageDiagnostics(page: Page, opts?: { maxEvents?: number }): PageDiagnostics {
  const maxEvents = opts?.maxEvents ?? 200;
  const events: DiagEvent[] = [];

  const push = (e: DiagEvent) => {
    events.push(e);
    if (events.length > maxEvents) events.splice(0, events.length - maxEvents);
  };

  page.on('console', (msg) => {
    // Avoid serializing msg.args() to prevent huge handles.
    push({
      ts: isoNow(),
      kind: 'console',
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  page.on('pageerror', (err) => {
    push({ ts: isoNow(), kind: 'pageerror', message: String(err), stack: (err as any)?.stack });
  });

  page.on('requestfailed', (req) => {
    const meta = reqMeta(req);
    push({
      ts: isoNow(),
      kind: 'requestfailed',
      ...meta,
      failure: req.failure()?.errorText
    });
  });

  page.on('response', (resp: Response) => {
    const status = resp.status();
    if (status < 400) return;

    const req = resp.request();
    const meta = reqMeta(req);
    push({
      ts: isoNow(),
      kind: 'badresponse',
      ...meta,
      status,
      statusText: resp.statusText()
    });
  });

  return {
    async dump(name: string) {
      try {
        const dir = await ensureStorageDir();
        const base = safeName(name);
        const jsonPath = path.join(dir, `${base}_page_diagnostics.json`);

        const snapshot = {
          capturedAtIso: isoNow(),
          url: page.url(),
          title: await page.title().catch(() => undefined),
          events
        };

        await fs.writeFile(jsonPath, JSON.stringify(snapshot, null, 2), 'utf8');

        // HTML is optional; it can be big, but is extremely useful for "stuck spinner" cases.
        const htmlPath = path.join(dir, `${base}_page.html`);
        const html = await page.content().catch(() => undefined);
        if (html) {
          await fs.writeFile(htmlPath, html, 'utf8');
          return { jsonPath, htmlPath };
        }

        return { jsonPath };
      } catch {
        return undefined;
      }
    }
  };
}
