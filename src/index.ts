import { runOrdersWatch } from './sync/ordersWatch.js';

async function main() {
  const cmd = (process.argv[2] ?? 'orders').toLowerCase();

  switch (cmd) {
    case 'orders':
    case 'orders-watch':
    case 'watch':
    case 'sync':
      await runOrdersWatch();
      return;
    default:
      throw new Error(`Unknown command: ${cmd}. Try: npm run sync -- orders`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
