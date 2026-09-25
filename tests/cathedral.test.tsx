import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create } from '@react-three/test-renderer';
import type { Mesh } from 'three';
import { PulleyCathedral } from '../components/lab/cathedral';
import { defaults, type Command, type Metrics } from '../lib/lab';
import {
  HAND_MAX,
  LOAD_FLOOR,
  PULLEY_MASS,
  PulleySystem,
  pathLength,
  ropePath,
} from '../lib/pulley';
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  window: Object.assign(new EventTarget(), {
    performance: globalThis.performance,
  }),
});
const g = 9.81;
const close = (a: number, b: number, eps: number, what: string) =>
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

void test('pulling 2 m of rope raises the load exactly 1 m on a taut rope', () => {
  const system = new PulleySystem({ mass: 20, gravity: g });
  const length = system.ropeLength(),
    drawn = pathLength(ropePath(system));
  system.pullBy(2);
  system.advance(3);
  close(system.pulled, 2, 1e-9, 'pulled');
  close(system.raised, 1, 1e-9, 'raised');
  assert.equal(system.slack, false);
  close(system.ropeLength(), length, 1e-9, 'rope length');
  close(pathLength(ropePath(system)), drawn, 1e-9, 'drawn rope length');
});

void test('each strand carries half the weight at rest and more while lifting', () => {
  const system = new PulleySystem({ mass: 20, gravity: g });
  system.advance(1);
  const rest = ((20 + PULLEY_MASS) * g) / 2;
  close(system.tension, rest, 1e-9, 'rest tension');
  system.pullBy(2);
  let peak = 0;
  system.advance(0.1, () => (peak = Math.max(peak, system.tension)));
  assert.ok(peak > rest * 1.2, `accelerating tension ${peak}`);
  system.advance(3);
  close(system.tension, rest, 1e-6, 'settled tension');
});

void test('wheels turn in a 2:1 ratio while the rope is taut', () => {
  const system = new PulleySystem({ mass: 20, gravity: g });
  system.pullBy(3);
  system.advance(2);
  assert.ok(system.movableAngle > 0.5);
  close(system.fixedAngle, -2 * system.movableAngle, 1e-9, 'wheel ratio');
});

void test('letting rope out fast goes slack, then the rope catches the load', () => {
  const system = new PulleySystem({ mass: 20, gravity: g });
  system.pullBy(4);
  system.advance(3);
  system.pullBy(-3);
  let sawSlack = false,
    slackTension = Infinity,
    peak = 0;
  system.advance(2, () => {
    if (system.slack) {
      sawSlack = true;
      slackTension = Math.min(slackTension, system.tension);
    }
    peak = Math.max(peak, system.tension);
  });
  const rest = ((20 + PULLEY_MASS) * g) / 2;
  assert.ok(sawSlack, 'rope never went slack');
  assert.equal(slackTension, 0);
  assert.ok(peak > rest * 2, `catch spike ${peak}`);
  system.advance(3);
  assert.equal(system.slack, false);
  close(system.raised, system.pulled / 2, 1e-9, 'ratio after catch');
  close(system.tension, rest, 1e-6, 'tension after catch');
});

void test('an unloaded rope lets the crate rest on the floor', () => {
  const system = new PulleySystem({ mass: 20, gravity: g });
  system.setTarget(HAND_MAX);
  system.advance(3);
  assert.equal(system.height, LOAD_FLOOR);
  assert.ok(system.grounded && system.slack);
  assert.equal(system.tension, 0);
});

void test('results are independent of the rendering cadence', () => {
  const run = (fps: number) => {
    const system = new PulleySystem({ mass: 35, gravity: g });
    system.pullBy(2.5);
    for (let i = 0; i < 3 * fps; i++) system.advance(1 / fps);
    return system;
  };
  const a = run(60),
    b = run(144);
  assert.equal(a.steps, b.steps);
  assert.equal(a.height, b.height);
  assert.equal(a.hand, b.hand);
  assert.equal(a.tension, b.tension);
});

void test('cathedral scene pulls on command, freezes when paused, and follows load mass', async () => {
  let latest: Metrics | undefined,
    settings = defaults('cathedral'),
    command: Command = { id: 0, action: 'pull' };
  const element = () => (
    <PulleyCathedral
      settings={settings}
      command={command}
      onMetrics={(m) => {
        latest = m;
      }}
    />
  );
  const renderer = await create(element());
  try {
    const rope = () =>
      renderer.scene.findByProps({ name: 'pulley-rope' }).instance as Mesh;
    await renderer.advanceFrames(30, 1 / 60);
    assert.ok(latest?.pulley);
    assert.ok(rope().geometry.getAttribute('position').count > 100);
    close(latest.pulley.pulled, 0, 1e-9, 'initial pull');
    command = { id: 1, action: 'pull' };
    await renderer.update(element());
    await renderer.advanceFrames(180, 1 / 60);
    close(latest.pulley.pulled, 2, 1e-6, 'pulled');
    close(latest.pulley.raised, 1, 1e-6, 'raised');
    settings = { ...settings, paused: true };
    await renderer.update(element());
    const before = rope().geometry.getAttribute('position').array.slice();
    command = { id: 2, action: 'pull' };
    await renderer.update(element());
    await renderer.advanceFrames(30, 1 / 60);
    assert.deepEqual(rope().geometry.getAttribute('position').array, before);
    settings = { ...settings, paused: false, loadMass: 60 };
    await renderer.update(element());
    await renderer.advanceFrames(240, 1 / 60);
    close(latest.pulley.pulled, 4, 1e-6, 'queued pull');
    close(latest.pulley.tension, ((60 + PULLEY_MASS) * g) / 2, 1e-6, 'heavy');
  } finally {
    await renderer.unmount();
  }
});
