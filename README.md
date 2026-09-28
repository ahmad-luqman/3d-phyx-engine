# GRAVITY — Experimental Physics Lab

Nine interactive 3D demos built with React 19, TypeScript, Three.js / React Three Fiber, Rapier, Drei, and React Three Postprocessing. Vinext and Vite provide the application shell and build.

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
9. **Pulley Cathedral** — 1:1, 2:1, and 4:1 blocks and tackle under a stone arch, alone or pulled side by side from one bar, plus a counterweight lift that rings a bell; ropes glow with tension, snap past their rating, and a force lens shows the forces.

### Pendulum Ghosts

Choose experiment **07** (keyboard **7**). The exhibit opens at **20 seconds of simulated time**, with real precomputed trail history, to make the divergence immediately visible. **Replay release** or **R** starts at zero. **Jump +20 s** advances the same physics; **Clear trails** clears history without changing motion or the pause state.

Adjust gravity, the upper release angle, the lower-angle difference between consecutive ghosts, and the count. These changes restart from release. The lower arm starts 30° below the selected upper-arm angle. Choosing **Identical** sets every initial difference to zero. Trail memory and ghost-arm visibility can change without restarting.

This exhibit uses a dedicated Float64, fixed 1/240-second RK4 solver for ideal planar double pendulums, with two 1 kg point masses and two massless 2.3 m rods. The pendulums do not collide or exchange forces. Small depth offsets make the overlaid experiments legible in 3D; they are excluded from the reported RMS tip separation. The equations follow [myPhysicsLab's double-pendulum derivation](https://www.myphysicslab.com/pendulum/double-pendulum-en.html). The first six exhibits use Rapier.

Trajectory storage is a bounded 720-segment ring per ghost, with age-based shader fading. Low graphics samples trails at 30 Hz instead of 60 Hz while preserving the same simulation step and pendulum count. Tests cover energy drift over 60 simulated seconds, fixed rod lengths, identical trajectories, divergence, rendering-cadence independence, replay, pause, and bounded trail buffers.

### Magnetic Field Loom

Choose experiment **08** (keyboard **8**). Drag a magnet across the stage to move it; clicking also selects it. **Flip polarity** (or **F**, or double-clicking a magnet) reverses the selected magnet over 1.2 s. As its strength passes through zero, lines detach from its poles and reconnect elsewhere. **Flip all** reverses every magnet, and **Rotate 45°** turns the selected one. Layouts are a pair, a triangle, and a ring. Magnets can be dragged while paused; the field lines retrace, but the particles hold still. The button and **F** resume the simulation; a double-click flip waits until it resumes.

Each bar magnet uses the Gilbert model: two opposite magnetic charges at its tips, with a 0.08 m softening length. Field lines are traced with fixed-length RK4 steps along B̂ from 24 seeds on the outward hemisphere of each source pole. A line ends when it enters a sink pole's 0.22 m capture sphere, drops below the stage, or leaves a 12 m bound. The **linked** count shows lines ending on a _different_ magnet. Flux particles (1,800; 700 in low graphics) advance along B̂ at a fixed 1/120-second step. Their speed grows with √|B|: this is artistic, since field lines carry no velocity. The field is magnetostatic, with no induction, forces, or torques between magnets. Tests cover the analytic two-pole field, superposition, dipole falloff, flip negation, N→S line closure, reconnection after a flip, cadence-independent particles, pause, and layout/quality changes.

### Pulley Cathedral

Choose experiment **09** (keyboard **9**). The **Rig** control selects a 1:1, 2:1, or 4:1 block and tackle, **All** three side by side, or the counterweight **Lift**. In a rig, the rope runs from an anchor, alternately under sheaves on the movable block and over fixed sheaves under the beam, then down to a glowing handle. With an even strand count the rope is anchored to the beam; with an odd count it is tied to the block. The movable sheaves share one yoke, and in the 4:1 rig they visibly turn at one and three times the block's speed. In **All**, a single brass bar holds every free end, so one pull draws the same length of rope from each rig.

Drag a handle (or the bar) along its rail, or press **Pull 2 m** (**F**) or **Let out 2 m**. The pull scale beside each handle ticks every metre and the load scale every 1/n metre, so matching ticks line up. The load is one steel plate per 10 kg (10–80 kg) in a cage. Load mass, gravity, and the rope rating change live; switching rigs restarts the experiment. The rope's colour shows tension on one absolute scale shared by every rig: dim blue when slack, cyan when a 2:1 rig holds the load at rest, amber when straining, and white-hot for catch spikes. So a 1:1 rope glows hotter than a 4:1 rope carrying the same load.

**Force lens** draws the load's weight (red), the tension in each supporting strand (cyan), and the pull at the handle (amber) to one scale, 180 N per metre, and a wireframe ghost where the load will settle once the handle reaches its target.

The dedicated solver in `lib/pulley.ts` has one coordinate per rig, the height of the movable block. The rope is inextensible but one-sided: `n·h + y_hand ≥ C`. While taut, the load follows `h = (C − y_hand) / n`. Each strand then carries `T = M(g + a) / n`, measured from the rope's impulse at each fixed 1/240-second step. `M` is the load plus 2 kg for each sheave on the block, so extra sheaves add a little weight. If the rope is let out faster than the load can fall, it goes slack, tension drops to zero, and the load falls freely until the rope catches it. The catch hands back a fifth of the impact speed as a rebound (`catchVelocity`), so a dropped load hops before it settles. The load can also rest on the floor. The hand follows the pointer at up to 5 m/s, speeding up and braking at 8 m/s² — less than g, so a stopping pull never throws the load — and only letting rope run is instant. Each hand stops before its block reaches the fixed sheaves; the linked bar stops at the most limited rig's limit. The sheaves have no rotational inertia or friction.

Each rope has a rating (300–5000 N per strand, default 2500 N). A rigid rope delivers a catch in a single 1/240-second step — thousands of newtons for an instant — so the rating is compared with tension averaged over 50 ms, a stand-in for the stretch that spreads a real shock load; the readout shows that average as **strain**. Past the rating the rope snaps and runs out through the sheaves. A red self-retracting safety lanyard on the beam beside each rig then locks 0.35 m beyond its reach, catches the falling load, and lets it swing from the reel. The lanyard is an added safety element, not part of the block and tackle: without it the load would simply fall. The swing is a planar pendulum on an inextensible, one-sided line with light air drag and floor friction. **R** resets.

**Lift** is a counterweight elevator on one large sheave — an Atwood machine in `lib/lift.ts`. The cab weighs 40 kg plus cargo (10–80 kg); the counterweight is 20–150 kg. With the brake released, `a = ((m_cw − m_cab)·g − f) / (m_cab + m_cw + 6 kg)`: guide-rail friction `f` is 3% of the total weight, and the sheave's inertia counts as 6 kg at its rim. An imbalance smaller than the friction never starts the cab. At the top the cab hits a striker that rings the bell and hands back a quarter of its speed: under 1.5 m/s is a **chime**, under 3.5 m/s a **ring**, and faster a **slam**. **Release brake** / **Set brake** (**F**) toggles the brake — setting it stops the cab instantly, an idealised brake — and **Send down** winds the cab back to its buffer at 1.2 m/s. The bell's swing, flash, and ring wave are visual only; the exhibit has no audio. Its force lens uses 600 N per metre.

Tests cover exact n:1 travel with constant rope length (analytic and as drawn) for 1–6 strands, rest and lifting tension, sheave layout and speed ratios, the linked bar's equal pull and 1 : ½ : ¼ tensions, slack, catch, and rebound, resting on the floor, shock averaging against the rating, snapping and the lanyard's swing (never stretched, never gaining energy), cadence independence, plate counts, non-overlapping rigs, the force lens and its ghost, and the mounted scene in single, side-by-side, snapped, and lift layouts. Lift tests cover the Atwood acceleration and cab tension, the brake, balance within friction, the bell's arrival speed, verdicts and rebound, winding down, and cadence independence.

## Controls

- Drag solid objects in Foundry, Chain Reaction, and Destruction, or individual swarm cubes, to pull and throw them.
- Drag empty space to orbit; scroll or pinch to zoom. Orbiters and singularity fragments are controlled through the field controls.
- **Space:** pause/resume. **R:** reset. **1–9:** select demo.
- **B:** spawn sphere. **C:** spawn cube. **F:** activate the selected experiment.
- Shortcuts do not capture typing or focused interactive controls.
- Slow motion scales elapsed time while keeping the fixed simulation step (1/60 second for Rapier; 1/240 second for Pendulum Ghosts and Pulley Cathedral).
- Auto graphics lowers rendering resolution and disables shadows/postprocessing after sustained low frame rate; low graphics also lowers swarm and singularity body counts.
- Cinematic camera rotation is optional and respects reduced-motion preferences.

Body spawning is available in the six Rapier experiments and is capped at 48 per experiment. Bodies that leave the simulation bounds are recycled. Reset restores experiment defaults while retaining graphics and camera preferences.

## Code map

- `app/page.tsx` — lab controls, keyboard handling, and scene selection.
- `components/lab/scene.tsx` — renderer, lighting, platform, camera, and scene composition.
- `components/lab/physics.tsx` — shared rigid bodies, dragging, spawning, fixed stepping, and telemetry.
- `components/lab/{chain,orbit,destruction,swarm,singularity,ghosts,loom,cathedral,lift}.tsx` — individual experiments.
- `lib/pendulum.ts` and `lib/ghost-trails.ts` — deterministic double-pendulum solver and bounded trajectory storage.
- `lib/magnetism.ts` — Gilbert-model bar magnets, RK4 field-line tracer, and flux particles.
- `lib/pulley.ts` — one-sided rope constraint solver, n-strand rig layout, rope path, linked rigs, rope rating, and safety-lanyard swing.
- `lib/lift.ts` — counterweight lift (Atwood machine with friction, brake, and bell striker).
- `lib/fields.ts` — orbital and formation force calculations.
- `tests/` — real Rapier scene mounting, stepping, reset, damage, propagation, eruption, and field tests.

Tests use the headless React Three test renderer with real Rapier WASM. They verify simulation behavior and React lifecycle cleanup; they do not render pixels or compile GPU shaders. Pulley Cathedral (every rig, the force lens, a snap, and the lift) was checked visually in headless Chrome with software WebGL (SwiftShader), and the heading overlay was rechecked on 07 and 08; the other exhibits have not had browser QA. Library deprecation messages in the test output originate from the current upstream Three.js/test-renderer and Rapier packages.

The optional feature-detected WebMCP interface exposes selection, pause, reset, and read-back. Its contract is tested using a registry fixture; a live browser WebMCP context was unavailable for validation.

## Hosting

The Sites project is registered in `.openai/hosting.json`. `npm run build` emits the Cloudflare-compatible Worker and public assets under `dist/`. Local development does not require Sites credentials. Never put source-repository tokens in this repo.

## License

[MIT](LICENSE) © 2026 Ahmad Luqman
