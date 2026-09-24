import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create } from '@react-three/test-renderer';
import type { LineBasicMaterial, LineSegments } from 'three';
import { FieldLoom, particleCount } from '../components/lab/loom';
import { defaults, type Command, type Metrics } from '../lib/lab';
import {
  FieldLines,
  FluxParticles,
  MagneticField,
  MAGNET_Y,
  POLE_OFFSET,
  magnetLayout,
  type MagnetState,
} from '../lib/magnetism';
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  window: Object.assign(new EventTarget(), {
    performance: globalThis.performance,
  }),
});
const magnet = (x: number, z: number, heading = 0): MagnetState => ({
  x,
  z,
  heading,
  polarity: 1,
  moment: 1,
  flip: 1,
});
const b = new Float64Array(3);

void test('bar magnets are two inverse-square poles and fields superpose', () => {
  const field = new MagneticField([magnet(0, 0)]);
  // Far along the axis the two poles act like a dipole: |B| ∝ 1/r³.
  const near = field.field(20, MAGNET_Y, 0, b),
    far = field.field(40, MAGNET_Y, 0, b);
  assert.ok(Math.abs(near / far - 8) < 0.1, `dipole falloff ${near / far}`);
  // Matches the analytic sum of two opposite point charges at the tips.
  const p0 = [0.9, 2.2, 0.6] as const,
    expected = [0, 0, 0];
  for (const [q, tip] of [
    [1, POLE_OFFSET],
    [-1, -POLE_OFFSET],
  ]) {
    const r = [p0[0] - tip, p0[1] - MAGNET_Y, p0[2]],
      d2 = r[0] ** 2 + r[1] ** 2 + r[2] ** 2 + 0.08 ** 2;
    for (let k = 0; k < 3; k++) expected[k] += (q * r[k]) / d2 ** 1.5;
  }
  field.field(...p0, b);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(b[k] - expected[k]) < 1e-12);
  const pair = new MagneticField([magnet(-2, 0), magnet(2, 1.5, 1)]);
  const single = [
    new MagneticField([magnet(-2, 0)]),
    new MagneticField([magnet(2, 1.5, 1)]),
  ];
  const p = [0.4, 2.1, -0.7] as const,
    sum = [0, 0, 0];
  for (const f of single) {
    f.field(...p, b);
    for (let k = 0; k < 3; k++) sum[k] += b[k];
  }
  pair.field(...p, b);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(b[k] - sum[k]) < 1e-12);
});

void test('a completed flip negates the field everywhere', () => {
  const field = new MagneticField([magnet(0, 0, 0.4)]);
  const before = new Float64Array(3);
  field.field(1.3, 2, -0.9, before);
  field.flip(0);
  field.advance(0.3);
  assert.ok(field.flipping);
  assert.ok(Math.abs(field.magnets[0].moment) < 1);
  field.advance(5);
  assert.equal(field.flipping, false);
  assert.equal(field.magnets[0].moment, -1);
  field.field(1.3, 2, -0.9, b);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(b[k] + before[k]) < 1e-12);
});

void test('lines from a lone bar magnet leave its source tip and return to its sink', () => {
  const field = new MagneticField([magnet(0, 0)]);
  const lines = new FieldLines(24, 400);
  lines.retrace(field);
  assert.ok(lines.lines >= 10);
  const start = new Float64Array(3),
    ends: Record<string, number> = {};
  for (const [dx, dy, dz] of [
    [0.05, 0.2, 0],
    [0, 0.14, 0.14],
    [0.08, -0.02, 0.2],
  ]) {
    start.set([POLE_OFFSET + dx, MAGNET_Y + dy, dz]);
    const end = lines.trace(field, start);
    const key = end.kind === 'sink' ? `sink:${end.magnet}` : end.kind;
    ends[key] = (ends[key] ?? 0) + 1;
  }
  assert.deepEqual(ends, { 'sink:0': 3 });
});

void test('flipping a partner reconnects lines: facing N→S links, facing N→N does not', () => {
  const field = new MagneticField(magnetLayout(2));
  const lines = new FieldLines();
  lines.retrace(field);
  assert.ok(lines.linked >= 3, `linked before flip: ${lines.linked}`);
  field.flip(1);
  field.advance(5);
  lines.retrace(field);
  assert.equal(lines.linked, 0);
  field.flip(1);
  field.advance(5);
  lines.retrace(field);
  assert.ok(lines.linked >= 3);
});

void test('flux particles are deterministic, cadence-independent, and stay in bounds', () => {
  const run = (frames: number) => {
    const particles = new FluxParticles(
      new MagneticField(magnetLayout(3)),
      200,
    );
    for (let i = 0; i < frames; i++) particles.advance(3 / frames);
    return particles;
  };
  const a = run(180),
    c = run(90);
  assert.equal(a.steps, c.steps);
  assert.deepEqual(a.positions, c.positions);
  assert.ok(a.positions.every(Number.isFinite));
  for (let i = 0; i < a.count; i++) {
    const [x, y, z] = a.positions.subarray(i * 3, i * 3 + 3);
    assert.ok(y >= 0 && Math.hypot(x, y - MAGNET_Y, z) <= 12.5);
  }
});

void test('loom scene mounts, retraces on commands, and freezes when paused', async () => {
  let latest: Metrics | undefined,
    settings = defaults('loom'),
    command: Command = { id: 0, action: 'flip' };
  const element = () => (
    <FieldLoom
      settings={settings}
      command={command}
      onMetrics={(m) => {
        latest = m;
      }}
    />
  );
  const renderer = await create(element());
  try {
    const flux = () =>
      renderer.scene.findByProps({ name: 'flux-particles' })
        .instance as LineSegments;
    const threads = () =>
      renderer.scene.findByProps({ name: 'field-threads' })
        .instance as LineSegments;
    assert.equal(
      flux().geometry.getAttribute('position').count,
      particleCount('auto') * 2,
    );
    assert.ok((threads().material as LineBasicMaterial).vertexColors);
    await renderer.advanceFrames(30, 1 / 60);
    assert.ok(latest?.loom);
    assert.equal(latest.bodies, 2);
    assert.ok(latest.loom.linked >= 3);
    assert.equal(latest.loom.selected, 1);
    command = { id: 1, action: 'flip' };
    await renderer.update(element());
    await renderer.advanceFrames(120, 1 / 60);
    assert.equal(latest.loom.linked, 0);
    settings = { ...settings, paused: true };
    await renderer.update(element());
    const before = flux().geometry.getAttribute('position').array.slice();
    await renderer.advanceFrames(20, 1 / 60);
    assert.deepEqual(flux().geometry.getAttribute('position').array, before);
    settings = { ...settings, magnetCount: 4, quality: 'low', paused: false };
    await renderer.update(element());
    await renderer.advanceFrames(30, 1 / 60);
    assert.equal(latest.bodies, 4);
    assert.equal(latest.loom.particles, particleCount('low'));
    assert.equal(
      flux().geometry.getAttribute('position').count,
      particleCount('low') * 2,
    );
  } finally {
    await renderer.unmount();
  }
});
