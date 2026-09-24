import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formationTarget,
  orbitAcceleration,
  seekAcceleration,
} from '../lib/fields';
import { registerLabTools, type LabActions } from '../lib/webmcp';
import type { DemoId } from '../lib/lab';

void test('field acceleration is finite at the core and responds to moving the attractor', () => {
  const zero = { x: 0, y: 0, z: 0 };
  for (const point of [
    { x: 0, y: 4, z: 0 },
    { x: 1e-8, y: 4, z: 0 },
    { x: 1000, y: 4, z: -1000 },
  ])
    assert.ok(orbitAcceleration(point, zero, 3).every(Number.isFinite));
  assert.ok(orbitAcceleration({ x: 2, y: 4, z: 0 }, zero, 1, 0)[0] < 0);
  assert.ok(orbitAcceleration({ x: 2, y: 4, z: 0 }, zero, 1, 4)[0] > 0);
});
void test('all formations stay in the chamber and steering acceleration is bounded', () => {
  for (const formation of ['orbit', 'sphere', 'vortex'] as const)
    for (let i = 0; i < 240; i++) {
      const target = formationTarget(i, 240, 120, formation);
      assert.ok(target.every(Number.isFinite));
      assert.ok(target[1] >= 1 && target[1] <= 9);
      assert.ok(Math.hypot(target[0], target[2]) <= 7);
      const acceleration = seekAcceleration(
        { x: 100, y: -200, z: 150 },
        { x: 30, y: 40, z: -10 },
        target,
        3,
      );
      assert.ok(Math.hypot(...acceleration) <= 40.00001);
    }
});
void test('lab agent tools validate input and use the same state-changing actions', () => {
  const tools = new Map<string, { execute: (input: unknown) => unknown }>();
  let state = { demo: 'foundry' as DemoId, paused: false, bodies: 65 };
  const actions: LabActions = {
    select: (demo) => {
      state = { demo, paused: false, bodies: 0 };
    },
    pause: (paused) => {
      state.paused = paused;
    },
    reset: () => {
      state.paused = false;
      state.bodies = 0;
    },
    read: () => ({ ...state }),
  };
  const dispose = registerLabTools(() => actions, {
    registerTool(tool, { signal }) {
      tools.set(tool.name, tool);
      signal.addEventListener('abort', () => tools.delete(tool.name));
    },
  });
  assert.equal(tools.size, 3);
  assert.deepEqual(
    tools
      .get('configure_physics_lab')!
      .execute({ demo: 'swarm', paused: true }),
    { demo: 'swarm', paused: true, bodies: 0 },
  );
  assert.throws(() =>
    tools.get('configure_physics_lab')!.execute({ demo: 'invalid' }),
  );
  assert.equal(state.demo, 'swarm');
  assert.throws(() =>
    tools
      .get('configure_physics_lab')!
      .execute({ demo: 'foundry', paused: 'yes' }),
  );
  assert.equal(state.demo, 'swarm');
  tools.get('reset_physics_lab')!.execute({});
  assert.equal(state.paused, false);
  dispose?.();
  assert.equal(tools.size, 0);
});
