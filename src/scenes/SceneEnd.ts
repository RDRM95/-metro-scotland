/**
 * END CARD (6 s). Quiet. The title, the date, no further transmissions.
 */
import type { Ctx2D } from '../engine/Surface';
import { rect, VIEW_H, VIEW_W } from '../engine/Surface';
import { drawText, drawTextScaled, FONT_3x5, FONT_5x7 } from '../engine/Font';
import { span } from '../engine/Easing';
import { mix, type AudioMix } from '../audio/AudioMix';
import type { Scene, SceneCue } from './Scene';
import { P } from '../engine/Palette';

export class SceneEnd implements Scene {
  readonly id = 'end';
  readonly title = 'End';
  readonly duration = 6;
  readonly cues: SceneCue[] = [];
  init(): void {}

  render(frame: Ctx2D, t: number): void {
    rect(frame, 0, 0, VIEW_W, VIEW_H, '#000');
    const a1 = span(t, 0.6, 2.0);
    const a2 = span(t, 1.8, 3.0);
    const a3 = span(t, 3.0, 4.0);
    const out = 1 - span(t, this.duration - 1.2, this.duration);
    drawTextScaled(frame, 'METRO SCOTLAND', VIEW_W / 2, 104, FONT_5x7, 3, P.paper, { align: 'center', alpha: a1 * out, spacing: 1 });
    drawText(frame, 'THE SURFACE NETWORK', VIEW_W / 2, 132, FONT_5x7, P.red2, { align: 'center', alpha: a2 * out, spacing: 3 });
    drawText(frame, 'SCOTLAND CONTROL  -  11 OCT 2033  -  NO FURTHER TRANSMISSIONS RECEIVED', VIEW_W / 2, 160, FONT_3x5, '#4a564a', { align: 'center', alpha: a3 * out });
  }

  mix(): AudioMix {
    return mix({ wind: 0.12 });
  }
}
