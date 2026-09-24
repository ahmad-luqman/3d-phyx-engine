/**
 * Independent planar double pendulums: massless rods, two 1 kg point masses.
 * Angles are measured from vertical down. Motion equations are derived at:
 * https://www.myphysicslab.com/pendulum/double-pendulum-en.html
 * Float64 state and fixed-step RK4 keep tiny initial-angle differences intact.
 */
export const PENDULUM_STEP = 1 / 240;
export const PENDULUM_LENGTH = 2.3;
export const PENDULUM_PIVOT = 5.4;
export const GHOST_PREVIEW_SECONDS = 20;
export type PendulumOptions = {
  count: number;
  angle: number;
  separation: number;
  gravity: number;
};
export type PendulumPoints = { x1: number; y1: number; x2: number; y2: number };
export class PendulumEnsemble {
  readonly state: Float64Array;
  readonly options: PendulumOptions;
  time = 0;
  steps = 0;
  private remainder = 0;
  private readonly k1 = new Float64Array(4);
  private readonly k2 = new Float64Array(4);
  private readonly k3 = new Float64Array(4);
  private readonly k4 = new Float64Array(4);
  private readonly work = new Float64Array(4);
  readonly initialEnergy: number;

  constructor(options: PendulumOptions) {
    if (
      !Number.isInteger(options.count) ||
      options.count < 1 ||
      options.count > 100 ||
      !Number.isFinite(options.angle) ||
      !Number.isFinite(options.separation) ||
      options.separation < 0 ||
      !Number.isFinite(options.gravity) ||
      options.gravity < 0
    )
      throw new Error('Invalid pendulum configuration.');
    this.options = { ...options };
    this.state = new Float64Array(options.count * 4);
    for (let i = 0; i < options.count; i++) {
      this.state[i * 4] = (options.angle * Math.PI) / 180;
      this.state[i * 4 + 1] =
        ((options.angle - 30 + i * options.separation) * Math.PI) / 180;
    }
    this.initialEnergy = this.energy(0).total;
  }

  private derivative(s: Float64Array, offset: number, out: Float64Array) {
    const a = s[offset],
      b = s[offset + 1],
      wa = s[offset + 2],
      wb = s[offset + 3];
    const d = a - b,
      sin = Math.sin(d),
      cos = Math.cos(d),
      g = this.options.gravity;
    const denominator = PENDULUM_LENGTH * (3 - Math.cos(2 * d));
    out[0] = wa;
    out[1] = wb;
    out[2] =
      (-3 * g * Math.sin(a) -
        g * Math.sin(a - 2 * b) -
        2 * sin * PENDULUM_LENGTH * (wb * wb + wa * wa * cos)) /
      denominator;
    out[3] =
      (2 *
        sin *
        (2 * wa * wa * PENDULUM_LENGTH +
          2 * g * Math.cos(a) +
          wb * wb * PENDULUM_LENGTH * cos)) /
      denominator;
  }

  step() {
    const h = PENDULUM_STEP;
    for (let i = 0; i < this.options.count; i++) {
      const offset = i * 4;
      this.derivative(this.state, offset, this.k1);
      for (let j = 0; j < 4; j++)
        this.work[j] = this.state[offset + j] + h * 0.5 * this.k1[j];
      this.derivative(this.work, 0, this.k2);
      for (let j = 0; j < 4; j++)
        this.work[j] = this.state[offset + j] + h * 0.5 * this.k2[j];
      this.derivative(this.work, 0, this.k3);
      for (let j = 0; j < 4; j++)
        this.work[j] = this.state[offset + j] + h * this.k3[j];
      this.derivative(this.work, 0, this.k4);
      for (let j = 0; j < 4; j++)
        this.state[offset + j] +=
          (h / 6) * (this.k1[j] + 2 * this.k2[j] + 2 * this.k3[j] + this.k4[j]);
      // Keep angles bounded without changing their physical orientation.
      for (let j = 0; j < 2; j++)
        if (Math.abs(this.state[offset + j]) > Math.PI)
          this.state[offset + j] = Math.atan2(
            Math.sin(this.state[offset + j]),
            Math.cos(this.state[offset + j]),
          );
    }
    this.steps++;
    this.time = this.steps * PENDULUM_STEP;
  }

  advance(seconds: number, onSample?: () => void) {
    if (!Number.isFinite(seconds) || seconds < 0)
      throw new Error('Elapsed time must be finite and nonnegative.');
    this.remainder += seconds;
    while (this.remainder + 1e-12 >= PENDULUM_STEP) {
      this.step();
      this.remainder = Math.max(0, this.remainder - PENDULUM_STEP);
      if (this.steps % 4 === 0) onSample?.();
    }
  }

  points(
    index: number,
    out: PendulumPoints = { x1: 0, y1: 0, x2: 0, y2: 0 },
  ): PendulumPoints {
    const a = this.state[index * 4],
      b = this.state[index * 4 + 1];
    out.x1 = PENDULUM_LENGTH * Math.sin(a);
    out.y1 = PENDULUM_PIVOT - PENDULUM_LENGTH * Math.cos(a);
    out.x2 = out.x1 + PENDULUM_LENGTH * Math.sin(b);
    out.y2 = out.y1 - PENDULUM_LENGTH * Math.cos(b);
    return out;
  }

  energy(index: number) {
    const offset = index * 4,
      a = this.state[offset],
      b = this.state[offset + 1],
      wa = this.state[offset + 2],
      wb = this.state[offset + 3];
    const l = PENDULUM_LENGTH;
    const kinetic =
      l * l * (wa * wa + 0.5 * wb * wb + wa * wb * Math.cos(a - b));
    const potential =
      -this.options.gravity * l * (2 * Math.cos(a) + Math.cos(b));
    return { kinetic, total: kinetic + potential };
  }

  separation() {
    const reference = this.points(0),
      point = { x1: 0, y1: 0, x2: 0, y2: 0 };
    let square = 0;
    for (let i = 1; i < this.options.count; i++) {
      this.points(i, point);
      square += (point.x2 - reference.x2) ** 2 + (point.y2 - reference.y2) ** 2;
    }
    return Math.sqrt(square / Math.max(1, this.options.count - 1));
  }
}
