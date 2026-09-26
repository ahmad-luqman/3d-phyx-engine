import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create } from '@react-three/test-renderer';
import type { Mesh } from 'three';
import {
  PulleyCathedral,
  plateCount,
  rigOffsets,
} from '../components/lab/cathedral';
import { defaults, type Command, type Metrics } from '../lib/lab';
import {
  COMPARE_STRANDS,
  CRATE_DROP,
  HAND_MAX,
  HAND_START,
  LOAD_CEILING,
  LOAD_FLOOR,
  LOAD_START,
  LANYARD_SLACK,
  LinkedRigs,
  MAX_STRANDS,
  PULLEY_MASS,
  PulleySystem,
  BEAM_Y,
  pathLength,
  rigGeometry,
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
  assert.ok(system.angles[0] > 0.5);
  close(system.angles[1], -2 * system.angles[0], 1e-9, 'wheel ratio');
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
    close(latest.pulley.rigs[0].raised, 1, 1e-6, 'raised');
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
    close(
      latest.pulley.rigs[0].tension,
      ((60 + PULLEY_MASS) * g) / 2,
      1e-6,
      'heavy',
    );
  } finally {
    await renderer.unmount();
  }
});

void test('every n:1 rig lifts the load 1/n of the pull on a constant rope', () => {
  for (let n = 1; n <= MAX_STRANDS; n++) {
    const system = new PulleySystem({ mass: 30, gravity: g, strands: n });
    const length = system.ropeLength(),
      drawn = pathLength(ropePath(system));
    system.advance(0.5);
    const rest = ((30 + Math.floor(n / 2) * PULLEY_MASS) * g) / n;
    close(system.tension, rest, 1e-9, `${n}:1 rest tension`);
    system.pullBy(1.5);
    system.advance(3);
    close(system.pulled, 1.5, 1e-9, `${n}:1 pulled`);
    close(system.raised, 1.5 / n, 1e-9, `${n}:1 raised`);
    close(system.ropeLength(), length, 1e-9, `${n}:1 rope length`);
    close(pathLength(ropePath(system)), drawn, 1e-9, `${n}:1 drawn length`);
  }
});

void test('rig layout alternates block and beam sheaves, ending over the beam', () => {
  const four = rigGeometry(4);
  assert.deepEqual(
    four.sheaves.map((s) => s.top),
    [false, true, false, true],
  );
  assert.ok(four.anchoredToBeam);
  assert.deepEqual(
    rigGeometry(1).sheaves.map((s) => s.top),
    [true],
  );
  assert.equal(rigGeometry(1).anchoredToBeam, false);
  assert.deepEqual(
    rigGeometry(3).sheaves.map((s) => s.top),
    [true, false, true],
  );
});

void test('linked sheaves on a 4:1 block turn at 1× and 3× the block speed', () => {
  const system = new PulleySystem({ mass: 20, gravity: g, strands: 4 });
  system.pullBy(4);
  system.advance(3);
  const [a, b, c, d] = system.angles;
  assert.ok(a > 0.5);
  close(b, -2 * a, 1e-9, 'first fixed sheave');
  close(c, 3 * a, 1e-9, 'second block sheave');
  close(d, -4 * a, 1e-9, 'last fixed sheave');
});

void test('one bar pulls 1:1, 2:1, and 4:1 the same length with 1, 1/2, 1/4 the force', () => {
  const linked = new LinkedRigs(COMPARE_STRANDS, { mass: 20, gravity: g });
  linked.pullBy(2);
  linked.advance(3);
  const [one, two, four] = linked.rigs;
  for (const rig of linked.rigs) close(rig.pulled, 2, 1e-9, 'pulled');
  close(one.raised, 2, 1e-9, '1:1 raised');
  close(two.raised, 1, 1e-9, '2:1 raised');
  close(four.raised, 0.5, 1e-9, '4:1 raised');
  close(one.tension, 20 * g, 1e-9, '1:1 tension');
  close(two.tension, (22 * g) / 2, 1e-9, '2:1 tension');
  close(four.tension, (24 * g) / 4, 1e-9, '4:1 tension');
  // The 1:1 load reaches the fixed sheave first, so it stops the whole bar.
  linked.setTarget(0);
  linked.advance(4);
  close(one.height, LOAD_CEILING, 1e-9, '1:1 at the ceiling');
  for (const rig of linked.rigs) close(rig.hand, one.hand, 1e-12, 'bar');
  close(four.raised, (HAND_START - one.hand) / 4, 1e-9, '4:1 follows');
});

void test('plates track the load and rigs never overlap', () => {
  assert.equal(plateCount(5), 1);
  assert.equal(plateCount(20), 2);
  assert.equal(plateCount(80), 8);
  const rigs = COMPARE_STRANDS.map(
    (n) => new PulleySystem({ mass: 20, gravity: g, strands: n }),
  );
  const x = rigOffsets(rigs);
  for (let i = 1; i < rigs.length; i++)
    assert.ok(
      x[i - 1] + rigs[i - 1].geometry.handX + 0.8 <
        x[i] + rigs[i].geometry.lanyardX - 0.35,
    );
});

void test('side-by-side scene mounts three rigs driven by one pull', async () => {
  let latest: Metrics | undefined;
  const settings = { ...defaults('cathedral'), pulleyRig: 'compare' as const };
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
      renderer.scene.findAllByProps({ name: 'pulley-rope' }).length,
      3,
    );
    assert.equal(
      renderer.scene.findAllByProps({ name: 'pulley-plate' }).length,
      3 * plateCount(settings.loadMass),
    );
    command = { id: 1, action: 'pull' };
    await renderer.update(element());
    await renderer.advanceFrames(180, 1 / 60);
    assert.ok(latest?.pulley);
    close(latest.pulley.pulled, 2, 1e-6, 'pulled');
    assert.deepEqual(
      latest.pulley.rigs.map((r) => r.strands),
      [...COMPARE_STRANDS],
    );
    latest.pulley.rigs.forEach((r) =>
      close(r.raised, 2 / r.strands, 1e-6, `${r.strands}:1 raised`),
    );
  } finally {
    await renderer.unmount();
  }
});

void test('a catching rope hands back a small rebound, then the load settles', () => {
  const system = new PulleySystem({ mass: 20, gravity: g });
  // Lift the load 0.5 m above where the rope holds it, then let it drop.
  system.height += 0.5;
  system.slack = true;
  let catches = 0,
    wasSlack = true,
    peak = 0;
  system.advance(4, () => {
    peak = Math.max(peak, system.tension);
    if (wasSlack && !system.slack) catches++;
    wasSlack = system.slack;
  });
  assert.ok(catches >= 2, `rebounds: ${catches}`);
  // The rebound adds to the impulse: more than a dead stop at full impact.
  const impact = Math.sqrt(2 * g * 0.5);
  assert.ok(peak > (22 * impact) / (2 / 240), `spike ${peak}`);
  assert.equal(system.slack, false);
  close(system.velocity, 0, 1e-9, 'settled');
});

void test('the rope rating judges shock loads averaged over 50 ms', () => {
  const drop = (rating: number) => {
    const system = new PulleySystem({ mass: 20, gravity: g, rating });
    system.height += 0.5;
    system.slack = true;
    let peak = 0,
      strain = 0;
    system.advance(2, () => {
      peak = Math.max(peak, system.tension);
      strain = Math.max(strain, system.strain);
    });
    return { system, peak, strain };
  };
  // One step of the catch far exceeds 1000 N, but its 50 ms average does not.
  const held = drop(1000);
  assert.ok(held.peak > 1000);
  assert.equal(held.system.snapped, false);
  assert.ok(held.strain > 0.5 && held.strain < 1, `strain ${held.strain}`);
  const broken = drop(400);
  assert.equal(broken.system.snapped, true);
  assert.equal(broken.system.tension, 0);
  // Ordinary pulling and letting out stays well inside a 1500 N rating.
  const normal = new PulleySystem({ mass: 20, gravity: g, rating: 1500 });
  normal.pullBy(4);
  normal.advance(3);
  normal.pullBy(-3);
  normal.advance(4);
  assert.equal(normal.snapped, false);
});

void test('a snapped rope drops the load onto the lanyard and it swings', () => {
  const system = new PulleySystem({
    mass: 80,
    gravity: g,
    strands: 1,
    rating: 2000,
  });
  system.pullBy(3);
  system.advance(3);
  assert.equal(system.snapped, false);
  // Derate the rope under its 785 N load, 3 m up.
  system.rating = 500;
  system.advance(1 / 240);
  assert.equal(system.snapped, true);
  const ax = system.geometry.lanyardX,
    reach = Math.hypot(0 - ax, system.height - BEAM_Y);
  close(system.lanyard, reach + LANYARD_SLACK, 1e-9, 'locked length');
  let crossings = 0,
    side = Math.sign(system.x - ax),
    caught = false;
  system.advance(8, () => {
    const d = Math.hypot(system.x - ax, system.height - BEAM_Y);
    assert.ok(d <= system.lanyard + 1e-9, `lanyard stretched to ${d}`);
    if (system.lanyardTension > 0) caught = true;
    const now = Math.sign(system.x - ax);
    if (now && now !== side) {
      crossings++;
      side = now;
    }
  });
  assert.ok(caught, 'lanyard never caught the load');
  assert.ok(crossings >= 2, `swing crossings: ${crossings}`);
  assert.equal(system.tension, 0);
  // Drag and the lock only remove energy.
  const energy = (s: PulleySystem) => s.kinetic + s.totalMass * g * s.height;
  const before = energy(system);
  system.advance(4);
  assert.ok(energy(system) <= before + 1e-6);
});

void test('force lens draws weight, hand, and one arrow per strand, plus a ghost target', async () => {
  const settings = {
    ...defaults('cathedral'),
    pulleyRig: '4' as const,
    forceLens: true,
  };
  let command: Command = { id: 0, action: 'pull' };
  const element = () => (
    <PulleyCathedral
      settings={settings}
      command={command}
      onMetrics={() => {}}
    />
  );
  const renderer = await create(element());
  try {
    assert.equal(
      renderer.scene.findAllByProps({ name: 'force-arrow' }).length,
      2 + 4,
    );
    const ghost = () =>
      renderer.scene.findByProps({ name: 'pulley-ghost' }).instance;
    await renderer.advanceFrames(5, 1 / 60);
    assert.equal(ghost().visible, false);
    command = { id: 1, action: 'pull' };
    await renderer.update(element());
    await renderer.advanceFrames(5, 1 / 60);
    assert.equal(ghost().visible, true);
    // 2 m of pull on a 4:1 rig settles the load 0.5 m higher.
    close(ghost().position.y + CRATE_DROP, LOAD_START + 0.5, 1e-9, 'ghost');
    await renderer.advanceFrames(240, 1 / 60);
    assert.equal(ghost().visible, false);
  } finally {
    await renderer.unmount();
  }
});

void test('the scene reports a snapped rope and keeps the lanyard drawn', async () => {
  let latest: Metrics | undefined;
  let settings = {
    ...defaults('cathedral'),
    pulleyRig: '1' as const,
    loadMass: 20,
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
    command = { id: 1, action: 'pull' };
    await renderer.update(element());
    await renderer.advanceFrames(180, 1 / 60);
    assert.equal(latest?.pulley?.rigs[0].snapped, false);
    settings = { ...settings, ropeRating: 150 };
    await renderer.update(element());
    await renderer.advanceFrames(60, 1 / 60);
    assert.ok(latest?.pulley);
    assert.equal(latest.pulley.rigs[0].snapped, true);
    assert.equal(latest.pulley.rigs[0].tension, 0);
    assert.equal(
      renderer.scene.findAllByProps({ name: 'pulley-lanyard' }).length,
      1,
    );
  } finally {
    await renderer.unmount();
  }
});
