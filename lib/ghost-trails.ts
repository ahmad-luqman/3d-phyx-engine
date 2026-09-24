import { PendulumEnsemble } from './pendulum';
/** A bounded ring of independent line segments; wrapping never joins old and new paths. */
export class GhostTrailHistory {
  readonly positions: Float32Array;
  readonly times: Float32Array;
  readonly previous: Float64Array;
  head = 0;
  samples = 0;
  constructor(
    readonly count: number,
    readonly capacity = 720,
  ) {
    this.positions = new Float32Array(count * capacity * 6);
    this.times = new Float32Array(count * capacity * 2);
    this.previous = new Float64Array(count * 2);
    this.times.fill(-1e6);
  }
  clear(model: PendulumEnsemble) {
    this.times.fill(-1e6);
    this.head = 0;
    this.samples = 0;
    for (let i = 0; i < this.count; i++) {
      const p = model.points(i);
      this.previous[i * 2] = p.x2;
      this.previous[i * 2 + 1] = p.y2;
    }
  }
  sample(model: PendulumEnsemble) {
    const p = { x1: 0, y1: 0, x2: 0, y2: 0 };
    for (let i = 0; i < this.count; i++) {
      model.points(i, p);
      const base = (i * this.capacity + this.head) * 6;
      const z = (i / Math.max(1, this.count - 1) - 0.5) * 0.65;
      this.positions[base] = this.previous[i * 2];
      this.positions[base + 1] = this.previous[i * 2 + 1];
      this.positions[base + 2] = z;
      this.positions[base + 3] = p.x2;
      this.positions[base + 4] = p.y2;
      this.positions[base + 5] = z;
      const time = (i * this.capacity + this.head) * 2;
      this.times[time] = model.time;
      this.times[time + 1] = model.time;
      this.previous[i * 2] = p.x2;
      this.previous[i * 2 + 1] = p.y2;
    }
    this.head = (this.head + 1) % this.capacity;
    this.samples = Math.min(this.samples + 1, this.capacity);
  }
}
