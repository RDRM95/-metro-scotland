import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = 'test-results/shots';

interface MetroApi {
  begin(): void;
  startFilm(): void;
  toMenu(): void;
  play(): void;
  pause(): void;
  seek(t: number): void;
  renderAt(t: number): void;
  state(): { playing: boolean; time: number; total: number; sceneIndex: number; mode: string; subtitles: boolean; muted: boolean };
  scenes(): Array<{ id: string; title: string; duration: number; start: number }>;
  frameDataUrl(): string;
  audioReady(): boolean;
}

declare global {
  interface Window {
    __metro: MetroApi;
  }
}

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__metro !== 'undefined');
  return errors;
}

/** Average luminance of the canvas, 0..255. */
async function luminance(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.getElementById('screen') as HTMLCanvasElement;
    const ctx = c.getContext('2d')!;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 16) {
      sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      n++;
    }
    return sum / n;
  });
}

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

test('loads without console errors and shows the start gate', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#start-gate')).toBeVisible();
  await expect(page.locator('.gate-title')).toHaveText('METRO SCOTLAND');
  await page.screenshot({ path: `${SHOTS}/00-gate.png` });
  expect(errors).toEqual([]);
});

test('start gate → main menu renders the Glasgow background', async ({ page }) => {
  const errors = await open(page);
  await page.locator('#start-gate').click();
  await expect(page.locator('#start-gate')).toBeHidden();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__metro.state().mode)).toBe('menu');
  const lum = await luminance(page);
  expect(lum).toBeGreaterThan(4); // not black
  expect(lum).toBeLessThan(90); // night
  await page.screenshot({ path: `${SHOTS}/01-title.png` });
  expect(errors).toEqual([]);
});

test('BEGIN TRANSMISSION starts the film and it plays forward', async ({ page }) => {
  const errors = await open(page);
  await page.locator('#start-gate').click();
  // Click the first menu item (frame coords 260..460 x 147..161 → canvas coords)
  const box = await page.locator('#screen').boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.click(box.x + (330 / 480) * box.width, box.y + (154 / 270) * box.height);
  await page.waitForFunction(() => window.__metro.state().mode === 'film');
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => window.__metro.state());
  expect(s.playing).toBe(true);
  expect(s.time).toBeGreaterThan(1);
  expect(s.sceneIndex).toBe(0);
  await expect(page.locator('#controls')).toBeVisible();
  expect(errors).toEqual([]);
});

test('representative moments render as real imagery', async ({ page }) => {
  const errors = await open(page);
  const scenes = await page.evaluate(() => window.__metro.scenes());
  const start = (id: string) => scenes.find((s) => s.id === id)!.start;
  const moments: Array<[string, number]> = [
    ['02-command-centre-wide', start('control') + 3.0],
    ['03-command-centre-closeup-alert', start('control') + 9.5],
    ['04-wall-display-pushin', start('control') + 23.5],
    ['05-glasgow-surface', start('surface') + 4.0],
    ['06-first-movement', start('surface') + 8.5],
    ['07-magnified', start('surface') + 14.0],
    ['08-thermal', start('surface') + 25.0],
    ['09-entity-walk', start('entity') + 5.0],
    ['10-entity-looks', start('entity') + 16.5],
    ['11-entity-points', start('entity') + 21.5],
    ['12-entity-beneath', start('entity') + 25.0],
    ['13-silence', start('entity') + 28.0],
    ['14-quad-feeds', start('network') + 13.0],
    ['15-map-reveal', start('network') + 28.0],
    ['16-unauthorised', start('network') + 35.0],
    ['17-blackout', start('inside') + 9.8],
    ['18-monitor-push', start('inside') + 18.5],
    ['19-corridor', start('inside') + 22.0],
    ['20-corridor-head-raise', start('inside') + 26.0],
    ['21-one-frame', start('inside') + 26.34],
    ['22-connection-lost', start('inside') + 36.0],
    ['23-end-card', start('end') + 3.0],
  ];
  for (const [name, t] of moments) {
    await page.evaluate((tt) => window.__metro.renderAt(tt), t);
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    const lum = await luminance(page);
    // Everything but the deliberate blackout beats must contain visible imagery.
    if (!name.includes('blackout') && !name.includes('connection-lost') && !name.includes('silence')) {
      expect(lum, name).toBeGreaterThan(name.includes('end-card') ? 1.2 : 3);
    }
  }
  expect(errors).toEqual([]);
});

test('controls: pause, resume, seek, scene select, subtitles, mute', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => window.__metro.startFilm());
  await page.waitForTimeout(700);
  await page.locator('#btn-play').click();
  let s = await page.evaluate(() => window.__metro.state());
  expect(s.playing).toBe(false);
  const paused = s.time;
  await page.waitForTimeout(400);
  s = await page.evaluate(() => window.__metro.state());
  expect(s.time).toBeCloseTo(paused, 1);
  await page.locator('#btn-play').click();
  await page.waitForTimeout(400);
  s = await page.evaluate(() => window.__metro.state());
  expect(s.playing).toBe(true);
  expect(s.time).toBeGreaterThan(paused);

  await page.locator('#scene-select').selectOption('3');
  s = await page.evaluate(() => window.__metro.state());
  expect(s.sceneIndex).toBe(3);

  await page.locator('#btn-subs').click();
  s = await page.evaluate(() => window.__metro.state());
  expect(s.subtitles).toBe(false);
  await page.locator('#btn-subs').click();

  await page.locator('#btn-mute').click();
  s = await page.evaluate(() => window.__metro.state());
  expect(s.muted).toBe(true);

  // Keyboard: restart
  await page.keyboard.press('r');
  s = await page.evaluate(() => window.__metro.state());
  expect(s.time).toBeLessThan(1);

  // Progress bar scrub to ~50%
  const bar = await page.locator('#progress-wrap').boundingBox();
  if (!bar) throw new Error('no bar');
  await page.mouse.click(bar.x + bar.width * 0.5, bar.y + bar.height / 2);
  s = await page.evaluate(() => window.__metro.state());
  expect(s.time / s.total).toBeGreaterThan(0.45);
  expect(s.time / s.total).toBeLessThan(0.55);
  expect(errors).toEqual([]);
});

test('playback reaches the final scene and returns to the menu', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => {
    window.__metro.startFilm();
    const total = window.__metro.state().total;
    window.__metro.seek(total - 2.5);
  });
  await page.waitForFunction(() => window.__metro.state().mode === 'menu', null, { timeout: 15000 });
  const s = await page.evaluate(() => window.__metro.state());
  expect(s.mode).toBe('menu');
  expect(s.playing).toBe(false);
  expect(errors).toEqual([]);
});

test('resizes to a phone-landscape viewport without errors', async ({ page }) => {
  const errors = await open(page);
  await page.setViewportSize({ width: 740, height: 360 });
  await page.evaluate(() => window.__metro.startFilm());
  await page.waitForTimeout(800);
  const box = await page.locator('#screen').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(400);
  await page.screenshot({ path: `${SHOTS}/24-mobile-landscape.png` });
  expect(errors).toEqual([]);
});
