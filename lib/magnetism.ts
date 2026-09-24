/**
 * Bar magnets in the Gilbert model: each magnet is a pair of opposite magnetic
 * charges at its pole tips, so B(r) = Σ q (r − p) / |r − p|³. Field lines leave
 * a source pole and end on a sink pole, which keeps "trace" and "reconnect"
 * legible. A small softening length removes the singularity at each charge.
 * Units are arbitrary: |B| = 1 at 1 m from a unit pole.
 */
import { seeded } from './lab';

export const MAGNET_Y = 1.3;
export const MAGNET_LENGTH = 1.9;
export const POLE_OFFSET = 0.78;
export const CAPTURE_RADIUS = 0.22;
export const FIELD_BOUNDS = 12;
export const FLOW_STEP = 1 / 120;
export const FLIP_SECONDS = 1.2;
export const MAX_MAGNETS = 4;
const SOFTENING2 = 0.08 * 0.08;
const ACTIVE_MOMENT = 0.15;

export type MagnetState = {
  x: number;
  z: number;
  /** Direction of the geometric north tip in the x–z plane, radians. */
  heading: number;
  /** Target polarity: +1 means the north tip is the field source. */
  polarity: 1 | -1;
  /** Current signed pole strength; animates between ±1 while flipping. */
  moment: number;
  /** Flip progress in [0, 1]; 1 when no flip is running. */
  flip: number;
};

/**
 * Shapes a polarity reversal. `progress` runs 0 → 1 over FLIP_SECONDS and the
 * result is the signed moment, from `from` to −`from`. Passing through 0 is
 * where the field lines detach from one pole and reconnect to another.
 */
export function flipMoment(progress: number, from: 1 | -1): number {
  // TODO(you): choose how the reversal feels. Linear is a placeholder.
  return from * (1 - 2 * progress);
}

export function magnetLayout(count: number): MagnetState[] {
  const make = (x: number, z: number, heading: number): MagnetState => ({
    x,
    z,
    heading,
    polarity: 1,
    moment: 1,
    flip: 1,
  });
  if (count === 2) return [make(-2.4, 0, 0), make(2.4, 0, 0)];
  if (count === 3)
    // A cycle: each north tip faces the next magnet's south tip.
    return [
      make(-3, -1.4, Math.atan2(4, 3)),
      make(3, -1.4, Math.PI),
      make(0, 2.6, Math.atan2(-4, 3)),
    ];
  if (count === 4)
    return [0, 1, 2, 3].map((i) => {
      const a = (i * Math.PI) / 2;
      return make(Math.cos(a) * 3.1, Math.sin(a) * 3.1, a + Math.PI / 2);
    });
  throw new Error('Magnet count must be 2, 3, or 4.');
}

export class MagneticField {
  readonly magnets: MagnetState[];
  /** Per magnet: north tip xyz, south tip xyz. */
  readonly poles = new Float64Array(MAX_MAGNETS * 6);
  /** Bumped whenever geometry or strength changes; consumers retrace on change. */
  version = 0;

  constructor(magnets: MagnetState[]) {
    if (magnets.length < 1 || magnets.length > MAX_MAGNETS)
      throw new Error('Invalid magnet configuration.');
    this.magnets = magnets.map((m) => ({ ...m }));
    this.updatePoles();
  }

  get count() {
    return this.magnets.length;
  }

  private updatePoles() {
    this.magnets.forEach((m, i) => {
      const dx = Math.cos(m.heading) * POLE_OFFSET,
        dz = Math.sin(m.heading) * POLE_OFFSET,
        b = i * 6;
      this.poles[b] = m.x + dx;
      this.poles[b + 1] = MAGNET_Y;
      this.poles[b + 2] = m.z + dz;
      this.poles[b + 3] = m.x - dx;
      this.poles[b + 4] = MAGNET_Y;
      this.poles[b + 5] = m.z - dz;
    });
    this.version++;
  }

  move(i: number, x: number, z: number) {
    const limit = 7.5,
      m = this.magnets[i];
    m.x = Math.max(-limit, Math.min(limit, x));
    m.z = Math.max(-limit, Math.min(limit, z));
    this.updatePoles();
  }

  rotate(i: number, delta: number) {
    this.magnets[i].heading += delta;
    this.updatePoles();
  }

  /** Starts a reversal. Flipping mid-flip mirrors the progress, so a curve symmetric about 0.5 turns back without a jump. */
  flip(i: number) {
    const m = this.magnets[i];
    m.polarity = m.polarity === 1 ? -1 : 1;
    m.flip = m.flip < 1 ? 1 - m.flip : 0;
  }

  /** Advances running flips. Returns true when any moment changed. */
  advance(dt: number) {
    let changed = false;
    for (const m of this.magnets) {
      if (m.flip >= 1) continue;
      m.flip = Math.min(1, m.flip + dt / FLIP_SECONDS);
      const from = -m.polarity as 1 | -1;
      m.moment = m.flip >= 1 ? m.polarity : flipMoment(m.flip, from);
      changed = true;
    }
    if (changed) this.version++;
    return changed;
  }

  get flipping() {
    return this.magnets.some((m) => m.flip < 1);
  }

  /** Writes B at a point into `out` and returns |B|. */
  field(x: number, y: number, z: number, out: Float64Array) {
    let bx = 0,
      by = 0,
      bz = 0;
    for (let i = 0; i < this.magnets.length; i++) {
      const q = this.magnets[i].moment;
      if (q === 0) continue;
      for (let s = 0; s < 2; s++) {
        const b = i * 6 + s * 3,
          rx = x - this.poles[b],
          ry = y - this.poles[b + 1],
          rz = z - this.poles[b + 2];
        const r2 = rx * rx + ry * ry + rz * rz + SOFTENING2;
        const k = (s === 0 ? q : -q) / (r2 * Math.sqrt(r2));
        bx += rx * k;
        by += ry * k;
        bz += rz * k;
      }
    }
    out[0] = bx;
    out[1] = by;
    out[2] = bz;
    return Math.hypot(bx, by, bz);
  }

  /** Index of the pole tip (magnet*2 + 0 north / 1 south) currently acting as a source. */
  sourceTip(i: number) {
    return i * 2 + (this.magnets[i].moment >= 0 ? 0 : 1);
  }

  /** Magnet whose sink tip lies within the capture radius, or −1. */
  sinkAt(x: number, y: number, z: number) {
    const r2 = CAPTURE_RADIUS * CAPTURE_RADIUS;
    for (let i = 0; i < this.magnets.length; i++) {
      if (Math.abs(this.magnets[i].moment) < ACTIVE_MOMENT) continue;
      const b = (this.sourceTip(i) ^ 1) * 3,
        dx = x - this.poles[b],
        dy = y - this.poles[b + 1],
        dz = z - this.poles[b + 2];
      if (dx * dx + dy * dy + dz * dz < r2) return i;
    }
    return -1;
  }

  /** Unit axis pointing out of magnet i's current source tip. */
  outward(i: number, out: Float64Array) {
    const tip = this.sourceTip(i),
      a = tip * 3,
      b = (tip ^ 1) * 3;
    const dx = this.poles[a] - this.poles[b],
      dz = this.poles[a + 2] - this.poles[b + 2],
      l = Math.hypot(dx, dz) || 1;
    out[0] = dx / l;
    out[1] = 0;
    out[2] = dz / l;
    return out;
  }

  /** Magnets strong enough to launch field lines and particles. */
  sources() {
    const list: number[] = [];
    this.magnets.forEach((m, i) => {
      if (Math.abs(m.moment) >= ACTIVE_MOMENT) list.push(i);
    });
    return list;
  }
}

export type LineEnd =
  | { kind: 'sink'; magnet: number }
  | { kind: 'escape' | 'stall' | 'length' };

const unit = new Float64Array(3);
/** Unit field direction; returns |B|. Zero field yields a zero vector. */
function direction(
  field: MagneticField,
  x: number,
  y: number,
  z: number,
  out: Float64Array,
) {
  const magnitude = field.field(x, y, z, out);
  if (magnitude < 1e-9) {
    out.fill(0);
    return 0;
  }
  out[0] /= magnitude;
  out[1] /= magnitude;
  out[2] /= magnitude;
  return magnitude;
}

/** One RK4 step of length `ds` along B̂, in place. Returns |B| at the start. */
function stepAlong(field: MagneticField, p: Float64Array, ds: number) {
  const m = direction(field, p[0], p[1], p[2], unit);
  if (m === 0) return 0;
  const k1x = unit[0],
    k1y = unit[1],
    k1z = unit[2];
  direction(
    field,
    p[0] + k1x * ds * 0.5,
    p[1] + k1y * ds * 0.5,
    p[2] + k1z * ds * 0.5,
    unit,
  );
  const k2x = unit[0],
    k2y = unit[1],
    k2z = unit[2];
  direction(
    field,
    p[0] + k2x * ds * 0.5,
    p[1] + k2y * ds * 0.5,
    p[2] + k2z * ds * 0.5,
    unit,
  );
  const k3x = unit[0],
    k3y = unit[1],
    k3z = unit[2];
  direction(field, p[0] + k3x * ds, p[1] + k3y * ds, p[2] + k3z * ds, unit);
  p[0] += (ds / 6) * (k1x + 2 * k2x + 2 * k3x + unit[0]);
  p[1] += (ds / 6) * (k1y + 2 * k2y + 2 * k3y + unit[1]);
  p[2] += (ds / 6) * (k1z + 2 * k2z + 2 * k3z + unit[2]);
  return m;
}

function escaped(p: Float64Array) {
  return (
    p[1] < 0 ||
    p[0] * p[0] + (p[1] - MAGNET_Y) ** 2 + p[2] * p[2] >
      FIELD_BOUNDS * FIELD_BOUNDS
  );
}

/** Evenly spread unit vectors (Fibonacci sphere), used to seed lines around a pole. */
export function sphereSeeds(count: number) {
  const seeds: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count,
      r = Math.sqrt(1 - y * y),
      a = i * 2.399963229728653;
    seeds.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return seeds;
}

/**
 * Traces field lines from every source pole into a fixed segment buffer.
 * A line is "linked" when it ends on a different magnet's sink pole.
 */
export class FieldLines {
  readonly positions: Float32Array;
  /** |B| per vertex, for colouring. */
  readonly magnitudes: Float32Array;
  /** Source magnet per vertex. */
  readonly owners: Float32Array;
  segments = 0;
  lines = 0;
  linked = 0;
  private readonly seeds: [number, number, number][];
  private readonly point = new Float64Array(3);

  constructor(
    readonly seedsPerMagnet = 24,
    readonly maxSteps = 170,
    readonly ds = 0.08,
  ) {
    const capacity = MAX_MAGNETS * seedsPerMagnet * maxSteps;
    this.positions = new Float32Array(capacity * 6);
    this.magnitudes = new Float32Array(capacity * 2);
    this.owners = new Float32Array(capacity * 2);
    this.seeds = sphereSeeds(seedsPerMagnet);
  }

  trace(field: MagneticField, start: Float64Array, onStep?: () => void) {
    const p = this.point;
    p.set(start);
    for (let step = 0; step < this.maxSteps; step++) {
      const m = stepAlong(field, p, this.ds);
      if (m === 0) return { kind: 'stall' } as LineEnd;
      onStep?.();
      const sink = field.sinkAt(p[0], p[1], p[2]);
      if (sink >= 0) return { kind: 'sink', magnet: sink } as LineEnd;
      if (escaped(p)) return { kind: 'escape' } as LineEnd;
    }
    return { kind: 'length' } as LineEnd;
  }

  retrace(field: MagneticField) {
    this.segments = 0;
    this.lines = 0;
    this.linked = 0;
    const start = new Float64Array(3),
      scratch = new Float64Array(3),
      axis = new Float64Array(3);
    for (const i of field.sources()) {
      const tip = field.sourceTip(i) * 3;
      field.outward(i, axis);
      for (const seed of this.seeds) {
        // Seeds facing into the magnet body would only retrace its interior.
        if (seed[0] * axis[0] + seed[2] * axis[2] < -0.2) continue;
        for (let k = 0; k < 3; k++)
          start[k] = field.poles[tip + k] + seed[k] * CAPTURE_RADIUS * 1.1;
        let px = start[0],
          py = start[1],
          pz = start[2];
        const end = this.trace(field, start, () => {
          const s = this.segments++,
            p = this.point;
          this.positions.set([px, py, pz, p[0], p[1], p[2]], s * 6);
          const m = field.field(p[0], p[1], p[2], scratch);
          this.magnitudes[s * 2] = this.magnitudes[s * 2 + 1] = m;
          this.owners[s * 2] = this.owners[s * 2 + 1] = i;
          px = p[0];
          py = p[1];
          pz = p[2];
        });
        this.lines++;
        if (end.kind === 'sink' && end.magnet !== i) this.linked++;
      }
    }
    this.positions.fill(0, this.segments * 6);
  }
}

/**
 * Glowing flux particles that stream along B̂ from source to sink poles.
 * The flow speed is artistic — field lines have no velocity — and grows with
 * |B| so particles rush near the poles and drift in weak regions.
 */
export class FluxParticles {
  readonly positions: Float64Array;
  readonly tails: Float64Array;
  readonly magnitudes: Float64Array;
  readonly ages: Float64Array;
  readonly lives: Float64Array;
  time = 0;
  steps = 0;
  private spawned = 0;
  private remainder = 0;
  private readonly scratch = new Float64Array(3);
  private readonly point = new Float64Array(3);

  constructor(
    public field: MagneticField,
    readonly count: number,
  ) {
    this.positions = new Float64Array(count * 3);
    this.tails = new Float64Array(count * 3);
    this.magnitudes = new Float64Array(count);
    this.ages = new Float64Array(count);
    this.lives = new Float64Array(count);
    for (let i = 0; i < count; i++) this.respawn(i);
  }

  static speed(magnitude: number) {
    return Math.min(5, 0.6 + 1.6 * Math.sqrt(magnitude));
  }

  respawn(i: number) {
    const sources = this.field.sources(),
      n = this.spawned++,
      b = i * 3;
    this.ages[i] = 0;
    this.lives[i] = 3 + seeded(n * 3 + 2) * 5;
    if (!sources.length) {
      // No active pole mid-flip: park the particle invisibly until one returns.
      this.positions.fill(0, b, b + 3);
      this.tails.fill(0, b, b + 3);
      this.magnitudes[i] = 0;
      this.lives[i] = 0;
      return;
    }
    const magnet = sources[Math.floor(seeded(n * 3) * sources.length)],
      tip = this.field.sourceTip(magnet) * 3;
    const y = 1 - 2 * seeded(n * 3 + 1),
      a = seeded(n * 7 + 5) * Math.PI * 2,
      r = Math.sqrt(1 - y * y),
      radius = CAPTURE_RADIUS * 1.1,
      axis = this.field.outward(magnet, this.scratch);
    let ux = Math.cos(a) * r,
      uz = Math.sin(a) * r;
    // Launch from the outward hemisphere of the pole.
    const along = ux * axis[0] + uz * axis[2];
    if (along < 0) {
      ux -= 2 * along * axis[0];
      uz -= 2 * along * axis[2];
    }
    this.positions[b] = this.field.poles[tip] + ux * radius;
    this.positions[b + 1] = this.field.poles[tip + 1] + y * radius;
    this.positions[b + 2] = this.field.poles[tip + 2] + uz * radius;
    this.tails.set(this.positions.subarray(b, b + 3), b);
    this.magnitudes[i] = 0;
  }

  /** Fixed-step advance, independent of rendering cadence. */
  advance(dt: number, speedScale = 1) {
    this.remainder += dt;
    while (this.remainder >= FLOW_STEP) {
      this.remainder -= FLOW_STEP;
      this.step(FLOW_STEP, speedScale);
      this.time += FLOW_STEP;
      this.steps++;
    }
  }

  private step(h: number, speedScale: number) {
    const p = this.point,
      u = this.scratch;
    for (let i = 0; i < this.count; i++) {
      const b = i * 3;
      this.ages[i] += h;
      if (this.ages[i] >= this.lives[i]) {
        this.respawn(i);
        continue;
      }
      p[0] = this.positions[b];
      p[1] = this.positions[b + 1];
      p[2] = this.positions[b + 2];
      const m = direction(this.field, p[0], p[1], p[2], u);
      const speed = FluxParticles.speed(m) * speedScale;
      // Midpoint step along B̂.
      direction(
        this.field,
        p[0] + u[0] * speed * h * 0.5,
        p[1] + u[1] * speed * h * 0.5,
        p[2] + u[2] * speed * h * 0.5,
        u,
      );
      p[0] += u[0] * speed * h;
      p[1] += u[1] * speed * h;
      p[2] += u[2] * speed * h;
      if (m === 0 || escaped(p) || this.field.sinkAt(p[0], p[1], p[2]) >= 0) {
        this.respawn(i);
        continue;
      }
      const streak = Math.min(0.4, 0.06 + speed * 0.07);
      this.positions[b] = p[0];
      this.positions[b + 1] = p[1];
      this.positions[b + 2] = p[2];
      this.tails[b] = p[0] - u[0] * streak;
      this.tails[b + 1] = p[1] - u[1] * streak;
      this.tails[b + 2] = p[2] - u[2] * streak;
      this.magnitudes[i] = m;
    }
  }
}
