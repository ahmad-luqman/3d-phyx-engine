import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create } from '@react-three/test-renderer';
import type { Group } from 'three';
import { PulleyCathedral } from '../components/lab/cathedral';
import { defaults, type Command, type Metrics } from '../lib/lab';
import { CAB_BOTTOM, CAB_TOP } from '../lib/lift';
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  window: Object.assign(new EventTarget(), {
    performance: globalThis.performance,
  }),
});

void test('the lift runs on release, rings the bell, and winds back down', async () => {
  let latest: Metrics | undefined;
  const settings = {
    ...defaults('cathedral'),
    pulleyRig: 'lift' as const,
    counterweight: 70,
    forceLens: true,
  };
  let command: Command = { id: 0, action: 'pull' };
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
    assert.equal(
      renderer.scene.findAllByProps({ name: 'force-arrow' }).length,
      4,
    );
    await renderer.advanceFrames(60, 1 / 60);
    assert.ok(latest?.lift);
    assert.equal(latest.lift.braked, true);
    assert.equal(latest.lift.height, 0);
    command = { id: 1, action: 'pull' };
    await renderer.update(element());
    await renderer.advanceFrames(360, 1 / 60);
    assert.equal(latest.lift.braked, false);
    assert.ok(latest.lift.rings >= 1);
    assert.ok(latest.lift.arrival > 1.5 && latest.lift.arrival < 3.5);
    const bell = renderer.scene.findByProps({ name: 'lift-bell' })
      .instance as Group;
    assert.notEqual(bell.rotation.z, 0);
    // After the rebounds, the heavier counterweight holds the cab at the top.
    await renderer.advanceFrames(300, 1 / 60);
    assert.ok(Math.abs(latest.lift.height - (CAB_TOP - CAB_BOTTOM)) < 1e-9);
    command = { id: 2, action: 'lower' };
    await renderer.update(element());
    await renderer.advanceFrames(360, 1 / 60);
    assert.equal(latest.lift.height, 0);
    assert.equal(latest.lift.braked, true);
  } finally {
    await renderer.unmount();
  }
});
