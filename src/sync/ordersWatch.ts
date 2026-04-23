import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { format } from 'date-fns';

import { withBrowser } from '../browser/playwright.js';
import { loadConfig } from '../config.js';
import { loginKiotviet } from '../kiotviet/login.js';
import { ensureKiotvietSession } from '../kiotviet/session.js';
import { loadOrdersCache, saveOrdersCache } from '../cache/orderCache.js';
import { parseFirstSheetAsTable } from '../parsers/xlsxParser.js';
import { sleep } from '../utils/sleep.js';
import { createStepLogger } from '../utils/stepLogger.js';
import { withRetries } from '../utils/retry.js';
import { saveScreenshot } from '../utils/artifacts.js';
import { isoVietnam, parseVietnamUiDateTimeToMs, stamp } from '../utils/time.js';
import { attachPageDiagnostics } from '../utils/pageDiagnostics.js';
import { appendTableToSheet, readExistingOrderCodesFromSheet } from '../google/sheets.js';
import {
  clickToastDownloadLinkIfPresent,
  clearSelectedOrders,
  ensureSortByTimeDesc,
  exportSelectedOrdersDetail,
  gotoOrdersPage,
  gotoFirstOrdersPagerPage,
  gotoNextOrdersPagerPage,
  refreshOrdersGrid,
  readOrderList,
  selectBranchAll,
  selectOrderByCode,
  selectTimePreset
} from '../orders/ordersPage.js';

// Import các rule sử dụng ES module cho đồng bộ
import { filterColumnsKiotViet, COLUMNS_TO_KEEP } from '../rules/filter-columns-kiotviet.js';
import { splitBoSuitToJacketPants } from '../rules/split-bosuit-to-jacket-pants.js';
import { mergeCanvasToJacketManto } from '../rules/merge-canvas-to-jacket-manto.js';
import { explodeProductsByQuantity } from '../rules/explode-products-by-quantity.js';
import { applyCanvasTierRules } from '../rules/canvas-tier-rules.js';
import { applyN11Rule } from '../rules/n11-rule.js';
import { recomputePrices } from '../rules/recompute-prices.js';

/**
 * Watch the Orders page and export detail file when new orders appear.
 *
 * Behavior:
 * - Apply filters: branch=all, time preset (configurable)
 * - Read list of orders (code + time)
 * - If no change since last scan => wait and rescan
 * - If new order codes exist (not in cache) => select them, export detail xlsx, parse and print JSON
 */
export async function runOrdersWatch() {
  const cfg = loadConfig();
  const { cache, cachePath } = await loadOrdersCache();
  const log = createStepLogger('orders');

  await withBrowser(async ({ page, downloadsDir, context }) => {
    const diag = attachPageDiagnostics(page);

    log('login:start');
    await loginKiotviet(page, {
      baseUrl: cfg.kiotviet.baseUrl,
      username: cfg.kiotviet.username,
      password: cfg.kiotviet.password
    });
    log('login:ok');

    const ordersUrl = cfg.orders?.ordersUrl || new URL('/man/#/Orders', cfg.kiotviet.baseUrl).toString();
    const pollIntervalMs = cfg.orders?.pollIntervalMs ?? 60_000;
    const timePreset = cfg.orders?.timePresetLabel ?? 'Tuần này';

    const maxPolls = cfg.orders?.maxPolls ?? 0; // 0 = unlimited
    let pollCount = 0;

    const shouldStopByPollCount = () => maxPolls > 0 && pollCount >= maxPolls;
    const stopByPollCount = (reason: string) => {
      log('poll:stop', { pollCount, maxPolls, reason });
    };

    const startedAtMs = Date.now();
    const maxRunMs = cfg.orders?.maxRunMs ?? 0; // 0 = unlimited
    const maxConsecutiveErrors = cfg.orders?.maxConsecutiveErrors ?? 0; // 0 = unlimited
    let consecutiveErrors = 0;
    let totalErrors = 0;

    const isPastMaxRunTime = () => maxRunMs > 0 && Date.now() - startedAtMs >= maxRunMs;

    const exportTimeoutMs = cfg.orders?.exportTimeoutMs ?? 120_000;
    const deleteDownloadedAfterUpload = cfg.orders?.deleteDownloadedAfterUpload ?? true;

    const googleSheetId = cfg.google.sheetId;
    const googleTabName = cfg.google.tabName ?? 'PurchaseOrders';
    const googleRawTabName = cfg.google.rawTabName;
    const googleKeyFile = cfg.google.serviceAccountKeyFile;

    // In-memory cache to avoid reading Google Sheet multiple times per poll.
    // We refresh it at most once per `pollIntervalMs` unless forced.
    let sheetCache:
      | {
          fetchedAtMs: number;
          orderCodes: Set<string>;
        }
      | null = null;

    const getSheetOrderCodes = async (opts?: { forceRefresh?: boolean }) => {
      if (!googleSheetId || !googleKeyFile) return null;
      const now = Date.now();
      const maxAgeMs = pollIntervalMs;
      if (!opts?.forceRefresh && sheetCache && now - sheetCache.fetchedAtMs < maxAgeMs) {
        return sheetCache.orderCodes;
      }

      const orderCodes = await readExistingOrderCodesFromSheet({
        sheetId: googleSheetId,
        tabName: googleTabName,
        serviceAccountKeyFile: googleKeyFile,
        orderCodeHeader: 'Mã đặt hàng'
      });
      sheetCache = { fetchedAtMs: now, orderCodes };
      return orderCodes;
    };

    // Main polling loop.
    while (true) {
      pollCount++;
      try {
        if (isPastMaxRunTime()) {
          log('poll:stop:max-run-time', {
            pollCount,
            maxPolls,
            maxRunMs,
            ranMs: Date.now() - startedAtMs,
            totalErrors
          });
          return;
        }

        // Session can expire; if we got redirected to login, re-authenticate first.
        await withRetries(
          () =>
            ensureKiotvietSession(page, {
              baseUrl: cfg.kiotviet.baseUrl,
              username: cfg.kiotviet.username,
              password: cfg.kiotviet.password,
              reason: 'poll:start',
              log
            }),
          { retries: 2, delayMs: 750, label: 'ensureKiotvietSession' }
        );

        await withRetries(
          async () => {
            log('orders:navigate', { ordersUrl });
            await gotoOrdersPage(page, ordersUrl);
            log('orders:url', { url: page.url() });
          },
          { retries: 3, delayMs: 750, label: 'gotoOrdersPage' }
        );

        // Some setups redirect to login after navigation.
        await withRetries(
          () =>
            ensureKiotvietSession(page, {
              baseUrl: cfg.kiotviet.baseUrl,
              username: cfg.kiotviet.username,
              password: cfg.kiotviet.password,
              reason: 'after:gotoOrdersPage',
              log
            }),
          {
            retries: 2,
            delayMs: 750,
            label: 'ensureKiotvietSession(after:gotoOrdersPage)'
          }
        );

        // Apply filters.
        await withRetries(
          async () => {
            log('filters:branch=all');
            await selectBranchAll(page);
          },
          { retries: 3, delayMs: 750, label: 'selectBranchAll' }
        );

        await withRetries(
          async () => {
            log('filters:timePreset', { timePreset });
            await selectTimePreset(page, timePreset);
          },
          { retries: 3, delayMs: 750, label: 'selectTimePreset' }
        ).catch((e) => {
          throw new Error(`FatalConfigError: failed to apply ORDERS_TIME_PRESET=${JSON.stringify(timePreset)}. ${String(e)}`);
        });

        // Force a refresh so we pick up orders created while the page is already open.
        await withRetries(
          async () => {
            log('grid:refresh');
            await refreshOrdersGrid(page);
          },
          { retries: 3, delayMs: 750, label: 'refreshOrdersGrid' }
        );

        // Ensure we start from page 1 and sorted by time desc before scanning.
        await gotoFirstOrdersPagerPage(page);
        await ensureSortByTimeDesc(page);

        // Read grid.
        log('grid:read');
        const items = await withRetries(() => readOrderList(page), {
          retries: 3,
          delayMs: 750,
          label: 'readOrderList'
        });
        const orderCodesInList = items.map((x) => x.orderCode);
        log('grid:read:ok', { count: orderCodesInList.length, top: orderCodesInList.slice(0, 5) });

        if (cache.lastSnapshot === null) {
          // First run (or cache reset): establish snapshot baseline.
          cache.lastSnapshot = { orderCodesInList, capturedAtIso: isoVietnam(new Date()) };

          // Initialize "seen" from Google Sheet so we only export orders that do NOT exist on the sheet yet.
          const existing = await getSheetOrderCodes();
          if (existing) {
            for (const c of existing) cache.seenOrderCodes[c] = true;
            log('cache:init-from-sheet', { knownOrderCodes: existing.size });
          }

          await saveOrdersCache(cachePath, cache);
          log('baseline:captured', { count: orderCodesInList.length, pollIntervalMs });
          // IMPORTANT: do NOT sleep/continue here. We proceed to compute missing orders and export them.
        }

        const rawCutoffMs = cache.lastScanAtMs ?? 0;
        // Backward-compatible: previous versions stored wall-clock scan time (seconds).
        // The grid time is usually minute-level, so we round down to the minute.
        const cutoffMs = rawCutoffMs > 0 ? Math.floor(rawCutoffMs / 60_000) * 60_000 : 0;

        const firstPageTimes = items
          .map((x) => parseVietnamUiDateTimeToMs(x.timeText))
          .filter((x): x is number => typeof x === 'number');
        const firstPageMaxTime = firstPageTimes.length ? Math.max(...firstPageTimes) : null;

        const hasCandidateOnFirstPage = items.some((x) => {
          const ms = parseVietnamUiDateTimeToMs(x.timeText);
          if (ms === null) return false;
          if (cutoffMs > 0 && ms < cutoffMs) return false;
          return !cache.seenOrderCodes[x.orderCode];
        });

        if (cutoffMs > 0 && firstPageMaxTime !== null) {
          const noNewByTime = firstPageMaxTime < cutoffMs || (firstPageMaxTime === cutoffMs && !hasCandidateOnFirstPage);
          if (noNewByTime) {
            // Before skipping, reconcile cache vs actual sheet to avoid "downloaded but not uploaded" drift.
            const existing = await getSheetOrderCodes({ forceRefresh: true });
            if (existing) {
              const missingOnSheet = items
                .filter((x) => {
                  const ms = parseVietnamUiDateTimeToMs(x.timeText);
                  if (ms === null) return false;
                  if (cutoffMs > 0 && ms < cutoffMs) return false;
                  return !existing.has(x.orderCode);
                })
                .map((x) => x.orderCode);

              if (missingOnSheet.length > 0) {
                log('cache:sheet-mismatch', { missingOnSheet });
                for (const c of missingOnSheet) delete cache.seenOrderCodes[c];
                await saveOrdersCache(cachePath, cache);
                // Continue to selection/export flow.
              } else {
                log('poll:no-new-after-cache-time', { cutoffIso: cache.lastScanAtIso, pollIntervalMs });
                cache.lastScanAtMs = firstPageMaxTime;
                cache.lastScanAtIso = isoVietnam(new Date(firstPageMaxTime));
                cache.lastSnapshot = { orderCodesInList, capturedAtIso: isoVietnam(new Date()) };
                await saveOrdersCache(cachePath, cache);

                if (shouldStopByPollCount()) {
                  stopByPollCount('no-new-after-cache-time');
                  return;
                }
                await sleep(pollIntervalMs);
                continue;
              }
            } else {
              log('poll:no-new-after-cache-time', { cutoffIso: cache.lastScanAtIso, pollIntervalMs });
              cache.lastScanAtMs = firstPageMaxTime;
              cache.lastScanAtIso = isoVietnam(new Date(firstPageMaxTime));
              cache.lastSnapshot = { orderCodesInList, capturedAtIso: isoVietnam(new Date()) };
              await saveOrdersCache(cachePath, cache);

              if (shouldStopByPollCount()) {
                stopByPollCount('no-new-after-cache-time');
                return;
              }
              await sleep(pollIntervalMs);
              continue;
            }
          }
        }

        // Ensure no stale selections remain from any previous iteration.
        await withRetries(() => clearSelectedOrders(page), {
          retries: 3,
          delayMs: 500,
          label: 'clearSelectedOrders(before)'
        });

        // Scan pages and select orders whose "Thời gian" is after cutoff.
        const selectedOrderCodes: string[] = [];
        const selectedSet = new Set<string>();
        let maxSelectedMs: number | null = null;

        let pagesScanned = 0;
        let gridRowsScanned = 0;

        const maxPages = 50;
        for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
          pagesScanned = pageNo;
          const pageItems = await withRetries(() => readOrderList(page), {
            retries: 3,
            delayMs: 500,
            label: `readOrderList(page=${pageNo})`
          });

          gridRowsScanned += pageItems.length;

          const parsed = pageItems
            .map((x) => {
              const ms = parseVietnamUiDateTimeToMs(x.timeText);
              return { orderCode: x.orderCode, timeText: x.timeText, ms };
            })
            .filter((x) => x.orderCode);

          const parsedMs = parsed.map((x) => x.ms).filter((x): x is number => typeof x === 'number');
          const minTime = parsedMs.length ? Math.min(...parsedMs) : null;

          const afterCutoff = parsed.filter((x) => {
            if (x.ms === null) return true;
            if (cutoffMs <= 0) return true;
            return x.ms >= cutoffMs;
          });
          for (const it of afterCutoff) {
            const code = it.orderCode;
            if (cache.seenOrderCodes[code]) continue; // already exists on sheet
            if (selectedSet.has(code)) continue;
            log('orders:select', { code, time: it.timeText });
            await withRetries(() => selectOrderByCode(page, code), {
              retries: 3,
              delayMs: 350,
              label: 'selectOrderByCode'
            });
            selectedSet.add(code);
            selectedOrderCodes.push(code);

            if (typeof it.ms === 'number') {
              maxSelectedMs = maxSelectedMs === null ? it.ms : Math.max(maxSelectedMs, it.ms);
            }
          }

          // Stop when we reached cutoff boundary on this page.
          if (cutoffMs > 0 && minTime !== null && minTime < cutoffMs) break;

          const moved = await gotoNextOrdersPagerPage(page);
          if (!moved) break;
        }

        log('scan:summary', {
          cutoffIso: cache.lastScanAtIso,
          cutoffMs,
          pagesScanned,
          gridRowsScanned,
          selectedOrders: selectedOrderCodes.length,
          firstPageRows: items.length
        });

        if (selectedOrderCodes.length === 0) {
          log('poll:no-missing-orders-after-cutoff', { cutoffIso: cache.lastScanAtIso, pollIntervalMs });
          if (firstPageMaxTime !== null) {
            cache.lastScanAtMs = firstPageMaxTime;
            cache.lastScanAtIso = isoVietnam(new Date(firstPageMaxTime));
          }
          cache.lastSnapshot = { orderCodesInList, capturedAtIso: isoVietnam(new Date()) };
          await saveOrdersCache(cachePath, cache);

          // Keep UI tidy.
          await gotoFirstOrdersPagerPage(page);
          await ensureSortByTimeDesc(page);

          if (shouldStopByPollCount()) {
            stopByPollCount('no-missing-orders-after-cutoff');
            return;
          }
          await sleep(pollIntervalMs);
          continue;
        }

        log('orders:new-detected', { newOrderCodes: selectedOrderCodes });

        // Small pause so the UI updates selected state.
        await page.waitForTimeout(300);

        // Trigger export + capture the xlsx. Retry once; if it still fails, abort the run.
        let outPath: string | null = null;
        for (let exportAttempt = 1; exportAttempt <= 2; exportAttempt++) {
          log('export:open-menu', { exportAttempt, exportTimeoutMs });

          const downloadEventPromise = page
            .waitForEvent('download', { timeout: exportTimeoutMs })
            .then((d: any) => ({ kind: 'download' as const, d }))
            .catch((e: any) => ({ kind: 'download-timeout' as const, error: String(e) }));

          const xlsxResponsePromise = page
            .waitForResponse(
                (resp: any) => {
                try {
                  const h = resp.headers();
                  const ct = (h['content-type'] ?? '').toLowerCase();
                  const cd = (h['content-disposition'] ?? '').toLowerCase();
                  const url = resp.url().toLowerCase();
                  const looksLikeXlsx =
                    url.includes('.xlsx') ||
                    cd.includes('.xlsx') ||
                    ct.includes('spreadsheetml') ||
                    ct.includes('application/vnd.ms-excel');
                  const looksLikeAttachment = cd.includes('attachment') || url.includes('download');
                  return looksLikeXlsx && (looksLikeAttachment || ct.includes('octet-stream') || ct.includes('spreadsheetml'));
                } catch {
                  return false;
                }
              },
              { timeout: exportTimeoutMs }
            )
            .then((resp: any) => ({ kind: 'xlsx-response' as const, resp }))
            .catch((e: any) => ({ kind: 'xlsx-timeout' as const, error: String(e) }));

          await withRetries(() => exportSelectedOrdersDetail(page), {
            retries: 2,
            delayMs: 500,
            label: 'exportSelectedOrdersDetail'
          });

          const start = Date.now();
          let toastClicks = 0;
          let toastSeen = 0;

          while (Date.now() - start < exportTimeoutMs) {
            const clickedToast = await clickToastDownloadLinkIfPresent(page).catch(() => false);
            if (clickedToast) toastClicks++;

            const toastLink = page.locator('text=tải xuống').first();
            if ((await toastLink.count().catch(() => 0)) > 0) toastSeen++;

            const maybeDownload = await Promise.race([
              downloadEventPromise,
              xlsxResponsePromise,
              page.waitForTimeout(500).then(() => ({ kind: 'tick' as const }))
            ]);

            if (maybeDownload.kind === 'tick') continue;

            const ts = format(new Date(), 'yyyyMMdd_HHmmss');
            if (maybeDownload.kind === 'download') {
              const download = maybeDownload.d;
              const suggested = download.suggestedFilename();
              const outName = `${ts}_orders_detail_${suggested}`;
              outPath = path.join(downloadsDir, outName);
              await download.saveAs(outPath);
              break;
            }

            if (maybeDownload.kind === 'xlsx-response') {
              const resp = maybeDownload.resp;
              const urlFile = resp.url().split('?')[0]?.split('/').pop() || 'orders.xlsx';
              const safeName = urlFile.toLowerCase().endsWith('.xlsx') ? urlFile : `${urlFile}.xlsx`;
              const outName = `${ts}_orders_detail_${safeName}`;
              outPath = path.join(downloadsDir, outName);
              const buf = await resp.body();
              await fs.writeFile(outPath, buf);
              break;
            }

            // one of the timeout sentinels
            break;
          }

          if (outPath) {
            log('export:downloaded', { outPath, exportAttempt });
            break;
          }

          const downloadWait = await downloadEventPromise;
          const xlsxWait = await xlsxResponsePromise;
          const reason = `download=${'error' in downloadWait ? downloadWait.error : 'unknown'} xlsx=${'error' in xlsxWait ? xlsxWait.error : 'unknown'}`;

          if (exportAttempt < 2) {
            log('export:retry', { exportAttempt, reason });
            await page.keyboard.press('Escape').catch(() => undefined);
            await page.waitForTimeout(400);
            continue;
          }

          throw new Error(`Export download did not start after retries. ${reason}`);
        }

        if (!outPath) {
          throw new Error('Export triggered but no download was captured within timeout.');
        }

        const table = await parseFirstSheetAsTable(outPath);
  // Áp dụng các rule xử lý đơn hàng tuần tự
  let processedRows = table.rows;
  // User-requested processing order:
  // 1) Filter early to drop irrelevant columns
  processedRows = filterColumnsKiotViet(processedRows);
  // 2) (no-op) filtered rows already contain optional columns listed in COLUMNS_TO_KEEP; ensureColumns removed
  // 3) Apply N11 rule (note: this will use the Đơn giá present at this point — pre-merge per user's order)
  processedRows = applyN11Rule(processedRows);
  // 4) Explode multi-quantity rows into single-quantity rows (user requested explode before split)
  processedRows = explodeProductsByQuantity(processedRows);
  // 5) Split any BỘ SUIT into JACKET + QUẦN
  processedRows = splitBoSuitToJacketPants(processedRows);
  // 6) Merge canvas accessory rows into JACKET/MĂNG TÔ and recalc prices
  processedRows = mergeCanvasToJacketManto(processedRows);
  // 7) Apply canvas-tier heuristics (TB70, mid-tier Half Canvas) — preserves merged notes
  processedRows = applyCanvasTierRules(processedRows);
  // 8) Final filter to ensure columns are in canonical upload order
  // Sanity: recompute per-row prices deterministically before final filter to avoid inconsistent Giá bán/Thành tiền
  processedRows = recomputePrices(processedRows);
  processedRows = filterColumnsKiotViet(processedRows);
        const payload = {
          meta: {
            exportedAtIso: isoVietnam(new Date()),
            ordersUrl,
            timePreset,
            orderCodes: selectedOrderCodes,
            downloadedPath: outPath,
            rows: processedRows.length
          },
          headers: COLUMNS_TO_KEEP,
          rows: processedRows
        };

          // Verify export contains at least 1 row per selected order code.
          const key = 'Mã đặt hàng';
          // Verify against the codes we selected in this run.
          // Some exports can include multiple rows per order.
          const selected = new Set(selectedOrderCodes);
          const counts: Record<string, number> = {};
          const extras = new Set<string>();

          for (const r of table.rows) {
            const raw = (r as any)?.[key];
            const code = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
            if (!code) continue;
            if (!selected.has(code)) {
              extras.add(code);
              continue;
            }
            counts[code] = (counts[code] ?? 0) + 1;
          }

          const missing = selectedOrderCodes.filter((c) => (counts[c] ?? 0) === 0);
          if (missing.length > 0 || extras.size > 0) {
            throw new Error(
              `Export verification failed. missing=${JSON.stringify(missing)} extras=${JSON.stringify(Array.from(extras))} counts=${JSON.stringify(counts)}`
            );
          }

          log('export:verified', { counts });

          log('export:summary', {
            selectedOrders: selectedOrderCodes.length,
            exportRows: table.rows.length,
            firstPageRows: items.length,
            pagesScanned,
            gridRowsScanned
          });

          // Upload to Google Sheets (append all exported rows; no per-row dedup).
          if (!googleSheetId || !googleKeyFile) {
            throw new Error('Google Sheets upload is not configured. Set GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY_FILE.');
          }
          // Reverse so oldest orders are appended first → sheet remains chronologically ascending.
          const processedRowsAsc = [...processedRows].reverse();

          // Upload filtered data to raw tab if configured.
          if (googleRawTabName) {
            log('google:upload:raw:start', {
              sheetId: googleSheetId,
              tabName: googleRawTabName,
              rows: processedRowsAsc.length
            });
            const rawRes = await appendTableToSheet({
              sheetId: googleSheetId,
              tabName: googleRawTabName,
              serviceAccountKeyFile: googleKeyFile,
              headers: COLUMNS_TO_KEEP,
              rows: processedRowsAsc
            });
            log('google:upload:raw:ok', { appendedRows: rawRes.appended });
          }
          {
            log('google:upload:start', {
              sheetId: googleSheetId,
              tabName: googleTabName,
              orderCodes: selectedOrderCodes,
              rowCountsByOrderCode: counts,
              totalRows: table.rows.length
            });
            const res = await appendTableToSheet({
              sheetId: googleSheetId,
              tabName: googleTabName,
              serviceAccountKeyFile: googleKeyFile,
              headers: COLUMNS_TO_KEEP,
              rows: processedRowsAsc
            });
            log('google:upload:ok', { appendedRows: res.appended, orderCodes: selectedOrderCodes });

            // Update in-memory cache optimistically to reduce immediate re-reads.
            const cached = await getSheetOrderCodes();
            if (cached) {
              for (const c of selectedOrderCodes) cached.add(c);
            }

            // Post-check: ensure uploaded order codes exist on the sheet.
            // This reads only the "Mã đặt hàng" column, so it remains reasonable even with large sheets.
            const existingAfter = await getSheetOrderCodes({ forceRefresh: true });
            const missingOnSheet = existingAfter ? selectedOrderCodes.filter((c) => !existingAfter.has(c)) : selectedOrderCodes;
            if (missingOnSheet.length > 0) {
              throw new Error(`Google Sheet post-check failed. Missing order codes: ${JSON.stringify(missingOnSheet)}`);
            }
            log('google:postcheck:ok', { orderCodes: selectedOrderCodes.length });
          }

          if (deleteDownloadedAfterUpload) {
            await fs.unlink(outPath).catch(() => undefined);
            log('export:file:deleted', { outPath });
          } else {
            log('export:file:kept', { outPath });
          }

          console.log(JSON.stringify(payload, null, 2));

          // Clear selection so next iteration doesn't accidentally export old selections.
          await withRetries(() => clearSelectedOrders(page), {
            retries: 3,
            delayMs: 500,
            label: 'clearSelectedOrders(after)'
          });

          // Mark seen only after export + (optional) upload succeeded.
          for (const c of selectedOrderCodes) cache.seenOrderCodes[c] = true;

          // Advance cutoff based on the newest order time we processed (minute-level).
          const nextCutoff = maxSelectedMs ?? firstPageMaxTime;
          if (typeof nextCutoff === 'number') {
            cache.lastScanAtMs = nextCutoff;
            cache.lastScanAtIso = isoVietnam(new Date(nextCutoff));
          }
          cache.lastSnapshot = { orderCodesInList, capturedAtIso: isoVietnam(new Date()) };
          await saveOrdersCache(cachePath, cache);

          // Keep UI tidy for next loop.
          await gotoFirstOrdersPagerPage(page);
          await ensureSortByTimeDesc(page);
          await withRetries(() => clearSelectedOrders(page), {
            retries: 2,
            delayMs: 300,
            label: 'clearSelectedOrders(final)'
          }).catch(() => undefined);

          // One more pass on page 1 to ensure nothing remains checked.
          await withRetries(() => clearSelectedOrders(page), {
            retries: 3,
            delayMs: 500,
            label: 'clearSelectedOrders(after:page1)'
          });

        if (shouldStopByPollCount()) {
          stopByPollCount('after-success');
          return;
        }

        log('poll:wait', { pollIntervalMs });
        await sleep(pollIntervalMs);

        consecutiveErrors = 0;

        if (maxPolls > 0 && pollCount >= maxPolls) {
          log('poll:stop', { pollCount, maxPolls });
          return;
        }

        continue;
      } catch (e) {
        totalErrors++;
        consecutiveErrors++;

        const message = String(e);
        const isFatalConfigError = message.includes('FatalConfigError:');
        const isFatalDownloadError =
          message.includes('Export download did not start') || message.includes('Export triggered but no download was captured');

        // If we were logged out mid-flow, re-login and continue quickly.
        const relogged = await ensureKiotvietSession(page, {
          baseUrl: cfg.kiotviet.baseUrl,
          username: cfg.kiotviet.username,
          password: cfg.kiotviet.password,
          reason: 'catch:logged-out',
          log
        }).catch(() => false);

        if (relogged) {
          if (shouldStopByPollCount()) {
            stopByPollCount('relogged');
            return;
          }
          await sleep(Math.min(2_000, pollIntervalMs));
          continue;
        }

        if (maxConsecutiveErrors > 0 && consecutiveErrors >= maxConsecutiveErrors) {
          log('poll:abort:too-many-errors', {
            consecutiveErrors,
            maxConsecutiveErrors,
            pollCount,
            maxPolls,
            ranMs: Date.now() - startedAtMs
          });
          throw e;
        }

        if (isPastMaxRunTime()) {
          log('poll:abort:max-run-time-after-errors', {
            pollCount,
            maxPolls,
            maxRunMs,
            ranMs: Date.now() - startedAtMs,
            totalErrors
          });
          throw e;
        }

        const id = `${stamp()}_orders_error`;

        const shot = await saveScreenshot(page, `${id}.png`).catch(() => undefined);
        const dump = await diag.dump(id).catch(() => undefined);
        log('error', {
          message,
          url: page.url(),
          screenshot: shot,
          diagnosticsJson: dump?.jsonPath,
          pageHtml: dump?.htmlPath
        });

        if (shouldStopByPollCount()) {
          stopByPollCount('after-error');
          throw e;
        }

        if (isFatalConfigError) {
          throw e;
        }

        if (isFatalDownloadError) {
          throw e;
        }

        await sleep(pollIntervalMs);

        if (maxPolls > 0 && pollCount >= maxPolls) {
          log('poll:stop', { pollCount, maxPolls });
          return;
        }

        continue;
      }
    }
  });
}
