// Frame-accurate video export.
//
// Renders every frame of the film through the deterministic `renderAt` hook in
// headless Chromium, writes PNGs, then (if ffmpeg is on PATH) assembles an
// MP4 (H.264, 1920×1080, nearest-neighbour upscale from 480×270) and a WebM,
// plus a small GIF preview of the first scene.
//
// Usage: node scripts/export-video.mjs [outDir] [fps] [baseUrl]
//   e.g. node scripts/export-video.mjs export 30
// The film is ~163 s; at 30 fps that is ~4900 frames. Audio is synthesised at
// runtime and is not captured here — this export is silent.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const out = process.argv[2] ?? 'export';
const fps = Number(process.argv[3] ?? 30);
const base = process.argv[4] ?? 'http://127.0.0.1:4173/';
const frameDir = join(out, 'frames');
mkdirSync(frameDir, { recursive: true });

const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
await page.goto(base);
await page.waitForFunction(() => typeof window.__metro !== 'undefined');
await page.evaluate(() => window.__metro.begin());
const total = await page.evaluate(() => window.__metro.state().total);
const frames = Math.ceil(total * fps);
console.log(`Exporting ${frames} frames at ${fps} fps (${total.toFixed(1)} s) to ${frameDir}`);

for (let i = 0; i < frames; i++) {
  const t = i / fps;
  const dataUrl = await page.evaluate((tt) => {
    window.__metro.renderAt(tt);
    return window.__metro.frameDataUrl();
  }, t);
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(join(frameDir, `f${String(i).padStart(6, '0')}.png`), png);
  if (i % 300 === 0) console.log(`  ${i}/${frames}`);
}
await browser.close();

const ff = spawnSync('ffmpeg', ['-version']);
if (ff.status !== 0) {
  console.log('ffmpeg not found; frames written only.');
  process.exit(0);
}
const input = ['-framerate', String(fps), '-i', join(frameDir, 'f%06d.png')];
const scale = 'scale=1920:1080:flags=neighbor';
console.log('Encoding MP4…');
spawnSync('ffmpeg', ['-y', ...input, '-vf', scale, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', join(out, 'metro-scotland-1080p.mp4')], { stdio: 'inherit' });
console.log('Encoding WebM…');
spawnSync('ffmpeg', ['-y', ...input, '-vf', scale, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', join(out, 'metro-scotland-1080p.webm')], { stdio: 'inherit' });
console.log('Encoding GIF preview (first 20 s, 480×270, 12 fps)…');
spawnSync('ffmpeg', ['-y', ...input, '-t', '20', '-vf', 'fps=12,scale=480:270:flags=neighbor,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=none', join(out, 'metro-scotland-preview.gif')], { stdio: 'inherit' });
console.log('Done.');
