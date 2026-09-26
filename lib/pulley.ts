/**
 * Planar block and tackle with n supporting strands (n:1 advantage). Strands
 * hang side by side, 2R apart; the rope alternates between sheaves on the
 * movable block and fixed sheaves under the beam, and leaves over the last
 * fixed sheave to the free end (the hand). With an even n the rope is anchored
 * to the beam; with an odd n it is tied to the movable block.
 *
 * The rope is inextensible but can go slack, so it is a one-sided constraint:
 *   n·h + y_hand ≥ C   (h = movable block height, C fixed by the rope length)
 * Taut: the load follows h = (C − y_hand) / n, so pulling n metres raises it
 * one, and every strand carries T = M(g + a) / n. Slack: T = 0 and the load
 * falls freely. The hand is a stiff, speed-limited follower of its target so
 * a fast pointer flick produces a finite tension spike. Fixed 1/240 s steps
 * keep results independent of the rendering cadence.
 */
export const PULLEY_STEP = 1 / 240;
export const WHEEL_RADIUS = 0.45;
export const BEAM_Y = 9;
export const FIXED_Y = 8.3;
export const HAND_MIN = 0.6;
export const HAND_MAX = FIXED_Y - WHEEL_RADIUS - 0.15;
export const HAND_START = 7.2;
/** Crate hangs below the movable block; this is where it meets the floor. */
export const CRATE_DROP = 1.25;
export const CRATE_SIZE = 1.1;
export const LOAD_FLOOR = CRATE_DROP + CRATE_SIZE / 2;
/** Highest the movable block may rise before meeting the fixed sheaves. */
export const LOAD_CEILING = FIXED_Y - 1;
export const LOAD_START = 2;
/** Mass of each sheave on the movable block. */
export const PULLEY_MASS = 2;
export const MAX_STRANDS = 6;
const HAND_STIFFNESS = 400;
const HAND_DAMPING = 2 * Math.sqrt(HAND_STIFFNESS);
const HAND_SPEED = 5;
const SLACK_EPSILON = 1e-9;

export type PulleyOptions = { mass: number; gravity: number; strands?: number };
export type Sheave = { x: number; top: boolean };
export type RigGeometry = {
  strands: number;
  /** x of each strand, 0…n − 1 lifting, n the free end. */
  xs: number[];
  /** Wrap between strand j and j + 1. */
  sheaves: Sheave[];
  anchoredToBeam: boolean;
  handX: number;
};

/** Strand and sheave layout, centred so the load hangs at x = 0. */
export function rigGeometry(strands: number): RigGeometry {
  const r = WHEEL_RADIUS,
    x0 = -r * (strands - 1);
  const xs = Array.from({ length: strands + 1 }, (_, k) => x0 + 2 * r * k);
  // The last wrap is always a fixed sheave, so wraps alternate back from it.
  const sheaves = Array.from({ length: strands }, (_, j) => ({
    x: xs[j] + r,
    top: (strands - 1 - j) % 2 === 0,
  }));
  return {
    strands,
    xs,
    sheaves,
    anchoredToBeam: strands % 2 === 0,
    handX: xs[strands],
  };
}

/**
 * Called on the step a slack rope snaps taut. `free` is the load's velocity
 * had nothing caught it; `rope` is the velocity the taut rope permits (always
 * greater). Returns the load's velocity after the catch. The rope's impulse,
 * and so the tension spike, is proportional to the difference.
 */
export function catchVelocity(free: number, rope: number) {
  // TODO(human): choose how the rope catches a falling load.
  void free;
  return rope;
}

export class PulleySystem {
  readonly strands: number;
  readonly geometry: RigGeometry;
  mass: number;
  gravity: number;
  /** Movable block height and velocity. */
  height = LOAD_START;
  velocity = 0;
  /** Free-end height, velocity, and the height it is steering toward. */
  hand = HAND_START;
  handVelocity = 0;
  target = HAND_START;
  /** Tension in each strand during the last step, in newtons. */
  tension = 0;
  slack = false;
  grounded = false;
  /** Rotation of each sheave, in wrap order. */
  readonly angles: Float64Array;
  time = 0;
  steps = 0;
  readonly reach: number;
  /** Lowest the hand may go before the block meets the fixed sheaves. */
  readonly handMin: number;
  private remainder = 0;

  constructor(options: PulleyOptions) {
    const strands = options.strands ?? 2;
    if (
      !Number.isFinite(options.mass) ||
      options.mass <= 0 ||
      !Number.isFinite(options.gravity) ||
      options.gravity < 0 ||
      !Number.isInteger(strands) ||
      strands < 1 ||
      strands > MAX_STRANDS
    )
      throw new Error('Invalid pulley configuration.');
    this.strands = strands;
    this.geometry = rigGeometry(strands);
    this.mass = options.mass;
    this.gravity = options.gravity;
    this.angles = new Float64Array(strands);
    this.reach = strands * LOAD_START + HAND_START;
    this.handMin = Math.max(HAND_MIN, this.reach - strands * LOAD_CEILING);
    this.tension = this.restTension;
  }

  /** Sheaves riding on the movable block. */
  get movableSheaves() {
    return Math.floor(this.strands / 2);
  }
  /** Load plus movable block. */
  get totalMass() {
    return this.mass + this.movableSheaves * PULLEY_MASS;
  }
  get restTension() {
    return (this.totalMass * this.gravity) / this.strands;
  }
  /** Rope drawn in at the free end since the start, in metres. */
  get pulled() {
    return HAND_START - this.hand;
  }
  /** Load rise since the start, in metres. */
  get raised() {
    return this.height - LOAD_START;
  }
  /** Extra rope beyond what the current geometry needs; zero when taut. */
  get gap() {
    return Math.max(0, this.strands * this.height + this.hand - this.reach);
  }
  get kinetic() {
    return 0.5 * this.totalMass * this.velocity ** 2;
  }

  setTarget(y: number) {
    this.target = Math.min(HAND_MAX, Math.max(this.handMin, y));
  }
  /** Draws `distance` metres of rope in at the free end (negative lets it out). */
  pullBy(distance: number) {
    this.setTarget(this.target - distance);
  }

  step() {
    const dt = PULLEY_STEP,
      n = this.strands;
    // Hand: a critically damped spring toward the target with a speed cap.
    let u =
      this.handVelocity +
      (HAND_STIFFNESS * (this.target - this.hand) -
        HAND_DAMPING * this.handVelocity) *
        dt;
    u = Math.min(HAND_SPEED, Math.max(-HAND_SPEED, u));
    let y = this.hand + u * dt;
    if (y < this.handMin || y > HAND_MAX) {
      y = Math.min(HAND_MAX, Math.max(this.handMin, y));
      u = 0;
    }
    // Load: fall freely, stop on the floor, then let the rope pull it back up.
    const wasSlack = this.slack;
    let v = this.velocity - this.gravity * dt;
    let h = this.height + v * dt;
    this.grounded = false;
    if (h <= LOAD_FLOOR) {
      h = LOAD_FLOOR;
      v = Math.max(0, v);
      this.grounded = true;
    }
    const free = v,
      limit = (this.reach - y) / n;
    if (h < limit) {
      h = limit;
      const rope = (h - this.height) / dt;
      v = wasSlack ? Math.max(rope, catchVelocity(free, rope)) : rope;
      this.grounded = false;
    }
    // The n supporting strands share the rope's impulse equally.
    this.tension = Math.max(0, (this.totalMass * (v - free)) / (n * dt));
    this.slack = n * h + y - this.reach > SLACK_EPSILON;
    // Rope runs over wrap j at (j + 1)·v relative to that sheave's axle.
    this.geometry.sheaves.forEach((s, j) => {
      this.angles[j] += ((s.top ? -1 : 1) * (j + 1) * v * dt) / WHEEL_RADIUS;
    });
    this.height = h;
    this.velocity = v;
    this.hand = y;
    this.handVelocity = u;
    this.steps++;
    this.time = this.steps * PULLEY_STEP;
  }

  advance(seconds: number, onStep?: () => void) {
    if (!Number.isFinite(seconds) || seconds < 0)
      throw new Error('Elapsed time must be finite and nonnegative.');
    this.remainder += seconds;
    while (this.remainder + 1e-12 >= PULLEY_STEP) {
      this.step();
      this.remainder = Math.max(0, this.remainder - PULLEY_STEP);
      onStep?.();
    }
  }

  /** Length of rope the current geometry uses, wraps included. */
  ropeLength() {
    const n = this.strands;
    return (
      n * (FIXED_Y - this.height) +
      (this.geometry.anchoredToBeam ? BEAM_Y - FIXED_Y : 0) +
      n * Math.PI * WHEEL_RADIUS +
      (FIXED_Y - this.hand) +
      this.gap
    );
  }
}

/**
 * Rope centreline as flat x, y pairs in rig coordinates: anchor → alternating
 * wraps → hand. Slack rope bows out along the free strand.
 */
export function ropePath(system: PulleySystem, out: number[] = []) {
  out.length = 0;
  const r = WHEEL_RADIUS,
    h = system.height,
    y = system.hand,
    { xs, sheaves, anchoredToBeam, handX } = system.geometry;
  const line = (x0: number, y0: number, x1: number, y1: number, bow = 0) => {
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.25));
    for (let i = out.length ? 1 : 0; i <= n; i++) {
      const t = i / n;
      out.push(
        x0 + (x1 - x0) * t + bow * Math.sin(Math.PI * t),
        y0 + (y1 - y0) * t,
      );
    }
  };
  const arc = (cx: number, cy: number, from: number, to: number) => {
    for (let i = 1; i <= 12; i++) {
      const a = from + ((to - from) * i) / 12;
      out.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
  };
  // Strand j runs from the previous wrap (or the anchor) to wrap j.
  let from = anchoredToBeam ? BEAM_Y : h;
  sheaves.forEach((s, j) => {
    const cy = s.top ? FIXED_Y : h;
    line(xs[j], from, xs[j], cy);
    arc(s.x, cy, Math.PI, s.top ? 0 : 2 * Math.PI);
    from = cy;
  });
  // Half a sine of amplitude a adds ≈ π²a² / 4L of length to a span L.
  const span = Math.max(0.01, FIXED_Y - y),
    bow = Math.min(1.2, (2 / Math.PI) * Math.sqrt(system.gap * span));
  line(handX, FIXED_Y, handX, y, bow);
  return out;
}

export function pathLength(points: number[]) {
  let length = 0;
  for (let i = 2; i < points.length; i += 2)
    length += Math.hypot(
      points[i] - points[i - 2],
      points[i + 1] - points[i - 1],
    );
  return length;
}

/** Advantages shown side by side in the comparison layout. */
export const COMPARE_STRANDS = [1, 2, 4] as const;

/**
 * Rigs whose free ends hang from one bar, so a single pull draws the same
 * length of rope from each. The bar stops where the most limited rig does.
 */
export class LinkedRigs {
  readonly rigs: PulleySystem[];
  target = HAND_START;
  constructor(strands: readonly number[], options: PulleyOptions) {
    this.rigs = strands.map(
      (n) => new PulleySystem({ ...options, strands: n }),
    );
  }
  get handMin() {
    return Math.max(...this.rigs.map((r) => r.handMin));
  }
  get hand() {
    return this.rigs[0].hand;
  }
  setLoad(mass: number, gravity: number) {
    for (const r of this.rigs) {
      r.mass = mass;
      r.gravity = gravity;
    }
  }
  setTarget(y: number) {
    this.target = Math.min(HAND_MAX, Math.max(this.handMin, y));
    for (const r of this.rigs) r.setTarget(this.target);
  }
  pullBy(distance: number) {
    this.setTarget(this.target - distance);
  }
  /** Rigs step on the same clock, so advancing each in turn keeps lockstep. */
  advance(seconds: number, onStep?: () => void) {
    for (const r of this.rigs) r.advance(seconds, onStep);
  }
}
