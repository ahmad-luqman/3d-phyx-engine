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
 * falls freely. The hand follows its target at up to 5 m/s, speeding up and
 * braking at 8 m/s², so a fast pointer flick produces a finite tension; only
 * letting rope run is instant. Fixed 1/240 s steps
 * keep results independent of the rendering cadence.
 *
 * Ropes have a rating. A rigid rope delivers a catch in a single step, so the
 * rating is compared with tension averaged over 50 ms, standing in for the
 * stretch that spreads a real shock load. Past it the rope snaps: the load
 * falls until a self-retracting safety lanyard from the beam locks, then
 * swings from the lanyard's anchor beside the rig.
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
/** Steps the rope rating averages tension over (50 ms). */
export const SHOCK_STEPS = 12;
/** Lanyard reel sits on the beam this far left of the first strand. */
export const LANYARD_OFFSET = 1;
/** Extra lanyard paid out before the inertia lock engages. */
export const LANYARD_SLACK = 0.35;
const SWING_DRAG = 0.08;
const FLOOR_FRICTION = 6;
const HAND_SPEED = 5;
/**
 * A person speeds up and slows down with limited acceleration (under g, so a
 * stopping pull never throws the load) but can let go of the rope at once.
 */
const HAND_ACCEL = 8;
/** Final approach rate, 1/s: the hand closes on its target exponentially. */
const HAND_GAIN = 20;
const SLACK_EPSILON = 1e-9;
/** Fraction of the relative speed a catching rope returns as rebound. */
export const CATCH_RESTITUTION = 0.2;

export type PulleyOptions = {
  mass: number;
  gravity: number;
  strands?: number;
  /** Rope rating in newtons per strand; Infinity never snaps. */
  rating?: number;
};
export type Sheave = { x: number; top: boolean };
export type RigGeometry = {
  strands: number;
  /** x of each strand, 0…n − 1 lifting, n the free end. */
  xs: number[];
  /** Wrap between strand j and j + 1. */
  sheaves: Sheave[];
  anchoredToBeam: boolean;
  handX: number;
  lanyardX: number;
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
    lanyardX: xs[0] - LANYARD_OFFSET,
  };
}

/**
 * Called on the step a slack rope snaps taut. `free` is the load's velocity
 * had nothing caught it; `rope` is the velocity the taut rope permits (always
 * greater). Returns the load's velocity after the catch. The rope's impulse,
 * and so the tension spike, is proportional to the difference.
 */
export function catchVelocity(free: number, rope: number) {
  // Rope stretch hands back a fifth of the impact as a small rebound.
  return rope + CATCH_RESTITUTION * (rope - free);
}

export class PulleySystem {
  readonly strands: number;
  readonly geometry: RigGeometry;
  mass: number;
  gravity: number;
  rating: number;
  /** Movable block height, vertical velocity, and sideways offset once swinging. */
  height = LOAD_START;
  velocity = 0;
  x = 0;
  sideways = 0;
  /** Free-end height, velocity, and the height it is steering toward. */
  hand = HAND_START;
  handVelocity = 0;
  target = HAND_START;
  /** Tension in each strand during the last step, in newtons. */
  tension = 0;
  slack = false;
  grounded = false;
  /** Tension averaged over the last SHOCK_STEPS steps. */
  shock = 0;
  snapped = false;
  /** Locked lanyard length after a snap, and its tension in the last step. */
  lanyard = 0;
  lanyardTension = 0;
  private readonly shocks = new Float64Array(SHOCK_STEPS);
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
    this.rating = options.rating ?? Infinity;
    if (!(this.rating > 0)) throw new Error('Invalid pulley configuration.');
    this.angles = new Float64Array(strands);
    this.reach = strands * LOAD_START + HAND_START;
    this.handMin = Math.max(HAND_MIN, this.reach - strands * LOAD_CEILING);
    this.tension = this.restTension;
    this.shocks.fill(this.tension);
    this.shock = this.tension;
  }

  /** Averaged tension as a fraction of the rope rating. */
  get strain() {
    return this.shock / this.rating;
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
    return 0.5 * this.totalMass * (this.velocity ** 2 + this.sideways ** 2);
  }

  setTarget(y: number) {
    this.target = Math.min(HAND_MAX, Math.max(this.handMin, y));
  }
  /** Draws `distance` metres of rope in at the free end (negative lets it out). */
  pullBy(distance: number) {
    this.setTarget(this.target - distance);
  }

  step() {
    const dt = PULLEY_STEP;
    // Hand: a speed profile that can stop in the remaining distance.
    const e = this.target - this.hand,
      wanted =
        Math.sign(e) *
        Math.min(
          HAND_SPEED,
          Math.sqrt(2 * HAND_ACCEL * Math.abs(e)),
          HAND_GAIN * Math.abs(e),
        );
    let du = wanted - this.handVelocity;
    // Letting rope run upward is instant; everything else is limited.
    if (!(e > 0 && du > 0))
      du = Math.min(HAND_ACCEL * dt, Math.max(-HAND_ACCEL * dt, du));
    let u = this.handVelocity + du;
    let y = this.hand + u * dt;
    if (y < this.handMin || y > HAND_MAX) {
      y = Math.min(HAND_MAX, Math.max(this.handMin, y));
      u = 0;
    }
    if (this.snapped) this.swing(dt);
    else this.lift(y, dt);
    this.hand = y;
    this.handVelocity = u;
    this.steps++;
    this.time = this.steps * PULLEY_STEP;
  }

  private lift(y: number, dt: number) {
    const n = this.strands;
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
    const slot = this.steps % SHOCK_STEPS;
    this.shock += (this.tension - this.shocks[slot]) / SHOCK_STEPS;
    this.shocks[slot] = this.tension;
    if (this.shock > this.rating) this.snap();
  }

  /** Breaks the rope; the lanyard locks just beyond its current reach. */
  snap() {
    if (this.snapped) return;
    this.snapped = true;
    this.slack = true;
    this.tension = 0;
    this.shock = 0;
    this.lanyard =
      Math.hypot(this.x - this.geometry.lanyardX, this.height - BEAM_Y) +
      LANYARD_SLACK;
  }

  /** Free fall held by the locked lanyard: a pendulum that can go slack. */
  private swing(dt: number) {
    const ax = this.geometry.lanyardX,
      drag = 1 - SWING_DRAG * dt;
    let vx = this.sideways * drag,
      vy = (this.velocity - this.gravity * dt) * drag;
    let x = this.x + vx * dt,
      h = this.height + vy * dt;
    this.lanyardTension = 0;
    const dx = x - ax,
      dy = h - BEAM_Y,
      d = Math.hypot(dx, dy);
    if (d > this.lanyard) {
      const rx = dx / d,
        ry = dy / d;
      x = ax + rx * this.lanyard;
      h = BEAM_Y + ry * this.lanyard;
      // Remove the outward velocity; the lanyard's impulse gives its tension.
      const outward = vx * rx + vy * ry;
      if (outward > 0) {
        vx -= outward * rx;
        vy -= outward * ry;
        this.lanyardTension = (this.totalMass * outward) / dt;
      }
    }
    this.grounded = false;
    if (h <= LOAD_FLOOR) {
      h = LOAD_FLOOR;
      vy = Math.max(0, vy);
      vx *= 1 - FLOOR_FRICTION * dt;
      this.grounded = true;
    }
    this.x = x;
    this.height = h;
    this.sideways = vx;
    this.velocity = vy;
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
  if (system.snapped) {
    // The rope has run out through the sheaves; its broken end still hangs
    // over the last fixed sheave, down to the free end.
    const last = sheaves[sheaves.length - 1];
    line(last.x - r, FIXED_Y - 1.1, last.x - r, FIXED_Y);
    arc(last.x, FIXED_Y, Math.PI, 0);
    line(handX, FIXED_Y, handX, y);
    return out;
  }
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
  setLoad(mass: number, gravity: number, rating = Infinity) {
    for (const r of this.rigs) {
      r.mass = mass;
      r.gravity = gravity;
      r.rating = rating;
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
