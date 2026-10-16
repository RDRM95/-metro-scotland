// Steady-state render timing per scene: renders N consecutive frames at
// 60 fps spacing (after a warm-up) and reports the mean and worst cost.
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(base);
await page.waitForFunction(() => typeof window.__metro !== 'undefined');
const scenes = await page.evaluate(() => window.__metro.scenes());
for (const s of scenes) {
  const samples = [0.15, 0.4, 0.7, 0.9].map((u) => s.start + s.duration * u);
  for (const t0 of samples) {
    const r = await page.evaluate(([t, n]) => {
      const api = window.__metro;
      api.renderAt(t);
      const times = [];
      for (let i = 0; i < n; i++) {
        const a = performance.now();
        api.renderAt(t + (i + 1) / 60);
        times.push(performance.now() - a);
      }
      times.sort((x, y) => x - y);
      const mean = times.reduce((p, c) => p + c, 0) / times.length;
      return { mean, p95: times[Math.floor(times.length * 0.95)], max: times[times.length - 1] };
    }, [t0, 40]);
    console.log(`${s.id.padEnd(8)} t=${(t0 - s.start).toFixed(1).padStart(5)}  mean ${r.mean.toFixed(1)}ms  p95 ${r.p95.toFixed(1)}ms  max ${r.max.toFixed(1)}ms`);
  }
}
await browser.close();
