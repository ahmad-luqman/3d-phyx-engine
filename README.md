# GRAVITY — Experimental Physics Lab

Eight interactive 3D demos built with React 19, TypeScript, Three.js / React Three Fiber, Rapier, Drei, and React Three Postprocessing. Vinext and Vite provide the application shell and build.

## Run

Requires Node.js 22.13 or later.

```sh
npm ci
npm run dev
```

Open the local URL printed by the server (normally http://localhost:3000).

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Lint targets application code, scene code, tests, and configuration. Generated UI primitives are retained as supplied by the scaffold. React Compiler lint is excluded only from the imperative physics modules; the project does not enable React Compiler.

## Experiments

1. **Collision Foundry** — two stacks, spheres, material controls, drag-and-throw interaction, and a radial shockwave.
2. **Chain Reaction** — a spherical-joint pendulum hits a winding domino circuit.
3. **Orbital Reactor** — colliding orbiters, luminous trails, a movable attractor, and repulsion pulses.
4. **Destruction Chamber** — fixed-joint masonry releases connections around strong impacts; projectile power controls impact speed.
5. **Magnetic Swarm** — 240 instanced rigid bodies seek orbit, sphere, and vortex formations (96 in low quality).
6. **Singularity** — 180 physical fragments surround a shader accretion disk; a ten-second sequence charges, erupts, and recovers (80 fragments in low quality).

The orbital and magnetic fields are artistic force models. Destruction uses preassembled pieces and breakable joints, not arbitrary mesh fracturing. Visual effects are rendered locally; the app needs no API key or external assets.

7. **Pendulum Ghosts** — 10–50 independent double pendulums with minute initial-angle differences, luminous trails, a white reference, and release replay.
8. **Magnetic Field Loom** — draggable bar magnets whose field lines are traced live, with glowing flux particles and polarity flips that reconnect the pattern.

### Pendulum Ghosts

Choose experiment **07** (keyboard **7**). The exhibit opens at **20 seconds of simulated time**, with real precomputed trail history, to make the divergence immediately visible. **Replay release** or **R** starts at zero. **Jump +20 s** advances the same physics; **Clear trails** clears history without changing motion or the pause state.

Adjust gravity, the upper release angle, the lower-angle difference between consecutive ghosts, and the count. These changes restart from release. The lower arm starts 30° below the selected upper-arm angle. Choosing **Identical** sets every initial difference to zero. Trail memory and ghost-arm visibility can change without restarting.

This exhibit uses a dedicated Float64, fixed 1/240-second RK4 solver for ideal planar double pendulums, with two 1 kg point masses and two massless 2.3 m rods. The pendulums do not collide or exchange forces. Small depth offsets make the overlaid experiments legible in 3D; they are excluded from the reported RMS tip separation. The equations follow [myPhysicsLab's double-pendulum derivation](https://www.myphysicslab.com/pendulum/double-pendulum-en.html). The first six exhibits use Rapier.

Trajectory storage is a bounded 720-segment ring per ghost, with age-based shader fading. Low graphics samples trails at 30 Hz instead of 60 Hz while preserving the same simulation step and pendulum count. Tests cover energy drift over 60 simulated seconds, fixed rod lengths, identical trajectories, divergence, rendering-cadence independence, replay, pause, and bounded trail buffers.

### Magnetic Field Loom

Choose experiment **08** (keyboard **8**). Drag a magnet across the stage to move it; clicking also selects it. **Flip polarity** (or **F**, or double-clicking a magnet) reverses the selected magnet over 1.2 s. As its strength passes through zero, lines detach from its poles and reconnect elsewhere. **Flip all** reverses every magnet, and **Rotate 45°** turns the selected one. Layouts are a pair, a triangle, and a ring. Magnets can be dragged while paused; the field lines retrace, but the particles hold still. The button and **F** resume the simulation; a double-click flip waits until it resumes.

Each bar magnet uses the Gilbert model: two opposite magnetic charges at its tips, with a 0.08 m softening length. Field lines are traced with fixed-length RK4 steps along B̂ from 24 seeds on the outward hemisphere of each source pole. A line ends when it enters a sink pole's 0.22 m capture sphere, drops below the stage, or leaves a 12 m bound. The **linked** count shows lines ending on a _different_ magnet. Flux particles (1,800; 700 in low graphics) advance along B̂ at a fixed 1/120-second step. Their speed grows with √|B|: this is artistic, since field lines carry no velocity. The field is magnetostatic, with no induction, forces, or torques between magnets. Tests cover the analytic two-pole field, superposition, dipole falloff, flip negation, N→S line closure, reconnection after a flip, cadence-independent particles, pause, and layout/quality changes.

## Controls

- Drag solid objects in Foundry, Chain Reaction, and Destruction, or individual swarm cubes, to pull and throw them.
- Drag empty space to orbit; scroll or pinch to zoom. Orbiters and singularity fragments are controlled through the field controls.
- **Space:** pause/resume. **R:** reset. **1–8:** select demo.
- **B:** spawn sphere. **C:** spawn cube. **F:** activate the selected experiment.
- Shortcuts do not capture typing or focused interactive controls.
- Slow motion scales elapsed time while keeping the fixed simulation step (1/60 second for Rapier; 1/240 second for Pendulum Ghosts).
- Auto graphics lowers rendering resolution and disables shadows/postprocessing after sustained low frame rate; low graphics also lowers swarm and singularity body counts.
- Cinematic camera rotation is optional and respects reduced-motion preferences.

Body spawning is available in the six Rapier experiments and is capped at 48 per experiment. Bodies that leave the simulation bounds are recycled. Reset restores experiment defaults while retaining graphics and camera preferences.

## Code map

- `app/page.tsx` — lab controls, keyboard handling, and scene selection.
- `components/lab/scene.tsx` — renderer, lighting, platform, camera, and scene composition.
- `components/lab/physics.tsx` — shared rigid bodies, dragging, spawning, fixed stepping, and telemetry.
- `components/lab/{chain,orbit,destruction,swarm,singularity,ghosts,loom}.tsx` — individual experiments.
- `lib/pendulum.ts` and `lib/ghost-trails.ts` — deterministic double-pendulum solver and bounded trajectory storage.
- `lib/magnetism.ts` — Gilbert-model bar magnets, RK4 field-line tracer, and flux particles.
- `lib/fields.ts` — orbital and formation force calculations.
- `tests/` — real Rapier scene mounting, stepping, reset, damage, propagation, eruption, and field tests.

Tests use the headless React Three test renderer with real Rapier WASM. They verify simulation behavior and React lifecycle cleanup; they do not render pixels or compile GPU shaders. Visual browser QA has not been performed. Library deprecation messages in the test output originate from the current upstream Three.js/test-renderer and Rapier packages.

The optional feature-detected WebMCP interface exposes selection, pause, reset, and read-back. Its contract is tested using a registry fixture; a live browser WebMCP context was unavailable for validation.

## Hosting

The Sites project is registered in `.openai/hosting.json`. `npm run build` emits the Cloudflare-compatible Worker and public assets under `dist/`. Local development does not require Sites credentials. Never put source-repository tokens in this repo.
