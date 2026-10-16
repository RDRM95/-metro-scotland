/**
 * METRO SCOTLAND — THE SURFACE NETWORK
 * Application bootstrap: renderer, audio, menu, film, controls, input.
 */
import './style.css';
import { Renderer } from './engine/Renderer';
import { Loop } from './engine/Loop';
import { AudioEngine } from './audio/AudioEngine';
import { Film } from './Film';
import { Menu, type MenuAction } from './menus/Menu';
import { Controls, type PlayerApi, type PlayerState } from './controls/Controls';
import { drawScanlines } from './surveillance/Overlay';
import { VIEW_H, VIEW_W } from './engine/Surface';

type Mode = 'gate' | 'menu' | 'film';

const SETTINGS_KEY = 'metro-scotland.settings.v1';

class App implements PlayerApi {
  private renderer: Renderer;
  private audio = new AudioEngine();
  private film: Film;
  private menuUi: Menu;
  private controls: Controls;
  private loop: Loop;
  private mode: Mode = 'gate';
  private now = 0;
  private stage: HTMLElement;
  private gate: HTMLElement;
  private appEl: HTMLElement;
  private filmStarted = false;

  constructor() {
    this.stage = must('stage');
    this.gate = must('start-gate');
    this.appEl = must('app');
    const canvas = must<HTMLCanvasElement>('screen');
    this.renderer = new Renderer(canvas, this.stage);
    this.film = new Film(this.audio);
    this.menuUi = new Menu(loadSettings());
    this.film.subtitles = this.menuUi.settings.subtitles;
    this.audio.setVolume(this.menuUi.settings.volume);
    this.controls = new Controls(this, this.stage);
    this.controls.setEnabled(false);
    this.film.onEnd = () => this.toMenu();
    this.loop = new Loop((dt, now) => this.tick(dt, now));

    // Start gate: unlock audio on first gesture (mobile autoplay policy).
    const start = async () => {
      if (this.mode !== 'gate') return;
      await this.audio.unlock();
      this.gate.classList.add('hidden');
      this.menuUi.reset(this.now);
      this.mode = 'menu';
    };
    this.gate.addEventListener('click', start);
    this.gate.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') start();
    });

    // Pointer input on the canvas: menu hit-testing, tap to pause/resume.
    canvas.addEventListener('pointermove', (e) => {
      if (this.mode === 'menu') {
        const p = this.renderer.toFrame(e.clientX, e.clientY);
        this.menuUi.setHover(p.x, p.y);
      }
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (this.mode === 'menu') {
        const p = this.renderer.toFrame(e.clientX, e.clientY);
        const i = this.menuUi.hitTest(p.x, p.y);
        if (i >= 0) this.handleMenu(this.menuUi.activate(i));
      } else if (this.mode === 'film') {
        // tap: toggle controls on touch, pause on mouse click
        if (e.pointerType === 'mouse') this.toggle();
        else if (this.controls.isVisible) this.toggle();
        this.controls.activity();
      }
    });

    window.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'film' && this.film.playing) this.film.pause();
    });
    document.addEventListener('fullscreenchange', () => this.renderer.resize());

    this.exposeTestApi();
    this.loop.start();
  }

  // ------------------------------------------------------------------ loop

  private tick(dt: number, now: number): void {
    this.now = now;
    const ctx = this.renderer.frame.ctx;
    ctx.imageSmoothingEnabled = false;
    switch (this.mode) {
      case 'gate':
      case 'menu':
        this.menuUi.render(ctx, now);
        if (this.mode === 'menu') this.audio.update({ bunker: 0, rain: 0.6, wind: 0.5, river: 0.4, radio: 0.15, drone: 0.12, sub: 0, alarm: 0, emergency: 0, static: 0.03 }, dt, now);
        break;
      case 'film':
        this.film.update(dt);
        this.film.render(ctx, dt);
        if (this.menuUi.settings.scanlines) drawScanlines(ctx, 0, 0, VIEW_W, VIEW_H, 0.10, now);
        this.controls.update();
        break;
    }
    this.renderer.present();
  }

  // ------------------------------------------------------------------ menu

  private handleMenu(action: MenuAction): void {
    this.audio.uiClick();
    switch (action) {
      case 'begin':
        this.startFilm(true);
        break;
      case 'return':
        if (this.filmStarted) this.startFilm(false);
        break;
      case 'fullscreen':
        this.toggleFullscreen();
        break;
      case 'volume+':
      case 'volume-':
        this.audio.setVolume(this.menuUi.settings.volume);
        saveSettings(this.menuUi.settings);
        break;
      case 'subtitles':
        this.film.subtitles = this.menuUi.settings.subtitles;
        saveSettings(this.menuUi.settings);
        break;
      case 'scanlines':
        saveSettings(this.menuUi.settings);
        break;
      default:
        break;
    }
  }

  startFilm(fromStart: boolean): void {
    this.mode = 'film';
    this.filmStarted = true;
    this.controls.setEnabled(true);
    this.controls.activity();
    if (fromStart) this.film.restart();
    else this.film.play();
  }

  toMenu(): void {
    this.film.pause();
    this.mode = 'menu';
    this.menuUi.canReturn = this.film.time > 0 && this.film.time < this.film.total;
    this.menuUi.reset(this.now);
    this.controls.setEnabled(false);
  }

  // ------------------------------------------------------------------ input

  private onKey(e: KeyboardEvent): void {
    if (this.mode === 'gate') return;
    if (this.mode === 'menu') {
      switch (e.key) {
        case 'ArrowUp': this.menuUi.move(-1); this.audio.uiClick(); break;
        case 'ArrowDown': this.menuUi.move(1); this.audio.uiClick(); break;
        case 'ArrowLeft': this.handleMenu(this.menuUi.adjust(-1)); break;
        case 'ArrowRight': this.handleMenu(this.menuUi.adjust(1)); break;
        case 'Enter': case ' ': this.handleMenu(this.menuUi.activate()); break;
        case 'Escape': if (this.menuUi.isSettings) this.handleMenu(this.menuUi.activate(3)); break;
        case 'f': case 'F': this.toggleFullscreen(); break;
        default: return;
      }
      e.preventDefault();
      return;
    }
    switch (e.key) {
      case ' ': case 'k': this.toggle(); break;
      case 'r': case 'R': this.restart(); break;
      case 'Escape': this.menu_(); break;
      case 'm': case 'M': this.toggleMute(); break;
      case 'c': case 'C': this.toggleSubtitles(); break;
      case 'f': case 'F': this.toggleFullscreen(); break;
      case 'ArrowRight': this.seek(this.film.time + 5); break;
      case 'ArrowLeft': this.seek(this.film.time - 5); break;
      case 'ArrowUp': this.setVolume(Math.min(1, this.menuUi.settings.volume + 0.1)); break;
      case 'ArrowDown': this.setVolume(Math.max(0, this.menuUi.settings.volume - 0.1)); break;
      default: return;
    }
    e.preventDefault();
  }

  // ------------------------------------------------------------------ PlayerApi

  toggle(): void {
    if (this.film.playing) this.film.pause();
    else this.film.play();
  }
  restart(): void {
    this.film.restart();
  }
  menu(): void {
    this.menu_();
  }
  private menu_(): void {
    this.toMenu();
  }
  seek(t: number): void {
    this.film.seek(t);
  }
  seekScene(i: number): void {
    this.film.seekScene(i);
  }
  setVolume(v: number): void {
    this.menuUi.settings.volume = v;
    this.audio.setVolume(v);
    if (v > 0 && this.audio.isMuted) this.audio.setMuted(false);
    saveSettings(this.menuUi.settings);
  }
  toggleMute(): void {
    this.audio.setMuted(!this.audio.isMuted);
  }
  toggleSubtitles(): void {
    this.menuUi.settings.subtitles = !this.menuUi.settings.subtitles;
    this.film.subtitles = this.menuUi.settings.subtitles;
    saveSettings(this.menuUi.settings);
  }
  toggleFullscreen(): void {
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
    const el = this.appEl as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    const active = document.fullscreenElement || doc.webkitFullscreenElement;
    if (active) {
      (document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(document))?.()?.catch(() => undefined);
    } else {
      const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
      req?.()?.catch(() => undefined);
      // Landscape is the only sensible way to watch; ask politely where supported.
      const orient = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      orient?.lock?.('landscape').catch(() => undefined);
    }
    setTimeout(() => this.renderer.resize(), 100);
  }
  state(): PlayerState {
    const doc = document as Document & { webkitFullscreenElement?: Element };
    return {
      playing: this.film.playing,
      time: this.film.time,
      total: this.film.total,
      volume: this.menuUi.settings.volume,
      muted: this.audio.isMuted,
      subtitles: this.film.subtitles,
      sceneIndex: this.film.sceneIndex,
      scenes: this.film.scenes.map((s, i) => ({ title: s.title, start: this.film.timeline.starts[i] })),
      inFilm: this.mode === 'film',
      fullscreen: Boolean(document.fullscreenElement || doc.webkitFullscreenElement),
    };
  }

  // ------------------------------------------------------------------ test hooks

  private exposeTestApi(): void {
    const api = {
      begin: () => {
        this.gate.classList.add('hidden');
        if (this.mode === 'gate') {
          this.menuUi.reset(this.now);
          this.mode = 'menu';
        }
      },
      startFilm: () => {
        api.begin();
        this.startFilm(true);
      },
      toMenu: () => this.toMenu(),
      play: () => this.film.play(),
      pause: () => this.film.pause(),
      seek: (t: number) => this.film.seek(t),
      /** Deterministic frame at absolute film time, presented immediately. */
      renderAt: (t: number) => {
        api.begin();
        this.mode = 'film';
        this.controls.setEnabled(true);
        this.film.pause();
        this.film.renderAt(this.renderer.frame.ctx, t);
        this.renderer.present();
      },
      state: () => ({ ...this.state(), mode: this.mode }),
      scenes: () => this.film.scenes.map((s, i) => ({ id: s.id, title: s.title, duration: s.duration, start: this.film.timeline.starts[i] })),
      frameDataUrl: () => this.renderer.frame.canvas.toDataURL('image/png'),
      audioReady: () => this.audio.ready,
    };
    (window as unknown as { __metro: typeof api }).__metro = api;
  }
}

function must<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function loadSettings(): { volume: number; subtitles: boolean; scanlines: boolean } {
  const def = { volume: 0.8, subtitles: true, scanlines: true };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw) as Partial<typeof def>;
    return { ...def, ...parsed };
  } catch {
    return def;
  }
}

function saveSettings(s: { volume: number; subtitles: boolean; scanlines: boolean }): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

new App();
