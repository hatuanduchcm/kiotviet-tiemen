import type { Page } from 'playwright';
import type { StepLogger } from '../utils/stepLogger.js';
import { loginKiotviet } from './login.js';

export async function isOnKiotvietLoginPage(page: Page) {
  const url = page.url();
  if (/#\/login/i.test(url)) return true;

  // Fallback: login form visible (sometimes URL isn't updated yet).
  const u = page.locator('#UserName, input#UserName, input[name="UserName"], input[autocomplete="username"]').first();
  if ((await u.count().catch(() => 0)) > 0 && (await u.isVisible().catch(() => false))) return true;

  return false;
}

/**
 * Ensure we have an authenticated KiotViet session.
 *
 * If the session expires and the SPA redirects to `#/login`, this re-logins and returns true.
 */
export async function ensureKiotvietSession(
  page: Page,
  opts: {
    baseUrl: string;
    username: string;
    password: string;
    reason: string;
    log?: StepLogger;
  }
) {
  if (!(await isOnKiotvietLoginPage(page))) return false;

  opts.log?.('session:relogin', { reason: opts.reason, url: page.url() });
  await loginKiotviet(page, {
    baseUrl: opts.baseUrl,
    username: opts.username,
    password: opts.password
  });
  opts.log?.('session:relogin:ok');
  return true;
}
