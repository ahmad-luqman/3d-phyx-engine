/**
 * Counterweight lift: a cab and a counterweight hang from either side of one
 * large sheave (an Atwood machine). With the brake released the heavier side
 * wins, less guide-rail friction:
 *   a = ((m_cw − m_cab)·g − f) / (m_cab + m_cw + I/r²),  f = μ·(m_cab + m_cw)·g
 * If the imbalance cannot beat friction, a stopped cab stays put. A buffer
 * stops the cab at the bottom; at the top it hits a striker that rings the
 * bell with the arrival speed and hands back a quarter of it as rebound.
 * Fixed 1/240 s steps keep results independent of the rendering cadence.
 */
export const LIFT_STEP = 1 / 240;
export const SHEAVE_RADIUS = 0.7;
export const SHEAVE_Y = 8.6;
/** Cab floor height at the bottom buffer and at the bell striker. */
export const CAB_BOTTOM = 0.1;
export const CAB_TOP = 5.7;
export const CAB_HEIGHT = 2;
export const CAB_MASS = 40;
/** Sheave rotational inertia expressed as an equivalent rim mass, I/r². */
export const SHEAVE_MASS = 6;
/** Guide-rail friction as a fraction of the total weight. */
export const GUIDE_FRICTION = 0.03;
export const STRIKE_REBOUND = 0.25;
/** Arrivals slower than this chime; faster than SLAM_SPEED they slam. */
export const CHIME_SPEED = 1.5;
export const SLAM_SPEED = 3.5;
/** Arrivals slower than this rest on the striker rather than ring. */
const RING_THRESHOLD = 0.2;
/** Speed the winch sends the cab back down at. */
export const WIND_SPEED = 1.2;

export type Verdict = 'chime' | 'ring' | 'slam';
export type LiftOptions = {
  cargo: number;
  counterweight: number;
  gravity: number;
};

export function verdict(speed: number): Verdict {
  return speed < CHIME_SPEED ? 'chime' : speed < SLAM_SPEED ? 'ring' : 'slam';
}

export class CounterweightLift {
  cargo: number;
  counterweight: number;
  gravity: number;
  /** Cab floor height and velocity (up positive). */
  height = CAB_BOTTOM;
  velocity = 0;
  braked = true;
  winding = false;
  /** Cab acceleration and the rope tension at the cab in the last step. */
  accel = 0;
  tension = 0;
  /** Sheave rotation; the rope rolls over it without slipping. */
  angle = 0;
  rings = 0;
  /** Speed of the latest arrival that rang the bell. */
  arrival = 0;
  time = 0;
  steps = 0;
  private remainder = 0;

  constructor(options: LiftOptions) {
    if (
      !(options.cargo >= 0) ||
      !(options.counterweight > 0) ||
      !(options.gravity >= 0)
    )
      throw new Error('Invalid lift configuration.');
    this.cargo = options.cargo;
    this.counterweight = options.counterweight;
    this.gravity = options.gravity;
    this.tension = this.restingTension();
  }

  get cabMass() {
    return CAB_MASS + this.cargo;
  }
  /** Counterweight top, which falls as the cab rises. */
  get counterweightTop() {
    return CAB_BOTTOM + CAB_TOP + CAB_HEIGHT - this.height - 0.1;
  }
  /** Rope tension at the counterweight; the sheave's inertia takes the rest. */
  get counterweightTension() {
    return this.counterweight * (this.gravity - this.accel);
  }
  get kinetic() {
    return (
      0.5 *
      (this.cabMass + this.counterweight + SHEAVE_MASS) *
      this.velocity ** 2
    );
  }
  /** Acceleration the free machine would have if moving in `direction`. */
  acceleration(direction: number) {
    const g = this.gravity,
      net = (this.counterweight - this.cabMass) * g,
      friction =
        GUIDE_FRICTION * (this.cabMass + this.counterweight) * g * direction;
    return (net - friction) / (this.cabMass + this.counterweight + SHEAVE_MASS);
  }

  release() {
    this.braked = false;
    this.winding = false;
  }
  hold() {
    this.braked = true;
    this.winding = false;
    this.velocity = 0;
  }
  sendDown() {
    this.braked = false;
    this.winding = true;
  }

  /** Rope tension at the cab while it is not accelerating. */
  private restingTension() {
    const onBuffer = this.height <= CAB_BOTTOM + 1e-9;
    // Resting on the buffer, the rope carries at most the counterweight.
    return (
      (onBuffer ? Math.min(this.cabMass, this.counterweight) : this.cabMass) *
      this.gravity
    );
  }

  step() {
    const dt = LIFT_STEP,
      before = this.height;
    this.accel = 0;
    if (this.winding) {
      this.velocity = -WIND_SPEED;
      this.height -= WIND_SPEED * dt;
      if (this.height <= CAB_BOTTOM) {
        this.height = CAB_BOTTOM;
        this.hold();
      }
      this.tension = this.restingTension();
    } else if (this.braked) {
      this.velocity = 0;
      this.tension = this.restingTension();
    } else this.run(dt);
    this.angle -= (this.height - before) / SHEAVE_RADIUS;
    this.steps++;
    this.time = this.steps * LIFT_STEP;
  }

  private run(dt: number) {
    const g = this.gravity,
      net = (this.counterweight - this.cabMass) * g,
      friction = GUIDE_FRICTION * (this.cabMass + this.counterweight) * g;
    let v = this.velocity,
      a = 0;
    if (v !== 0) {
      a = this.acceleration(Math.sign(v));
      // Friction can stop the cab but never reverse it.
      if (Math.sign(v + a * dt) !== Math.sign(v) && Math.abs(net) <= friction)
        a = -v / dt;
    } else if (Math.abs(net) > friction) a = this.acceleration(Math.sign(net));
    // The buffer and striker hold the cab against a push into them.
    if (this.height <= CAB_BOTTOM && v === 0 && a < 0) a = 0;
    if (this.height >= CAB_TOP && v === 0 && a > 0) a = 0;
    v += a * dt;
    let h = this.height + v * dt;
    this.accel = a;
    this.tension = this.cabMass * (g + a);
    if (h <= CAB_BOTTOM) {
      h = CAB_BOTTOM;
      v = 0;
      this.accel = 0;
      this.tension = Math.min(this.cabMass, this.counterweight) * g;
    } else if (h >= CAB_TOP) {
      h = CAB_TOP;
      if (v > RING_THRESHOLD) {
        this.rings++;
        this.arrival = v;
        v = -STRIKE_REBOUND * v;
      } else v = 0;
    }
    this.height = h;
    this.velocity = v;
  }

  advance(seconds: number, onStep?: () => void) {
    if (!Number.isFinite(seconds) || seconds < 0)
      throw new Error('Elapsed time must be finite and nonnegative.');
    this.remainder += seconds;
    while (this.remainder + 1e-12 >= LIFT_STEP) {
      this.step();
      this.remainder = Math.max(0, this.remainder - LIFT_STEP);
      onStep?.();
    }
  }
}
