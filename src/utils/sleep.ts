/**
 * Sleep for a number of milliseconds.
 */
export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
