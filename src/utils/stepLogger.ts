import { isoVietnam } from './time.js';

export type StepLogger = (message: string, extra?: Record<string, unknown>) => void;

/**
 * Create a console step logger with timestamps.
 */
export function createStepLogger(prefix: string): StepLogger {
  return (message, extra) => {
    const ts = isoVietnam(new Date());
    const base = `[${ts}] [${prefix}] ${message}`;
    if (!extra || Object.keys(extra).length === 0) {
      // eslint-disable-next-line no-console
      console.log(base);
      return;
    }
    // eslint-disable-next-line no-console
    console.log(base, JSON.stringify(extra));
  };
}
