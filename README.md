# GRAVITY — Experimental Physics Lab

Six interactive 3D demos built with React 19, TypeScript, Three.js / React Three Fiber, Rapier, Drei, and React Three Postprocessing. Vinext and Vite provide the application shell and build.

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

## Controls

- Drag solid objects in Foundry, Chain Reaction, and Destruction, or individual swarm cubes, to pull and throw them.
- Drag empty space to orbit; scroll or pinch to zoom. Orbiters and singularity fragments are controlled through the field controls.
- **Space:** pause/resume. **R:** reset. **1–6:** select demo.
- **B:** spawn sphere. **C:** spawn cube. **F:** activate the selected experiment.
- Shortcuts do not capture typing or focused interactive controls.
- Slow motion keeps Rapier's fixed 1/60-second simulation step and scales elapsed time.
- Auto graphics lowers rendering resolution and disables shadows/postprocessing after sustained low frame rate; low graphics also lowers swarm and singularity body counts.
- Cinematic camera rotation is optional and respects reduced-motion preferences.

Spawned bodies are capped at 48 per experiment. Bodies that leave the simulation bounds are recycled. Reset restores experiment defaults while retaining graphics and camera preferences.

## Code map

- `app/page.tsx` — lab controls, keyboard handling, and scene selection.
- `components/lab/scene.tsx` — renderer, lighting, platform, camera, and scene composition.
- `components/lab/physics.tsx` — shared rigid bodies, dragging, spawning, fixed stepping, and telemetry.
- `components/lab/{chain,orbit,destruction,swarm,singularity}.tsx` — individual experiments.
- `lib/fields.ts` — orbital and formation force calculations.
- `tests/` — real Rapier scene mounting, stepping, reset, damage, propagation, eruption, and field tests.

Tests use the headless React Three test renderer with real Rapier WASM. They verify simulation behavior and React lifecycle cleanup; they do not render pixels or compile GPU shaders. Visual browser QA has not been performed. Library deprecation messages in the test output originate from the current upstream Three.js/test-renderer and Rapier packages.

The optional feature-detected WebMCP interface exposes selection, pause, reset, and read-back. Its contract is tested using a registry fixture; a live browser WebMCP context was unavailable for validation.

## Hosting

The Sites project is registered in `.openai/hosting.json`. `npm run build` emits the Cloudflare-compatible Worker and public assets under `dist/`. Local development does not require Sites credentials. Never put source-repository tokens in this repo.
