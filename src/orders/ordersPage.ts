import type { Page } from 'playwright';
import { clickAnyVisible, clickFirstMatching, waitForAnyVisible } from '../kiotviet/selectors.js';
import type { OrderListItem } from './types.js';

export type OrdersPageConfig = {
  ordersUrl: string;
  branchSelectMode: 'all';
  timePresetLabel: string; // e.g. 'Tuần này', 'Hôm nay', ...
};

async function waitGridIdle(page: Page) {
  await page.locator('.k-loading-mask').first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(150);
}

async function findVisibleColumnHeaderByExactText(page: Page, text: string) {
  const headers = page.locator('table[role="grid"], table[role="treegrid"]').locator('thead tr[role="row"] th[role="columnheader"]');
  const count = await headers.count();
  for (let i = 0; i < count; i++) {
    const h = headers.nth(i);
    if (!(await h.isVisible().catch(() => false))) continue;
    const t = (await h.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (t === text) return h;
  }
  return undefined;
}

/**
 * Ensure Orders grid is sorted by "Thời gian" descending.
 */
export async function ensureSortByTimeDesc(page: Page) {
  const header = await findVisibleColumnHeaderByExactText(page, 'Thời gian');
  if (!header) return;

  for (let i = 0; i < 2; i++) {
    const ariaSort = (await header.getAttribute('aria-sort').catch(() => null)) ?? '';
    if (ariaSort.toLowerCase() === 'descending') return;

    const link = header.locator('a.k-link').first();
    if ((await link.count().catch(() => 0)) > 0 && (await link.isVisible().catch(() => false))) {
      await link.click({ timeout: 10_000 }).catch(() => header.click({ timeout: 10_000 }));
    } else {
      await header.click({ timeout: 10_000 });
    }

    await waitGridIdle(page);
  }
}

function isPagerDisabledClass(cls: string | null) {
  if (!cls) return false;
  return cls.split(/\s+/).includes('k-state-disabled');
}

export async function gotoFirstOrdersPagerPage(page: Page) {
  const first = page.locator('a[title="Trang đầu"], a.k-pager-nav.k-pager-first').first();
  if ((await first.count().catch(() => 0)) === 0) return;
  if (!(await first.isVisible().catch(() => false))) return;

  const cls = await first.getAttribute('class').catch(() => null);
  const aria = await first.getAttribute('aria-disabled').catch(() => null);
  if (isPagerDisabledClass(cls) || aria === 'true') return;

  await first.click({ timeout: 10_000 }).catch(() => undefined);
  await waitGridIdle(page);
}

export async function gotoNextOrdersPagerPage(page: Page) {
  const next = page.locator('a[title="Trang sau"], a.k-pager-nav.k-pager-next').first();
  if ((await next.count().catch(() => 0)) === 0) return false;
  if (!(await next.isVisible().catch(() => false))) return false;

  const cls = await next.getAttribute('class').catch(() => null);
  const aria = await next.getAttribute('aria-disabled').catch(() => null);
  if (isPagerDisabledClass(cls) || aria === 'true') return false;

  await next.click({ timeout: 10_000 }).catch(() => undefined);
  await waitGridIdle(page);
  return true;
}

/**
 * Force the Orders grid to fetch latest data without a full page reload.
 *
 * KiotViet binds quick search input with `ng-enter="quickSearch(true)"`.
 * Pressing Enter after clearing input triggers a refresh.
 */
export async function refreshOrdersGrid(page: Page) {
  const search = page
    .locator('input[kv-filter-search]')
    .or(page.locator('input[placeholder="Theo mã phiếu đặt"]'))
    .first();

  await search.waitFor({ state: 'visible', timeout: 15_000 });
  await search.scrollIntoViewIfNeeded().catch(() => undefined);
  await search.click({ timeout: 5_000 });
  await search.press('Control+A').catch(() => undefined);
  await search.press('Backspace').catch(() => undefined);
  await search.press('Enter');

  // Best-effort wait for Kendo loading mask.
  const mask = page.locator('#grdOrders .k-loading-mask, .k-loading-mask').first();
  await mask.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => undefined);
  await mask.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(200);
}

async function waitUntilOnOrders(page: Page, timeoutMs: number) {
  await page.waitForURL(/#\/Orders/i, { timeout: timeoutMs });
}

async function tryNavigateToOrders(page: Page, ordersUrl: string) {
  // If we're already on Orders, don't force a reload.
  if (/#\/Orders/i.test(page.url())) return;

  // Attempt 1: hard navigation
  await page.goto(ordersUrl, { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(200);

  // Attempt 2: SPA hash navigation (often more reliable than full reload)
  if (!/#\/Orders/i.test(page.url())) {
    await page.evaluate(() => {
      (globalThis as any).location.hash = '#/Orders';
    });
    await page.waitForTimeout(200);
  }

  // Attempt 3: click top navigation
  if (!/#\/Orders/i.test(page.url())) {
    await clickFirstMatching(page, [
      'a:has-text("Đơn hàng")',
      'button:has-text("Đơn hàng")',
      'a[href*="#/Orders"]',
      'text=Đơn hàng'
    ]).catch(() => undefined);

    await page.waitForTimeout(250);
  }
}

/**
 * Navigate to Orders page.
 */
export async function gotoOrdersPage(page: Page, url: string) {
  // Fast path: if we're already on Orders, just ensure it is rendered.
  if (/#\/Orders/i.test(page.url())) {
    await waitForAnyVisible(page, ['text=Đặt hàng', 'table[role="treegrid"]', '[role="treegrid"]'], 30_000);
    return;
  }

  await tryNavigateToOrders(page, url);

  // Strict: we must be on Orders, otherwise let caller retry.
  await waitUntilOnOrders(page, 15_000).catch(() => {
    throw new Error(`Failed to navigate to Orders. Current URL: ${page.url()}`);
  });

  // Orders page is an SPA; give it a moment to render the filter sidebar & grid.
  await waitForAnyVisible(page, ['text=Đặt hàng', 'table[role="treegrid"]', '[role="treegrid"]'], 30_000);
}

/**
 * Select branch filter = "Tất cả".
 *
 * Notes:
 * - KiotViet uses custom multi-select components.
 * - This implementation uses robust "click-by-text" fallbacks.
 */
export async function selectBranchAll(page: Page) {
  // Try opening the branch dropdown.
  // Common patterns: click the filter label or the input container.
  await clickFirstMatching(page, [
    '#sortBranch',
    '.kv-multi-select#sortBranch',
    'text=Chi nhánh xử lý',
    'label:has-text("Chi nhánh")',
    '.kv-multi-select',
    '.kv-select'
  ]).catch(() => undefined);

  // Ensure dropdown list is visible, then choose "Tất cả".
  await waitForAnyVisible(page, ['text=Tất cả', 'li:has-text("Tất cả")'], 10_000);
  await clickAnyVisible(page, ['text=Tất cả', 'li:has-text("Tất cả")'], 10_000);

  // Click outside to close dropdown (best-effort).
  await page.keyboard.press('Escape').catch(() => undefined);
}

/**
 * Select a time preset from the quick-range popup (e.g. "Tuần này", "Hôm nay", ...).
 */
export async function selectTimePreset(page: Page, presetLabel: string) {
  // Important: there are multiple time sections (e.g. purchase date vs expected delivery).
  // KiotViet reuses IDs across sections, so we must scope to the *purchase* time filter.
  const picker = page.locator('#purchaseDatePicker').first();
  await picker.waitFor({ state: 'visible', timeout: 15_000 });

  const currentLabelLoc = picker.locator('li.reportsortDateTime aside.sortTime label.sortTimeLbl').first();
  const current = (await currentLabelLoc.innerText().catch(() => '')).trim();
  if (current && current.toLowerCase().includes(presetLabel.toLowerCase())) return;

  const openers = [
    // Primary: click the current label (e.g. "Tháng này") which opens the preset popover.
    currentLabelLoc,
    // Fallback: click the pretty radio/anchor inside the time row.
    picker.locator('li.reportsortDateTime a').first(),
    // Another fallback: click the whole time row.
    picker.locator('li.reportsortDateTime'),
    // Last: click the "Tùy chỉnh" row (might open a different picker, but sometimes triggers the same popover).
    picker.locator('li.reportsortOther')
  ];

  let popover = page.locator('.popover-filter').last();

  let opened = false;
  for (const opener of openers) {
    if ((await opener.count()) === 0) continue;
    const el = opener.first();
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.scrollIntoViewIfNeeded().catch(() => undefined);
    await el.click().catch(() => undefined);

    // Wait for a popover to appear (don't click too fast).
    popover = page.locator('.popover-filter').last();
    const becameVisible = await popover
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (becameVisible) {
      opened = true;
      break;
    }
  }

  if (!opened) {
    // Some builds render the preset list under a kendo animation container instead of bootstrap popover.
    const kendoPopup = page.locator('.k-animation-container:visible').last();
    if ((await kendoPopup.count().catch(() => 0)) === 0) {
      throw new Error('Could not open time preset picker popover.');
    }
    await kendoPopup
      .locator('a.kv-btn-chip')
      .filter({ hasText: presetLabel })
      .first()
      .click({ timeout: 10_000 });
  } else {
    await popover
      .locator('a.kv-btn-chip')
      .filter({ hasText: presetLabel })
      .first()
      .click({ timeout: 10_000 });
  }

  // Wait until the selected preset reflects on the left label.
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    const now = (await currentLabelLoc.innerText().catch(() => '')).trim();
    if (now && now.toLowerCase().includes(presetLabel.toLowerCase())) break;
    await page.waitForTimeout(100);
  }

  await page.keyboard.press('Escape').catch(() => undefined);

  // Wait for grid to refresh (best-effort): Kendo loading mask disappears.
  await page.locator('.k-loading-mask').first().waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

/**
 * Read order list items from the grid: order code + time.
 */
export async function readOrderList(page: Page): Promise<OrderListItem[]> {
  const rows = page.locator('table[role="treegrid"] tbody[role="rowgroup"] tr[role="row"]');

  // Grid may take time to populate; wait a bit for rows or an empty-state.
  const start = Date.now();
  while (Date.now() - start < 15_000) {
    const countNow = await rows.count();
    if (countNow > 0) break;
    const empty = page.locator('text=Không có dữ liệu').first();
    if ((await empty.count()) > 0 && (await empty.isVisible().catch(() => false))) break;
    await page.waitForTimeout(250);
  }

  const count = await rows.count();
  const items: OrderListItem[] = [];

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);

    // Order code cell: KiotViet grid can include hidden duplicate cells.
    const codeCells = row.locator('td.cell-code');
    const codeCellCount = await codeCells.count();
    let orderCode = '';
    for (let j = 0; j < codeCellCount; j++) {
      const cell = codeCells.nth(j);
      if (!(await cell.isVisible())) continue;
      const t = (await cell.innerText()).trim();
      if (!t) continue;
      orderCode = t;
      break;
    }

    const timeCells = row.locator('td.cell-date-time');
    const timeCellCount = await timeCells.count();
    let timeText = '';
    for (let j = 0; j < timeCellCount; j++) {
      const cell = timeCells.nth(j);
      if (!(await cell.isVisible())) continue;
      const t = (await cell.innerText()).trim();
      if (!t) continue;
      timeText = t;
      break;
    }

    if (orderCode) items.push({ orderCode, timeText });
  }

  return items;
}

/**
 * Select the checkbox for a given order code.
 */
export async function selectOrderByCode(page: Page, orderCode: string) {
  const rows = page.locator('table[role="treegrid"] tbody[role="rowgroup"] tr[role="row"]');

  // Prefer matching by visible text in the order code cell.
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = new RegExp(`^\\s*${escapeRegex(orderCode)}\\s*$`);

  const candidate1 = rows.filter({
    has: page.locator('td.cell-code', { hasText: exact })
  });

  const targetRow = (await candidate1.count()) > 0 ? candidate1.first() : rows.filter({ hasText: orderCode }).first();
  if ((await targetRow.count().catch(() => 0)) === 0) {
    throw new Error(`Order code not found in grid: ${orderCode}`);
  }

  await targetRow.scrollIntoViewIfNeeded().catch(() => undefined);

  const checkCell = targetRow.locator('td.cell-check').first();

  // KiotViet often renders a styled checkbox where the <input> can be hidden.
  // Prefer clicking the visible label/anchor inside the cell.
  const clickTargets = [
    // KiotViet prettycheckbox toggles via the inner <a> (the <input> is often display:none)
    'label.quickaction_chk a',
    'div.prettycheckbox a',
    'label.quickaction_chk'
  ];

  let clicked = false;
  for (const sel of clickTargets) {
    const loc = checkCell.locator(sel).first();
    if ((await loc.count()) === 0) continue;
    if (!(await loc.isVisible())) continue;
    await loc.click({ force: true });
    clicked = true;
    break;
  }
  if (!clicked) {
    // Last resort.
    await checkCell.click({ force: true });
  }

  // Verify checked (best-effort).
  const input = checkCell.locator('input[type="checkbox"]').first();
  if ((await input.count()) > 0) {
    // Some UIs keep input hidden but state updates.
    const checked = await input.isChecked().catch(() => false);
    if (!checked) {
      // Retry once.
      await checkCell.click();
    }
  }
}

/**
 * Export selected rows via "Xuất file" -> "File chi tiết".
 */
export async function exportSelectedOrdersDetail(page: Page) {
  // Open export menu.
  await clickAnyVisible(
    page,
    [
      'a.kv2BtnExport',
      'a[title="Xuất file"]',
      'button:has-text("Xuất file")',
      'a:has-text("Xuất file")'
    ],
    15_000
  );

  // Choose detail export.
  await clickAnyVisible(page, ['text=File chi tiết', 'li:has-text("File chi tiết")'], 15_000);

  // Some pages show a column selection popup that requires a confirm click.
  // Wait briefly for it, then click the confirm button if present.
  const confirm = page
    .locator('.k-window:visible button.kv-btn-confirm')
    .filter({ hasText: 'Xuất file' })
    .first();

  const confirmVisible = await confirm
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (confirmVisible) {
    await confirm.click({ timeout: 10_000 });
  }
}

/**
 * Clear any selected rows (uncheck) to avoid exporting duplicates on the next iteration.
 */
export async function clearSelectedOrders(page: Page) {
  const bodySelected = page.locator('body.table-item-checked');
  const headerToggle = page.locator('th.cell-check div.prettycheckbox a').first();

  const checkedAnchors = page.locator('td.cell-check div.prettycheckbox a.checked');
  const checkedInputs = page.locator('td.cell-check input[type="checkbox"]:checked');

  const hasSelection = async () => {
    const cls = (await bodySelected.count().catch(() => 0)) > 0;
    const a = (await checkedAnchors.count().catch(() => 0)) > 0;
    const i = (await checkedInputs.count().catch(() => 0)) > 0;
    return cls || a || i;
  };

  if (!(await hasSelection())) return;

  // Primary: clear via the "Đã chọn N ×" badge (when present).
  // This usually clears selection across pages.
  const selectedBadge = page.getByText(/Đã chọn\s*\d+/i).first();
  const badgeVisible = await selectedBadge
    .waitFor({ state: 'visible', timeout: 1_000 })
    .then(() => true)
    .catch(() => false);

  if (badgeVisible) {
    const clearBtn = selectedBadge
      .locator('xpath=..')
      .locator('text=×')
      .first()
      .or(selectedBadge.locator('xpath=..').locator('i.fa-times, i.fas.fa-times, .k-i-close'))
      .first();

    if ((await clearBtn.count().catch(() => 0)) > 0 && (await clearBtn.isVisible().catch(() => false))) {
      await clearBtn.click({ force: true, timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(300);
    }
  }

  // Fallback: click the header checkbox until selection is cleared.
  // Note: in indeterminate state, the first click can select-all; the second usually clears.
  for (let i = 0; i < 5; i++) {
    if (!(await hasSelection())) return;

    if ((await headerToggle.count().catch(() => 0)) > 0 && (await headerToggle.isVisible().catch(() => false))) {
      await headerToggle.click({ force: true, timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(250);
      continue;
    }

    // Fallback: press Escape to close any overlays and try again.
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(150);
  }

  // Verify: no checked anchors remain on current page.
  if ((await checkedAnchors.count().catch(() => 0)) > 0) {
    throw new Error('Failed to clear selected orders: checkbox still checked on the current page.');
  }
}

/**
 * Some KiotViet exports require an additional click on a toast/link
 * (e.g. "Nhấn vào đây để tải xuống") to start the actual browser download.
 */
export async function clickToastDownloadLinkIfPresent(page: Page) {
  const link = page
    .locator('text=Nhấn vào đây để tải xuống')
    .or(page.locator('a:has-text("Nhấn vào đây")'))
    .first();

  if ((await link.count()) === 0) return false;
  if (!(await link.isVisible().catch(() => false))) return false;
  await link.click().catch(() => undefined);
  return true;
}
