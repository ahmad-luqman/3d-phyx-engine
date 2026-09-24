import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PendulumEnsemble,
  PENDULUM_LENGTH,
  PENDULUM_PIVOT,
} from '../lib/pendulum';
const options = { count: 50, angle: 135, separation: 0.0001, gravity: 9.81 };
void test('double pendulum preserves rod lengths and energy through chaotic motion', () => {
  const model = new PendulumEnsemble(options);
  let maximumDrift = 0;
  for (let i = 0; i < 240 * 60; i++) {
    model.step();
    if (i % 60 !== 0) continue;
    const p = model.points(0);
    assert.ok(
      Math.abs(Math.hypot(p.x1, p.y1 - PENDULUM_PIVOT) - PENDULUM_LENGTH) <
        1e-12,
    );
    assert.ok(
      Math.abs(Math.hypot(p.x2 - p.x1, p.y2 - p.y1) - PENDULUM_LENGTH) < 1e-12,
    );
    maximumDrift = Math.max(
      maximumDrift,
      Math.abs(model.energy(0).total - model.initialEnergy),
    );
  }
  assert.ok(maximumDrift < 0.001, `energy drift ${maximumDrift} J`);
  assert.ok(model.state.every(Number.isFinite));
});
void test('identical initial conditions remain identical and tiny differences diverge', () => {
  const identical = new PendulumEnsemble({ ...options, separation: 0 });
  identical.advance(30);
  assert.equal(identical.separation(), 0);
  const ghosts = new PendulumEnsemble(options);
  const initial = ghosts.separation();
  assert.ok(initial > 0 && initial < 0.001);
  ghosts.advance(20);
  assert.ok(
    ghosts.separation() > initial * 100,
    `divergence: ${ghosts.separation()}`,
  );
});
void test('fixed stepping is independent of rendering cadence and reset is reproducible', () => {
  const a = new PendulumEnsemble(options),
    b = new PendulumEnsemble(options);
  for (let i = 0; i < 300; i++) a.advance(1 / 30);
  for (let i = 0; i < 1200; i++) b.advance(1 / 120);
  assert.equal(a.time, 10);
  assert.deepEqual(a.state, b.state);
  const replay = new PendulumEnsemble(options);
  replay.advance(10);
  assert.deepEqual(replay.state, a.state);
});
void test('zero gravity and zero speed leave release state unchanged', () => {
  const model = new PendulumEnsemble({ ...options, gravity: 0 });
  const initial = model.state.slice();
  model.advance(20);
  assert.deepEqual(model.state, initial);
  const normal = new PendulumEnsemble(options);
  normal.advance(0);
  assert.equal(normal.steps, 0);
});
