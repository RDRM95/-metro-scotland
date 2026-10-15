/**
 * DOM playback controls: play/pause, restart, menu, scene selection,
 * progress scrubbing, subtitles, mute, volume and fullscreen. The bar hides
 * itself while the film plays and returns on any pointer activity or tap.
 */
import { formatTime } from '../timeline/Timeline';

export interface PlayerState {
  playing: boolean;
  time: number;
  total: number;
  volume: number;
  muted: boolean;
  subtitles: boolean;
  sceneIndex: number;
  scenes: Array<{ title: string; start: number }>;
  inFilm: boolean;
  fullscreen: boolean;
}

export interface PlayerApi {
  toggle(): void;
  restart(): void;
  menu(): void;
  seek(t: number): void;
  seekScene(i: number): void;
  setVolume(v: number): void;
  toggleMute(): void;
  toggleSubtitles(): void;
  toggleFullscreen(): void;
  state(): PlayerState;
}

export class Controls {
  private root: HTMLElement;
  private btnPlay: HTMLButtonElement;
  private btnRestart: HTMLButtonElement;
  private btnMenu: HTMLButtonElement;
  private btnSubs: HTMLButtonElement;
  private btnMute: HTMLButtonElement;
  private btnFull: HTMLButtonElement;
  private volume: HTMLInputElement;
  private select: HTMLSelectElement;
  private time: HTMLElement;
  private fill: HTMLElement;
  private progress: HTMLElement;
  private marks: HTMLElement;
  private hideTimer = 0;
  private lastActivity = 0;
  private scenesBuilt = false;
  private visible = true;

  constructor(private api: PlayerApi, stage: HTMLElement) {
    const q = <T extends HTMLElement>(id: string): T => {
      const el = document.getElementById(id);
      if (!el) throw new Error(`missing #${id}`);
      return el as T;
    };
    this.root = q('controls');
    this.btnPlay = q('btn-play');
    this.btnRestart = q('btn-restart');
    this.btnMenu = q('btn-menu');
    this.btnSubs = q('btn-subs');
    this.btnMute = q('btn-mute');
    this.btnFull = q('btn-full');
    this.volume = q('volume');
    this.select = q('scene-select');
    this.time = q('time-readout');
    this.fill = q('progress-fill');
    this.progress = q('progress-wrap');
    this.marks = q('scene-marks');

    this.btnPlay.addEventListener('click', () => api.toggle());
    this.btnRestart.addEventListener('click', () => api.restart());
    this.btnMenu.addEventListener('click', () => api.menu());
    this.btnSubs.addEventListener('click', () => api.toggleSubtitles());
    this.btnMute.addEventListener('click', () => api.toggleMute());
    this.btnFull.addEventListener('click', () => api.toggleFullscreen());
    this.volume.addEventListener('input', () => api.setVolume(Number(this.volume.value) / 100));
    this.select.addEventListener('change', () => api.seekScene(Number(this.select.value)));

    const scrub = (clientX: number) => {
      const r = this.progress.getBoundingClientRect();
      const u = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      api.seek(u * api.state().total);
    };
    let dragging = false;
    this.progress.addEventListener('pointerdown', (e) => {
      dragging = true;
      this.progress.setPointerCapture(e.pointerId);
      scrub(e.clientX);
    });
    this.progress.addEventListener('pointermove', (e) => {
      if (dragging) scrub(e.clientX);
    });
    this.progress.addEventListener('pointerup', () => (dragging = false));
    this.progress.addEventListener('pointercancel', () => (dragging = false));

    // Activity → show controls
    const poke = () => this.activity();
    stage.addEventListener('pointermove', poke);
    stage.addEventListener('pointerdown', poke);
    this.root.addEventListener('pointermove', poke);
    this.root.addEventListener('pointerdown', poke);
    window.addEventListener('keydown', poke);
    this.activity();
  }

  activity(): void {
    this.lastActivity = performance.now();
    this.show();
  }

  show(): void {
    this.visible = true;
    this.root.classList.remove('faded');
    window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.maybeHide(), 3000);
  }

  private maybeHide(): void {
    const s = this.api.state();
    if (s.playing && s.inFilm && performance.now() - this.lastActivity > 2800) {
      this.visible = false;
      this.root.classList.add('faded');
    } else {
      this.hideTimer = window.setTimeout(() => this.maybeHide(), 1000);
    }
  }

  get isVisible(): boolean {
    return this.visible;
  }

  setEnabled(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }

  update(): void {
    const s = this.api.state();
    if (!this.scenesBuilt && s.scenes.length) {
      this.select.innerHTML = '';
      this.marks.innerHTML = '';
      s.scenes.forEach((sc, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = sc.title;
        this.select.appendChild(opt);
        if (i > 0) {
          const m = document.createElement('div');
          m.className = 'scene-mark';
          m.style.left = `${((sc.start / s.total) * 100).toFixed(2)}%`;
          this.marks.appendChild(m);
        }
      });
      this.scenesBuilt = true;
    }
    this.btnPlay.textContent = s.playing ? '❚❚' : '▶';
    this.btnPlay.title = s.playing ? 'Pause (Space)' : 'Play (Space)';
    this.btnMute.textContent = s.muted || s.volume === 0 ? '🔇' : '🔊';
    this.btnSubs.classList.toggle('active', s.subtitles);
    this.btnFull.textContent = s.fullscreen ? '⤢' : '⛶';
    if (document.activeElement !== this.volume) this.volume.value = String(Math.round(s.volume * 100));
    if (String(s.sceneIndex) !== this.select.value && document.activeElement !== this.select) this.select.value = String(s.sceneIndex);
    this.time.textContent = `${formatTime(s.time)} / ${formatTime(s.total)}`;
    this.fill.style.width = `${((s.time / Math.max(1, s.total)) * 100).toFixed(2)}%`;
  }
}
