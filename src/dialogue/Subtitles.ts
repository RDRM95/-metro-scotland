/**
 * Cinematic subtitles drawn into the pixel frame. Radio lines are bracketed
 * and jitter very slightly, like a weak carrier.
 */
import { drawText, FONT_5x7, measureText, wrapText } from '../engine/Font';
import { VIEW_H, VIEW_W, rect, type Ctx2D } from '../engine/Surface';
import { hash1 } from '../engine/Rng';
import { activeLine, SPEAKER_COLOURS, type Line } from './script';
import { P } from '../engine/Palette';

export interface SubtitleStyle {
  enabled: boolean;
}

const SPEAKER_SHORT: Record<string, string> = {
  CONTROL: 'CONTROL',
  'OPERATOR 1': 'OP 1',
  'OPERATOR 2': 'OP 2',
  'SCOTTISH OPERATIONS': 'SCOT OPS',
  TECHNICIAN: 'TECH',
  RADIO: 'RADIO',
  WHISPER: '',
};

export function drawSubtitles(ctx: Ctx2D, lines: readonly Line[], t: number, style: SubtitleStyle): Line | undefined {
  const line = activeLine(lines, t);
  if (!line || !style.enabled) return line;

  const age = t - line.time;
  const remain = line.time + line.duration - t;
  // Fast in, fast out
  const alpha = Math.min(1, age / 0.12, remain / 0.15);

  const maxW = VIEW_W - 64;
  const wrapped = wrapText(line.text, FONT_5x7, maxW);
  const lineH = 9;
  const blockH = wrapped.length * lineH + 2;
  const baseY = VIEW_H - 20 - blockH;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Backing band
  const widest = Math.max(...wrapped.map((l) => measureText(l, FONT_5x7)));
  const bandW = Math.min(VIEW_W - 24, widest + 16);
  const bandX = Math.round(VIEW_W / 2 - bandW / 2);
  rect(ctx, bandX, baseY - 3, bandW, blockH + 5, 'rgba(0,0,0,0.62)');

  const colour = SPEAKER_COLOURS[line.speaker];
  const label = SPEAKER_SHORT[line.speaker] ?? line.speaker;
  const textColour = line.quiet ? P.paper : P.white;

  // Speaker label rides on the band's top-left as a small tag
  if (label) {
    const tag = line.radio ? `[${label}]` : label;
    const tw = measureText(tag, FONT_5x7) + 6;
    rect(ctx, bandX, baseY - 11, tw, 9, 'rgba(0,0,0,0.75)');
    drawText(ctx, tag, bandX + 3, baseY - 10, FONT_5x7, colour);
  }

  let y = baseY;
  for (let i = 0; i < wrapped.length; i++) {
    let jx = 0;
    if (line.radio) {
      // weak-carrier jitter: occasionally nudge a line one pixel
      const j = hash1(Math.floor(t * 18) * 7 + i);
      if (j > 0.93) jx = j > 0.965 ? 1 : -1;
    }
    drawText(ctx, wrapped[i], VIEW_W / 2 + jx, y, FONT_5x7, textColour, { align: 'center', shadow: '#000000' });
    y += lineH;
  }
  ctx.restore();
  return line;
}
