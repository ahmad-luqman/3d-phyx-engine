import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAB_BOTTOM,
  CAB_MASS,
  CAB_TOP,
  CHIME_SPEED,
  CounterweightLift,
  GUIDE_FRICTION,
  SHEAVE_MASS,
  SHEAVE_RADIUS,
  STRIKE_REBOUND,
  verdict,
} from '../lib/lift';
const g = 9.81;
const close = (a: number, b: number, eps: number, what: string) =>
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

void test('a released lift accelerates like an Atwood machine with friction', () => {
  const lift = new CounterweightLift({
    cargo: 20,
    counterweight: 90,
    gravity: g,
  });
  lift.release();
  lift.advance(0.5);
  const cab = CAB_MASS + 20,
    expected =
      ((90 - cab) * g - GUIDE_FRICTION * (cab + 90) * g) /
      (cab + 90 + SHEAVE_MASS);
  close(lift.velocity, expected * 0.5, 1e-9, 'velocity');
  close(lift.tension, cab * (g + expected), 1e-9, 'cab rope tension');
  // The rope rolls over the sheave without slipping.
  close(-lift.angle * SHEAVE_RADIUS, lift.height - CAB_BOTTOM, 1e-9, 'sheave');
});

void test('the brake holds, and an imbalance inside friction never starts', () => {
  const braked = new CounterweightLift({
    cargo: 0,
    counterweight: 120,
    gravity: g,
  });
  braked.advance(2);
  assert.equal(braked.height, CAB_BOTTOM);
  // 2 kg of imbalance is less than 3% of the 82 kg total weight.
  const balanced = new CounterweightLift({
    cargo: 0,
    counterweight: 42,
    gravity: g,
  });
  balanced.release();
  balanced.advance(2);
  assert.equal(balanced.height, CAB_BOTTOM);
  assert.equal(balanced.velocity, 0);
  // A lighter counterweight leaves the cab resting on its buffer.
  const light = new CounterweightLift({
    cargo: 20,
    counterweight: 50,
    gravity: g,
  });
  light.release();
  light.advance(2);
  assert.equal(light.height, CAB_BOTTOM);
  close(light.tension, 50 * g, 1e-9, 'rope carries the counterweight');
});

void test('the cab rings the bell at its arrival speed and rebounds', () => {
  const lift = new CounterweightLift({
    cargo: 20,
    counterweight: 70,
    gravity: g,
  });
  const a = lift.acceleration(1);
  lift.release();
  let first = 0;
  lift.advance(10, () => {
    if (lift.rings === 1 && !first) first = lift.arrival;
  });
  // Constant acceleration over the full travel, to within one step.
  close(first, Math.sqrt(2 * a * (CAB_TOP - CAB_BOTTOM)), 0.02, 'arrival');
  assert.equal(verdict(first), 'ring');
  assert.ok(lift.rings >= 2, `rebound rings: ${lift.rings}`);
  assert.ok(lift.arrival < first * STRIKE_REBOUND * 1.01);
  // The heavier counterweight keeps the cab pressed to the striker.
  lift.advance(4);
  assert.equal(lift.height, CAB_TOP);
  assert.equal(lift.velocity, 0);
});

void test('a well-balanced lift arrives slowly enough to chime', () => {
  const lift = new CounterweightLift({
    cargo: 20,
    counterweight: 65,
    gravity: g,
  });
  lift.release();
  lift.advance(20);
  assert.ok(lift.rings >= 1);
  assert.ok(lift.rings > 0 && lift.arrival < CHIME_SPEED);
  assert.equal(verdict(0.5), 'chime');
  assert.equal(verdict(5), 'slam');
});

void test('sending the cab down winds it to the buffer and sets the brake', () => {
  const lift = new CounterweightLift({
    cargo: 20,
    counterweight: 90,
    gravity: g,
  });
  lift.release();
  lift.advance(6);
  lift.sendDown();
  lift.advance(6);
  assert.equal(lift.height, CAB_BOTTOM);
  assert.equal(lift.braked, true);
  assert.equal(lift.winding, false);
  lift.advance(1);
  assert.equal(lift.height, CAB_BOTTOM);
});

void test('lift results are independent of the rendering cadence', () => {
  const run = (fps: number) => {
    const lift = new CounterweightLift({
      cargo: 30,
      counterweight: 100,
      gravity: g,
    });
    lift.release();
    for (let i = 0; i < 5 * fps; i++) lift.advance(1 / fps);
    return lift;
  };
  const a = run(60),
    b = run(144);
  assert.equal(a.steps, b.steps);
  assert.equal(a.height, b.height);
  assert.equal(a.rings, b.rings);
  assert.equal(a.arrival, b.arrival);
});
