import type { Page } from 'playwright';

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
  await locator.click();
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
        await el.click();
        return;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Could not click any selector: ${selectors.join(', ')}. Last error: ${String(lastErr)}`);
}
