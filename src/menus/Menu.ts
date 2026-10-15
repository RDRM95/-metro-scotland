/**
 * Main menu, rendered inside the pixel frame: ruined Glasgow at night over
 * the Clyde, rain, the Finnieston Crane, a surveillance LED blinking on the
 * bridge pier — and a terse military menu.
 */
import { createSurface, rect, VIEW_H, VIEW_W, type Ctx2D, type Surface } from '../engine/Surface';
import { drawText, drawTextScaled, FONT_3x5, FONT_5x7, measureText } from '../engine/Font';
import { CLYDE_H, CLYDE_W, drawClydeWorld } from '../environments/clyde';
import { applyCamera } from '../camera/Camera';
import { drawRain } from '../particles/Rain';
import { drawFog } from '../particles/Fog';
import { drawCameraHousing } from '../environments/props';
import { vignette } from '../lighting/Lighting';
import { drawScanlines, drawNoise } from '../surveillance/Overlay';
import { P } from '../engine/Palette';
import { lightningAt } from '../scenes/common';
import { noise1 } from '../engine/Rng';
import { lowLightBlend } from '../surveillance/Thermal';

const MENU_X = 272;

export interface MenuSettings {
  volume: number; // 0..1
  subtitles: boolean;
  scanlines: boolean;
}

export type MenuAction = 'begin' | 'settings' | 'fullscreen' | 'return' | 'back' | 'volume-' | 'volume+' | 'subtitles' | 'scanlines' | 'none';

interface Item {
  label: () => string;
  action: MenuAction;
  enabled: () => boolean;
}

export class Menu {
  private world: Surface;
  private page: 'main' | 'settings' = 'main';
  private selected = 0;
  private hover = -1;
  private t0 = 0;
  canReturn = false;
  settings: MenuSettings;

  constructor(settings: MenuSettings) {
    this.settings = settings;
    this.world = createSurface(CLYDE_W, CLYDE_H);
  }

  private items(): Item[] {
    if (this.page === 'main') {
      return [
        { label: () => 'BEGIN TRANSMISSION', action: 'begin', enabled: () => true },
        { label: () => 'SETTINGS', action: 'settings', enabled: () => true },
        { label: () => 'FULLSCREEN', action: 'fullscreen', enabled: () => true },
        { label: () => 'RETURN', action: 'return', enabled: () => this.canReturn },
      ];
    }
    return [
      { label: () => `VOLUME        < ${'|'.repeat(Math.round(this.settings.volume * 10)).padEnd(10, '.')} >`, action: 'volume+', enabled: () => true },
      { label: () => `SUBTITLES     ${this.settings.subtitles ? 'ON ' : 'OFF'}`, action: 'subtitles', enabled: () => true },
      { label: () => `CRT SCANLINES ${this.settings.scanlines ? 'ON ' : 'OFF'}`, action: 'scanlines', enabled: () => true },
      { label: () => 'BACK', action: 'back', enabled: () => true },
    ];
  }

  reset(now: number): void {
    this.t0 = now;
    this.page = 'main';
    this.selected = 0;
  }

  /** Item geometry in frame pixels (menu sits on the right, clear of the crane). */
  private layout(): Array<{ x: number; y: number; w: number; h: number }> {
    const items = this.items();
    const out = [];
    const y0 = 150;
    for (let i = 0; i < items.length; i++) {
      out.push({ x: MENU_X - 12, y: y0 + i * 16 - 3, w: 200, h: 14 });
    }
    return out;
  }

  hitTest(fx: number, fy: number): number {
    const boxes = this.layout();
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (fx >= b.x && fx < b.x + b.w && fy >= b.y && fy < b.y + b.h) return i;
    }
    return -1;
  }

  setHover(fx: number, fy: number): void {
    this.hover = this.hitTest(fx, fy);
    if (this.hover >= 0) this.selected = this.hover;
  }

  move(dir: number): void {
    const n = this.items().length;
    for (let k = 0; k < n; k++) {
      this.selected = (this.selected + dir + n) % n;
      if (this.items()[this.selected].enabled()) break;
    }
  }

  /** Adjusts a horizontal setting (volume) with left/right keys. */
  adjust(dir: number): MenuAction {
    const it = this.items()[this.selected];
    if (it.action === 'volume+') {
      this.settings.volume = Math.max(0, Math.min(1, Math.round((this.settings.volume + dir * 0.1) * 10) / 10));
      return dir > 0 ? 'volume+' : 'volume-';
    }
    return 'none';
  }

  /** Activates the selected (or given) item; returns the action for the app to handle. */
  activate(index = this.selected): MenuAction {
    const items = this.items();
    const it = items[index];
    if (!it || !it.enabled()) return 'none';
    switch (it.action) {
      case 'settings':
        this.page = 'settings';
        this.selected = 0;
        return 'settings';
      case 'back':
        this.page = 'main';
        this.selected = 1;
        return 'back';
      case 'volume+':
        this.settings.volume = this.settings.volume >= 0.99 ? 0 : Math.min(1, Math.round((this.settings.volume + 0.1) * 10) / 10);
        return 'volume+';
      case 'subtitles':
        this.settings.subtitles = !this.settings.subtitles;
        return 'subtitles';
      case 'scanlines':
        this.settings.scanlines = !this.settings.scanlines;
        return 'scanlines';
      default:
        return it.action;
    }
  }

  get isSettings(): boolean {
    return this.page === 'settings';
  }

  render(frame: Ctx2D, now: number): void {
    const t = now - this.t0;
    const flash = lightningAt(t % 23, [[6.5, 0.8], [17.2, 0.5]]);
    drawClydeWorld(this.world.ctx, t, { lightning: flash });
    // the red surveillance light on the bridge pier — a station still watching
    drawCameraHousing(this.world.ctx, 456, 150, t, true);
    const x = 246 + Math.sin(t * 0.07) * 6;
    applyCamera(frame, this.world, { x, y: 140, zoom: 1, shake: 0 }, t);
    lowLightBlend(frame, 0, 0, VIEW_W, VIEW_H, 1.45, 0.25);
    drawFog(frame, t, { x: 0, y: 80, w: VIEW_W, h: 100, colour: 'rgba(120,140,165,0.10)', density: 0.4, drift: 8, scale: 36, seed: 4, fadeTop: 0.5, step: 2 });
    drawRain(frame, t, { count: 220, wind: -50, speed: 420, length: 7, w: VIEW_W, h: VIEW_H, colour: 'rgba(175,195,215,0.28)', colourBright: 'rgba(210,225,240,0.5)', seed: 1 });
    // darken for legibility, right side heavier (the text lives there)
    frame.fillStyle = 'rgba(0,0,0,0.30)';
    frame.fillRect(0, 0, VIEW_W, VIEW_H);
    for (let i = 0; i < 7; i++) {
      frame.fillStyle = `rgba(0,0,0,${(0.11 * (1 - i / 7)).toFixed(3)})`;
      frame.fillRect(VIEW_W - 100 - i * 32, 0, 100 + i * 32, VIEW_H);
    }
    vignette(frame, 0, 0, VIEW_W, VIEW_H, 0.7);

    // Title block (right-aligned)
    const tx = VIEW_W - 30;
    const flicker = noise1(t * 7, 2) > 0.92 ? 0.7 : 1;
    drawText(frame, 'UK CONTINUITY COMMAND  -  JOINT SCOTLAND SURFACE RECONNAISSANCE NETWORK', tx, 32, FONT_3x5, '#6f8a73', { alpha: flicker, align: 'right' });
    drawTextScaled(frame, 'METRO', tx, 46, FONT_5x7, 4, P.paper, { shadow: '#000', alpha: flicker, align: 'right' });
    drawTextScaled(frame, 'SCOTLAND', tx, 78, FONT_5x7, 4, P.paper, { shadow: '#000', alpha: flicker, align: 'right' });
    rect(frame, tx - 190, 112, 190, 1, P.red2);
    drawText(frame, 'THE SURFACE NETWORK', tx, 118, FONT_5x7, P.red3, { spacing: 3, alpha: flicker, align: 'right' });
    drawText(frame, 'A CINEMATIC PIXEL-ART MILITARY HORROR  -  2033', tx, 130, FONT_3x5, '#9aa49a', { align: 'right' });

    // Menu items
    const items = this.items();
    const boxes = this.layout();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const b = boxes[i];
      const sel = i === this.selected;
      const enabled = it.enabled();
      const col = !enabled ? '#3a4440' : sel ? P.phos5 : '#aebcae';
      if (sel && enabled) {
        rect(frame, b.x, b.y, b.w, b.h, 'rgba(60,160,90,0.12)');
        rect(frame, b.x, b.y, 2, b.h, P.phos4);
        const blink = Math.floor(t * 3) % 2 === 0;
        if (blink) drawText(frame, '>', b.x + 5, b.y + 4, FONT_5x7, P.phos4);
      }
      drawText(frame, it.label(), MENU_X, b.y + 4, FONT_5x7, col, { shadow: '#000' });
    }
    if (this.page === 'settings') {
      drawText(frame, 'ENTER / TAP TO CHANGE  -  ARROWS TO ADJUST', tx, 222, FONT_3x5, '#6f8a73', { align: 'right' });
    } else {
      drawText(frame, 'HEADPHONES RECOMMENDED  -  APPROX. 2 MIN 40 S', tx, 222, FONT_3x5, '#6f8a73', { align: 'right' });
    }
    // Status strip, bottom left: like a station readout
    const sx = 10;
    drawText(frame, 'STATION: GLASGOW WEST  CAM-12', sx, VIEW_H - 30, FONT_3x5, '#7f9a7c', { shadow: '#000' });
    drawText(frame, `SIG 91%   RAD 1.84 uSv/h   ${Math.floor(t * 2) % 2 === 0 ? '  REC' : '     '}`, sx, VIEW_H - 23, FONT_3x5, '#7f9a7c', { shadow: '#000' });
    drawText(frame, 'STANDING BY FOR TRANSMISSION', sx, VIEW_H - 16, FONT_3x5, '#5f7a5f', { shadow: '#000' });
    if (Math.floor(t * 2) % 2 === 0) rect(frame, sx + measureText('SIG 91%   RAD 1.84 uSv/h   ', FONT_3x5) - 1, VIEW_H - 22, 3, 3, P.red3);

    drawNoise(frame, 0, 0, VIEW_W, VIEW_H, 0.12, t, '#cfd8d0', 9);
    if (this.settings.scanlines) drawScanlines(frame, 0, 0, VIEW_W, VIEW_H, 0.12, t);
  }
}
