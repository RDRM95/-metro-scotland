import { describe, expect, it } from 'vitest';
import { FONT_3x5, FONT_5x7, measureText, wrapText } from '../../src/engine/Font';

describe('bitmap fonts', () => {
  for (const font of [FONT_5x7, FONT_3x5]) {
    it(`${font.w}x${font.h}: every glyph has the right dimensions and only #/. cells`, () => {
      for (const [ch, rows] of Object.entries(font.glyphs)) {
        expect(rows.length, `glyph '${ch}' rows`).toBe(font.h);
        for (const row of rows) {
          expect(row.length, `glyph '${ch}' row width`).toBe(font.w);
          expect(row).toMatch(/^[#.]+$/);
        }
      }
    });
  }

  it('5x7 covers upper and lower case, digits and punctuation used in the script', () => {
    const needed = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?-/'\"()%+=_>< ";
    for (const ch of needed) expect(FONT_5x7.glyphs[ch], `missing '${ch}'`).toBeDefined();
  });

  it('3x5 covers the HUD character set', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:-/%()!?+, ') expect(FONT_3x5.glyphs[ch], `missing '${ch}'`).toBeDefined();
  });

  it('measures and wraps', () => {
    expect(measureText('AB', FONT_5x7)).toBe(11);
    expect(measureText('', FONT_5x7)).toBe(0);
    const lines = wrapText('Put Glasgow sector on the joint network. I want every available camera covering the river.', FONT_5x7, 416);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const l of lines) expect(measureText(l, FONT_5x7)).toBeLessThanOrEqual(416);
  });
});
