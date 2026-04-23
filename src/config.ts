import 'dotenv/config';
import { z } from 'zod';

const boolFromString = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'y', 'on'].includes(value.toLowerCase());
};

const numberFromString = (value: string | undefined, defaultValue: number) => {
  if (value === undefined || value === '') return defaultValue;
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultValue;
  return n;
};

const EnvSchema = z.object({
  KIOTVIET_BASE_URL: z.string().url(),
  KIOTVIET_USERNAME: z.string().min(1),
  KIOTVIET_PASSWORD: z.string().min(1),

  // Orders watch
  ORDERS_URL: z.string().optional(),
  ORDERS_TIME_PRESET: z.string().optional(),
  ORDERS_POLL_INTERVAL_MS: z.string().optional(),
  ORDERS_EXPORT_TIMEOUT_MS: z.string().optional(),
  ORDERS_MAX_POLLS: z.string().optional(),
  ORDERS_MAX_RUN_MS: z.string().optional(),
  ORDERS_MAX_CONSECUTIVE_ERRORS: z.string().optional(),
  HEADLESS: z.string().optional(),
  SLOW_MO_MS: z.string().optional(),
  TIMEOUT_MS: z.string().optional(),
  STOP_AFTER_LOGIN: z.string().optional(),
  STOP_AFTER_LOGIN_MS: z.string().optional(),
  GOOGLE_SHEET_ID: z.string().optional(),
  GOOGLE_SHEET_TAB_NAME: z.string().optional(),
  GOOGLE_SHEET_TAB_NAME_RAW: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY_FILE: z.string().optional(),

  // Cleanup
  ORDERS_DELETE_DOWNLOADED_AFTER_UPLOAD: z.string().optional()
});

function resolveOrdersUrl(baseUrl: string, raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;

  // Full URL
  if (/^https?:\/\//i.test(v)) return v;

  const base = new URL(baseUrl);

  // Common full SPA route forms
  if (v.startsWith('/man/#') || v.startsWith('man/#') || v.startsWith('/man/#/') || v.startsWith('man/#/')) {
    const p = v.startsWith('/') ? v : `/${v}`;
    return new URL(p, base).toString();
  }

  // Hash-only form: #/Orders
  if (v.startsWith('#')) {
    const u = new URL('/man/', base);
    u.hash = v; // may contain leading '#'
    return u.toString();
  }

  // Accept simple route names: Orders, /Orders
  const route = v.startsWith('/') ? v : `/${v}`;
  const u = new URL('/man/', base);
  u.hash = route; // '/Orders' => '#/Orders'
  return u.toString();
}

export type AppConfig = {
  kiotviet: {
    baseUrl: string;
    username: string;
    password: string;
  };
  orders?: {
    ordersUrl?: string;
    timePresetLabel?: string;
    pollIntervalMs?: number;
    exportTimeoutMs?: number;
    maxPolls?: number;
    maxRunMs?: number;
    maxConsecutiveErrors?: number;
    deleteDownloadedAfterUpload?: boolean;
  };
  browser: {
    headless: boolean;
    slowMoMs: number;
    timeoutMs: number;
    stopAfterLogin: {
      enabled: boolean;
      ms: number;
    };
  };
  google: {
    sheetId?: string;
    tabName?: string;
    rawTabName?: string;
    serviceAccountKeyFile?: string;
  };
};

export function loadConfig(): AppConfig {
  const parsed = EnvSchema.parse(process.env);
  const ordersUrl = resolveOrdersUrl(parsed.KIOTVIET_BASE_URL, parsed.ORDERS_URL);

  return {
    kiotviet: {
      baseUrl: parsed.KIOTVIET_BASE_URL,
      username: parsed.KIOTVIET_USERNAME,
      password: parsed.KIOTVIET_PASSWORD
    },
    orders: {
      ordersUrl: ordersUrl ? ordersUrl : undefined,
      timePresetLabel: parsed.ORDERS_TIME_PRESET?.trim() || undefined,
      pollIntervalMs: numberFromString(parsed.ORDERS_POLL_INTERVAL_MS, 60_000),
      exportTimeoutMs: numberFromString(parsed.ORDERS_EXPORT_TIMEOUT_MS, 30_000),
      maxPolls: numberFromString(parsed.ORDERS_MAX_POLLS, 0),
      maxRunMs: numberFromString(parsed.ORDERS_MAX_RUN_MS, 0),
      maxConsecutiveErrors: numberFromString(parsed.ORDERS_MAX_CONSECUTIVE_ERRORS, 0),
      deleteDownloadedAfterUpload: boolFromString(parsed.ORDERS_DELETE_DOWNLOADED_AFTER_UPLOAD, true)
    },
    browser: {
      headless: boolFromString(parsed.HEADLESS, true),
      slowMoMs: numberFromString(parsed.SLOW_MO_MS, 0),
      timeoutMs: numberFromString(parsed.TIMEOUT_MS, 45_000),
      stopAfterLogin: {
        enabled: boolFromString(parsed.STOP_AFTER_LOGIN, false),
        ms: numberFromString(parsed.STOP_AFTER_LOGIN_MS, 60_000)
      }
    },
    google: {
      sheetId: parsed.GOOGLE_SHEET_ID?.trim() || undefined,
      tabName: parsed.GOOGLE_SHEET_TAB_NAME?.trim() || undefined,
      rawTabName: parsed.GOOGLE_SHEET_TAB_NAME_RAW?.trim() || undefined,
      serviceAccountKeyFile: parsed.GOOGLE_SERVICE_ACCOUNT_KEY_FILE?.trim() || undefined
    }
  };
}
