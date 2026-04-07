import { sleep } from './sleep.js';

export type RetryOptions = {
  retries: number;
  delayMs: number;
  label: string;
};

/**
 * Retry an async operation a few times with fixed delay.
 */
export async function withRetries<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === opts.retries) break;
      await sleep(opts.delayMs);
    }
  }
  throw new Error(`${opts.label} failed after ${opts.retries} attempts. Last error: ${String(lastErr)}`);
}
