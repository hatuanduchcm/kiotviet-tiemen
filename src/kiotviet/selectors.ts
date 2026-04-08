import type { Page } from 'playwright';

export async function dismissOverlays(page: Page, timeoutMs = 1_500) {
  // Best-effort: many KiotViet pages show transient modals/popups that block clicks.
  await page.keyboard.press('Escape').catch(() => undefined);

  // Some marketing popups have a "don't show again" option.
  const dontShowAgain = page.locator('label:has-text("Không hiển thị lần sau"), text=Không hiển thị lần sau').first();
  if ((await dontShowAgain.count().catch(() => 0)) > 0 && (await dontShowAgain.isVisible().catch(() => false))) {
    await dontShowAgain.click({ timeout: Math.min(1_000, timeoutMs) }).catch(() => undefined);
  }

  // Try common close buttons across Vodal/Kendo/Bootstrap-ish dialogs.
  const closeButtons = page.locator(
    [
      // Vodal
      '.vodal-dialog:visible .vodal-close',
      '.vodal-dialog:visible button[aria-label="Close"]',
      '.vodal-dialog:visible button:has-text("×")',
      '.vodal-dialog:visible button:has-text("x")',
      '.vodal-dialog:visible [role="button"]:has-text("×")',
      // Kendo window
      '.k-window:visible .k-window-actions a',
      '.k-window:visible .k-window-actions .k-i-close',
      '.k-window:visible button[aria-label="Close"]',
      // Generic
      'button:visible:has-text("Đóng")',
      'button:visible:has-text("Close")'
    ].join(',')
  );

  const closeCount = await closeButtons.count().catch(() => 0);
  if (closeCount > 0) {
    await closeButtons.first().click({ force: true, timeout: Math.min(1_500, timeoutMs) }).catch(() => undefined);
  }

  // Wait for common overlay masks to go away.
  const masks = page.locator('.vodal-mask, .v-modal-mask, .k-overlay');
  await masks.first().waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => undefined);
}

async function firstVisibleLocator(page: Page, selector: string) {
  const locator = page.locator(selector);
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    const el = locator.nth(i);
    if (!(await el.isVisible())) continue;
    if (!(await el.isEnabled())) continue;
    return el;
  }
  return undefined;
}

export async function waitForAnyVisible(page: Page, selectors: string[], timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sel of selectors) {
      const el = await firstVisibleLocator(page, sel);
      if (el) return { selector: sel, locator: el };
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for any visible selector: ${selectors.join(', ')}`);
}

export async function fillAnyVisible(page: Page, selectors: string[], value: string, timeoutMs: number) {
  const { locator } = await waitForAnyVisible(page, selectors, timeoutMs);
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await locator.fill(value);
}

export async function clickAnyVisible(page: Page, selectors: string[], timeoutMs: number) {
  const { locator } = await waitForAnyVisible(page, selectors, timeoutMs);
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    await dismissOverlays(page).catch(() => undefined);
    try {
      await locator.click({ timeout: Math.min(10_000, timeoutMs) });
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function fillFirstMatching(page: Page, selectors: string[], value: string) {
  let lastErr: unknown;
  for (const sel of selectors) {
    try {
      const locator = page.locator(sel);
      const count = await locator.count();
      if (count === 0) continue;

      for (let i = 0; i < count; i++) {
        const el = locator.nth(i);
        if (!(await el.isVisible())) continue;
        if (!(await el.isEnabled())) continue;
        await el.scrollIntoViewIfNeeded().catch(() => undefined);
        await el.fill(value);
        return;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Could not fill any selector: ${selectors.join(', ')}. Last error: ${String(lastErr)}`);
}

export async function clickFirstMatching(page: Page, selectors: string[]) {
  let lastErr: unknown;
  for (const sel of selectors) {
    try {
      const locator = page.locator(sel);
      const count = await locator.count();
      if (count === 0) continue;

      for (let i = 0; i < count; i++) {
        const el = locator.nth(i);
        if (!(await el.isVisible())) continue;
        if (!(await el.isEnabled())) continue;
        await el.scrollIntoViewIfNeeded().catch(() => undefined);
        await dismissOverlays(page).catch(() => undefined);
        await el.click();
        return;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Could not click any selector: ${selectors.join(', ')}. Last error: ${String(lastErr)}`);
}
