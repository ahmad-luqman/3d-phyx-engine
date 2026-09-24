import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create } from '@react-three/test-renderer';
import type { InstancedMesh, LineSegments, ShaderMaterial } from 'three';
import { PendulumGhosts } from '../components/lab/ghosts';
import { defaults, type Command, type Metrics } from '../lib/lab';
import { GhostTrailHistory } from '../lib/ghost-trails';
import { PendulumEnsemble } from '../lib/pendulum';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
void test('ghost scene mounts fifty pairs with a real precomputed trajectory history', async () => {
  let latest: Metrics | undefined;
  const renderer = await create(
    <PendulumGhosts
      settings={defaults('ghosts')}
      command={{ id: 0, action: 'trigger' }}
      onMetrics={(m) => {
        latest = m;
      }}
    />,
  );
  try {
    const bobs = renderer.scene.findByProps({ name: 'ghost-bobs' })
      .instance as InstancedMesh;
    const trails = renderer.scene.findByProps({ name: 'ghost-trajectories' })
      .instance as LineSegments;
    assert.equal(bobs.count, 100);
    assert.equal(trails.geometry.getAttribute('position').count, 50 * 720 * 2);
    assert.ok(
      trails.geometry.getAttribute('position').array.every(Number.isFinite),
    );
    await renderer.advanceFrames(30, 1 / 60);
    assert.ok(latest);
    assert.ok(latest.ghosts!.elapsed > 20);
    assert.ok(latest.ghosts!.separation > 0.5);
    assert.ok(latest.ghosts!.energyDrift < 0.001);
  } finally {
    await renderer.unmount();
  }
});
void test('pause freezes trails, replay resets, and a time jump advances the physics', async () => {
  let settings = defaults('ghosts'),
    command: Command = { id: 0, action: 'trigger' };
  const element = () => (
    <PendulumGhosts
      settings={settings}
      command={command}
      onMetrics={() => {}}
    />
  );
  const renderer = await create(element());
  try {
    const trails = () =>
      renderer.scene.findByProps({ name: 'ghost-trajectories' })
        .instance as LineSegments;
    await renderer.advanceFrames(1, 1 / 60);
    settings = { ...settings, paused: true };
    await renderer.update(element());
    const before = trails().geometry.getAttribute('position').array.slice();
    const material = trails().material as ShaderMaterial,
      time = material.uniforms.uTime.value;
    await renderer.advanceFrames(30, 1 / 60);
    assert.equal(material.uniforms.uTime.value, time);
    assert.deepEqual(trails().geometry.getAttribute('position').array, before);
    command = { id: 1, action: 'clear-trails' };
    await renderer.update(element());
    await renderer.advanceFrames(1, 1 / 60);
    assert.ok(
      trails()
        .geometry.getAttribute('born')
        .array.every((v) => v === -1e6),
    );
    assert.equal(material.uniforms.uTime.value, time);
    command = { id: 2, action: 'trigger' };
    await renderer.update(element());
    await renderer.advanceFrames(1, 1 / 60);
    assert.equal(material.uniforms.uTime.value, 0);
    command = { id: 3, action: 'advance' };
    await renderer.update(element());
    await renderer.advanceFrames(1, 1 / 60);
    assert.equal(material.uniforms.uTime.value, 20);
    settings = {
      ...settings,
      ghostCount: 10,
      ghostStart: 0,
      ghostSeparation: 0,
    };
    await renderer.update(element());
    assert.equal(
      (
        renderer.scene.findByProps({ name: 'ghost-bobs' })
          .instance as InstancedMesh
      ).count,
      20,
    );
  } finally {
    await renderer.unmount();
  }
});
void test('trail memory wraps without connecting unrelated points and clears fully', () => {
  const model = new PendulumEnsemble({
    count: 3,
    angle: 135,
    separation: 0.01,
    gravity: 9.81,
  });
  const history = new GhostTrailHistory(3, 4);
  history.clear(model);
  const storage = history.positions;
  model.advance(1, () => history.sample(model));
  assert.equal(history.samples, 4);
  assert.equal(history.positions, storage);
  assert.equal(storage.length, 72);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 4; j++) {
      const b = (i * 4 + j) * 6;
      assert.ok(
        Math.hypot(
          storage[b + 3] - storage[b],
          storage[b + 4] - storage[b + 1],
        ) < 0.5,
      );
    }
  history.clear(model);
  assert.equal(history.samples, 0);
  assert.ok(history.times.every((t) => t === -1e6));
  model.advance(1 / 60, () => history.sample(model));
  assert.equal(history.samples, 1);
});
