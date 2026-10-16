// Captures deterministic frames from the running preview server for visual review.
// Usage: node scripts/shots.mjs [outDir] [baseUrl]
import { chromium } from '@playwright/test';
import { mkdirSync, existsSync } from 'node:fs';

const out = process.argv[2] ?? 'test-results/review';
const base = process.argv[3] ?? 'http://127.0.0.1:4173/';
mkdirSync(out, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base);
await page.waitForFunction(() => typeof window.__metro !== 'undefined');
const scenes = await page.evaluate(() => window.__metro.scenes());
const start = (id) => scenes.find((s) => s.id === id).start;

const spec = process.argv[4];
let moments;
if (spec) {
  // "scene:t,scene:t"
  moments = spec.split(',').map((p, i) => {
    const [id, t] = p.split(':');
    return [`${String(i).padStart(2, '0')}-${id}-${t}`, start(id) + Number(t)];
  });
} else {
  moments = [
    ['01-control-wide', start('control') + 3],
    ['02-control-op2', start('control') + 6.5],
    ['03-control-op1-alert', start('control') + 9.5],
    ['04-control-ctl', start('control') + 12.5],
    ['05-control-pushin', start('control') + 23.6],
    ['06-surface-establish', start('surface') + 4],
    ['07-surface-movement', start('surface') + 8.5],
    ['08-surface-zoom', start('surface') + 14],
    ['09-surface-thermal', start('surface') + 25],
    ['10-entity-walk', start('entity') + 5],
    ['11-entity-look', start('entity') + 16.5],
    ['12-entity-point', start('entity') + 21.6],
    ['13-entity-bridge', start('entity') + 22.9],
    ['14-entity-beneath', start('entity') + 25],
    ['15-entity-silence', start('entity') + 28],
    ['16-network-quad', start('network') + 13],
    ['17-network-map', start('network') + 28.3],
    ['18-network-op1', start('network') + 36],
    ['19-inside-blackout', start('inside') + 9.8],
    ['20-inside-push', start('inside') + 18.3],
    ['21-inside-corridor', start('inside') + 22],
    ['22-inside-raise', start('inside') + 26.1],
    ['23-inside-frame', start('inside') + 26.34],
    ['24-inside-lost', start('inside') + 36],
    ['25-end', start('end') + 3],
  ];
}

// Menu first
await page.evaluate(() => window.__metro.begin());
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/00-menu.png` });

for (const [name, t] of moments) {
  const t0 = Date.now();
  await page.evaluate((tt) => window.__metro.renderAt(tt), t);
  const ms = Date.now() - t0;
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`${name}  t=${t.toFixed(2)}  render ${ms}ms`);
}
console.log('errors:', errors);
await browser.close();
