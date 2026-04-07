import type { Page } from 'playwright';
import { clickAnyVisible, fillAnyVisible, waitForAnyVisible } from './selectors.js';

export async function loginKiotviet(
  page: Page,
  opts: { baseUrl: string; username: string; password: string }
) {
  const loginUrl = new URL('/man/#/login', opts.baseUrl).toString();
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  // Wait for the SPA login form to render.
  await waitForAnyVisible(
    page,
    ['#UserName', 'input#UserName', 'input[name="UserName"]', 'input[type="tel"]', 'input[inputmode="tel"]'],
    15_000
  );

  await fillAnyVisible(
    page,
    [
      '#UserName',
      'input#UserName',
      'input[name="UserName"]',
      'input[name="username"]',
      'input[autocomplete="username"]',
      'input[type="tel"]',
      'input[inputmode="tel"]',
      'input[placeholder*="Tên đăng nhập"]',
      'input[placeholder*="đăng nhập"]'
    ],
    opts.username,
    15_000
  );

  await fillAnyVisible(
    page,
    [
      '#Password',
      'input#Password',
      'input[name="Password"]',
      'input[name="password"]',
      'input[autocomplete="current-password"]',
      'input[type="password"]'
    ],
    opts.password,
    15_000
  );

  await clickAnyVisible(
    page,
    [
      'button:has-text("Quản lý")',
      'button:has-text("Quan ly")',
      'button:has-text("Bán hàng")',
      'button:has-text("Ban hang")',
      'button:has-text("Đăng nhập")',
      'button:has-text("Login")',
      'button[type="submit"]'
    ],
    15_000
  );

  await page.waitForURL((url) => !url.toString().includes('/man/#/login'), {
    waitUntil: 'domcontentloaded'
  });
}
