/**
 * Planar 2:1 block and tackle. The rope runs from a ceiling anchor, under the
 * movable pulley, over the fixed pulley, and down to the free end (the hand).
 *
 * The rope is inextensible but can go slack, so it is a one-sided constraint:
 *   2·h + y_hand ≥ C   (h = movable pulley centre, C fixed by the rope length)
 * Taut: the load follows h = (C − y_hand) / 2, so pulling 2 m raises it 1 m and
 * both strands carry T = M(g + a) / 2. Slack: T = 0 and the load falls freely.
 * The hand is a stiff, speed-limited follower of its target so a fast pointer
 * flick produces a finite tension spike. Fixed 1/240 s steps keep results
 * independent of the rendering cadence.
 */
export const PULLEY_STEP = 1 / 240;
export const WHEEL_RADIUS = 0.45;
export const BEAM_Y = 9;
/** Fixed pulley centre. The movable pulley hangs directly below x = 0. */
export const FIXED_X = 2 * WHEEL_RADIUS;
export const FIXED_Y = 8.3;
export const ANCHOR_X = -WHEEL_RADIUS;
export const HAND_X = FIXED_X + WHEEL_RADIUS;
export const HAND_MIN = 0.6;
export const HAND_MAX = FIXED_Y - WHEEL_RADIUS - 0.15;
export const HAND_START = 7.2;
/** Crate hangs below the movable pulley; this is where it meets the floor. */
export const CRATE_DROP = 1.25;
export const CRATE_SIZE = 1.1;
export const LOAD_FLOOR = CRATE_DROP + CRATE_SIZE / 2;
export const LOAD_START = 2;
export const PULLEY_MASS = 2;
const HAND_STIFFNESS = 400;
const HAND_DAMPING = 2 * Math.sqrt(HAND_STIFFNESS);
const HAND_SPEED = 5;
const SLACK_EPSILON = 1e-9;

export type PulleyOptions = { mass: number; gravity: number };

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
  mass: number;
  gravity: number;
  /** Movable pulley height and velocity. */
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
  fixedAngle = 0;
  movableAngle = 0;
  time = 0;
  steps = 0;
  readonly reach = 2 * LOAD_START + HAND_START;
  private remainder = 0;

  constructor(options: PulleyOptions) {
    if (
      !Number.isFinite(options.mass) ||
      options.mass <= 0 ||
      !Number.isFinite(options.gravity) ||
      options.gravity < 0
    )
      throw new Error('Invalid pulley configuration.');
    this.mass = options.mass;
    this.gravity = options.gravity;
    this.tension = this.restTension;
  }

  /** Load plus movable pulley. */
  get totalMass() {
    return this.mass + PULLEY_MASS;
  }
  get restTension() {
    return (this.totalMass * this.gravity) / 2;
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
    return Math.max(0, 2 * this.height + this.hand - this.reach);
  }
  get kinetic() {
    return 0.5 * this.totalMass * this.velocity ** 2;
  }

  setTarget(y: number) {
    this.target = Math.min(HAND_MAX, Math.max(HAND_MIN, y));
  }
  /** Draws `distance` metres of rope in at the free end (negative lets it out). */
  pullBy(distance: number) {
    this.setTarget(this.target - distance);
  }

  step() {
    const dt = PULLEY_STEP;
    // Hand: a critically damped spring toward the target with a speed cap.
    let u =
      this.handVelocity +
      (HAND_STIFFNESS * (this.target - this.hand) -
        HAND_DAMPING * this.handVelocity) *
        dt;
    u = Math.min(HAND_SPEED, Math.max(-HAND_SPEED, u));
    let y = this.hand + u * dt;
    if (y < HAND_MIN || y > HAND_MAX) {
      y = Math.min(HAND_MAX, Math.max(HAND_MIN, y));
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
      limit = (this.reach - y) / 2;
    if (h < limit) {
      h = limit;
      const rope = (h - this.height) / dt;
      v = wasSlack ? Math.max(rope, catchVelocity(free, rope)) : rope;
      this.grounded = false;
    }
    // Each of the two supporting strands carries half the rope impulse.
    this.tension = Math.max(0, (this.totalMass * (v - free)) / (2 * dt));
    this.slack = 2 * h + y - this.reach > SLACK_EPSILON;
    this.fixedAngle += (u / WHEEL_RADIUS) * dt;
    this.movableAngle += (v / WHEEL_RADIUS) * dt;
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
    return (
      BEAM_Y -
      this.height +
      Math.PI * WHEEL_RADIUS +
      (FIXED_Y - this.height) +
      Math.PI * WHEEL_RADIUS +
      (FIXED_Y - this.hand) +
      this.gap
    );
  }
}

/**
 * Rope centreline as flat x, y pairs: anchor → under the movable pulley →
 * over the fixed pulley → hand. Slack rope bows out along the free strand.
 */
export function ropePath(system: PulleySystem, out: number[] = []) {
  out.length = 0;
  const r = WHEEL_RADIUS,
    h = system.height,
    y = system.hand;
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
  line(ANCHOR_X, BEAM_Y, -r, h);
  arc(0, h, Math.PI, 2 * Math.PI);
  line(r, h, FIXED_X - r, FIXED_Y);
  arc(FIXED_X, FIXED_Y, Math.PI, 0);
  // Half a sine of amplitude a adds ≈ π²a² / 4L of length to a span L.
  const span = Math.max(0.01, FIXED_Y - y),
    bow = Math.min(1.2, (2 / Math.PI) * Math.sqrt(system.gap * span));
  line(HAND_X, FIXED_Y, HAND_X, y, bow);
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
