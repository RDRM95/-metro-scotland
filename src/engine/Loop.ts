/**
 * requestAnimationFrame loop with delta time in seconds, clamped so a tab
 * switch does not fast-forward the film by a minute.
 */
export class Loop {
  private raf = 0;
  private last = 0;
  private running = false;
  constructor(private readonly tick: (dt: number, now: number) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const step = (now: number) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1;
      if (dt < 0) dt = 0;
      this.tick(dt, now / 1000);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
