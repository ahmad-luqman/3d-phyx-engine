# GRAVITY — Engineering demo ideas

Idea bank for the next phase of the physics lab. These are proposed additions, not implemented features or a committed scope.

## Direction: cinematic engineering exhibits

The machines should look spectacular and respond convincingly. Let the mechanism dominate the screen, keep controls compact, and make every meaningful interaction produce a visible reaction.

- Dramatic lighting, strong silhouettes, convincing material finishes, and restrained glow.
- Titanium, brushed steel, polished copper, brass, smoked glass, and braided cables.
- Close-up camera moves, cutaway views, and exploded assemblies.
- Force arrows, airflow trails, magnetic fields, and heat maps that reveal what the machine is doing.
- Optional mechanical audio that responds to speed, load, and impacts.
- Pause, slow motion, reset, and a clear way to return to the overview camera.
- A coherent exhibit style, with a distinct material and lighting palette for each machine.

## Flagship: aircraft turbofan

A suspended titanium engine inside a dark hangar. The casing slides apart to expose rotating compressor stages, the combustion chamber, turbine, and nozzle.

**Inputs:** throttle, inlet airflow, nozzle opening.

**Visuals:** orange combustion, blue exhaust, illuminated airflow trails, thrust vectors, subtle vibration, and camera moves through the cutaway. Throttle changes should affect motion, sound, and flow together.

**Possible views:** intact engine, longitudinal cutaway, exploded assembly, airflow overlay, and close-up stage inspection.

Use a simplified thermodynamic and shaft-dynamics model to drive the exhibit. Full computational fluid dynamics is a separate future scope.

## Demo collection

| Demo | Controls and interaction | Visual direction and payoff |
| --- | --- | --- |
| Aircraft turbofan | Throttle, inlet airflow, nozzle opening | Titanium cutaway, spinning compressor blades, combustion, exhaust, and thrust vectors |
| Piston aircraft engine | Throttle, ignition timing, flywheel load | Transparent cylinders expose the firing sequence and connecting rods driving a propeller |
| Electric motor | Voltage, polarity, mechanical load | Copper windings, brushed steel rotor, luminous magnetic-field ribbons, and visible torque response |
| Generator | Crank speed, magnet strength, electrical load | Turn the shaft to power bulbs; electrical load produces mechanical resistance |
| Magnetic playground | Drag magnets, reverse poles, introduce iron particles | Attraction, repulsion, field patterns, and snapping assemblies |
| Pulley workshop | Rope routing, pulley count, load mass | Industrial gantry, braided cables, swinging counterweights, and cable color showing tension |
| Rope and string lab | Anchor positions, tension, plucking, cutting | Luminous strings carry traveling waves; cables sag, loads swing, and cuts release tension |
| Gearbox builder | Gear sizes, ratios, rotation direction, clutch | Precision gears behind smoked glass; exploded views highlight the power path |
| Stirling engine | Hot/cold temperatures, flywheel load | Brass, glass cylinders, flowing heat colors, moving pistons, and a heavy flywheel |
| Suspension test rig | Spring stiffness, damping, road profile | Wheels follow bumps while chassis oscillations settle or amplify |
| Hydraulic press | Piston sizes, input force, valve positions | Transparent passages reveal fluid flow and force multiplication |
| Mechanical clock | Spring winding, pendulum length | Gears, escapement, and pendulum visibly regulate motion together |
| Wind turbine | Wind speed, blade pitch, generator load | Wake particles, changing blade rotation, and live power output |
| Crane simulator | Boom angle, cable length, counterweight | Hoist swinging loads and explore balance and stability limits |

The earlier “string generator” wording remains open: rope/string mechanics, a generator, and a Stirling engine are all captured here as separate possibilities.

## Motor / generator bench

The second visual showcase: an exposed rotor surrounded by polished copper windings, with flowing field ribbons and a connected electrical circuit.

- Switch between motor and generator operation.
- Reverse polarity and observe direction changes.
- Add mechanical or electrical load and watch the shaft respond.
- Connect bulbs or a flywheel to make energy transfer tangible.
- Separate the assembly into rotor, stator, windings, bearings, and housing.
- Show voltage, current, speed, and torque beside the relevant parts.

## Pulley and rope workshop

A tactile mechanical exhibit built around an industrial gantry.

- Route a cable through fixed and moving pulleys.
- Add weights and compare lifting effort across arrangements.
- Drag a load, release it, and watch the resulting swing.
- Color cables by tension and show force arrows on selected components.
- Extend the same rope system to bridges, cranes, and plucked strings.

## Connected machines

Reusable components could turn individual exhibits into working systems:

1. Motor → gearbox → pulley → lifting platform.
2. Wind turbine → generator → motor → flywheel.
3. Piston engine → clutch → transmission → wheels.
4. Aircraft engine → propeller → thrust test stand.

A later assembly mode could let users build a mechanism from compatible parts, connect shafts and cables, and discover why it moves or stalls.

## Shared exhibit features

- Cutaway and exploded views with smooth transitions.
- Draggable parts, inspection cameras, and a reset-to-overview action.
- Slow motion and pause for inspecting a mechanism's cycle.
- Optional overlays for forces, tension, fields, heat, and airflow.
- Live measurements tied to actual simulation values.
- Optional audio with an explicit mute control.
- Adaptive graphics quality and reduced-motion support.
- A guided demonstration sequence alongside free experimentation.

## Suggested sequencing

### Visual priority

1. **Aircraft turbofan cutaway:** establish the flagship visual standard.
2. **Motor / generator bench:** establish the material, field, and energy-transfer language.
3. Apply that standard to the other exhibits.

### Engineering dependency order

1. **Pulley + rope workshop:** develop reusable cable and constraint behavior.
2. **Motor + generator bench:** connect electrical and mechanical models.
3. **Gearbox builder:** develop reusable shafts, ratios, clutches, and loads.
4. **Aircraft engine cutaway:** combine polished mechanisms, thermal models, and flow visualization.

These are two prioritization options. A practical compromise is to establish a small jet-engine visual prototype first, then build the reusable mechanical systems.

### Current build path

1. **Magnetic Field Loom — implemented:** Experiment 08 provides draggable bar magnets, RK4-traced field lines, streaming flux particles, and polarity flips that reconnect the lines. `lib/magnetism.ts` is the field model the motor bench will reuse.
2. **Pulley Cathedral:** suspended weights, moving cables, linked wheels.
3. **Motor / generator:** spinning coils in the loom's field, with torque and current.
4. **Jet engine cutaway:** rotating compressor stages, combustion glow, flowing particles.

## Technical foundation

The current stack is React, TypeScript, Three.js through React Three Fiber, Rapier, Drei, and React Three Postprocessing.

- **Rigid bodies, collisions, and joints:** Rapier.
- **Ropes and strings:** a dedicated constraint or particle model, coupled to rigid bodies where needed.
- **Motors, generators, and magnets:** custom electromagnetic and electromechanical models.
- **Engines and thermal machines:** simplified pressure, temperature, and energy-transfer models.
- **Airflow and fluid displays:** particles and shaders driven by the underlying simplified model.
- **Machine visuals:** detailed 3D geometry, intentional materials, lighting, and camera choreography.

Define each exhibit's model and assumptions before implementation. Keep visual effects connected to simulated state, and distinguish an educational approximation from an engineering analysis tool.

## Existing foundation

The current lab already includes Collision Foundry, Chain Reaction, Orbital Reactor, Destruction Chamber, Magnetic Swarm, and Singularity. These provide reusable interaction, joint, force-field, instancing, shader, and control patterns for the proposed engineering exhibits.

---

# Expansion: new idea categories

Everything above covers cinematic engineering machines. The categories below go past machines. Each item notes what it reuses from the current lab (**R:**) or what new capability it needs (**N:**).

## 1. More engineering exhibits (extends the demo collection)

| Demo | Controls and interaction | Visual direction and payoff |
| --- | --- | --- |
| Strandbeest walker | Wind speed, leg linkage lengths, terrain | Theo Jansen linkage legs walk across sand; changing one link length breaks the gait |
| Differential & planetary gears | Lock/unlock sun, ring, or carrier; wheel slip | A car differential sends torque to the wheels as the path turns; planetary stages are shown exploded |
| Centrifugal governor | Steam pressure, load spikes | Flyballs rise and throttle the valve, showing feedback control mechanically |
| Geneva drive / escapements | Drive speed, slot count | Continuous rotation becomes stepped rotation, a clear introduction to intermittent motion |
| Steam locomotive valve gear | Reverser, regulator, cutoff | Walschaerts gear with pistons, connecting rods, and drive wheels, plus a glowing firebox |
| Antikythera-style orrery | Hand crank, date scrub | A brass gear train drives planets, and ratios are shown against real orbital periods |
| Trebuchet / catapult | Counterweight, sling length, release pin angle | Launch arcs with range markers and energy transfer from counterweight to projectile |
| Tesla valve & fluid logic | Flow direction, pressure | Particle flow shows asymmetric resistance (needs the fluid system from §2) |

**R:** joints, drag interaction, and telemetry. **N:** Rapier joint motors and limits for driven linkages.

## 2. Soft matter & continua (new simulation capability)

The lab is rigid-body only. Each of these needs a new solver, so they are larger projects.

- **Cloth & flags:** Position-based dynamics (PBD) cloth that tears when stretched and interacts with wind from the Orbital/Swarm force fields.
- **Jelly & soft bodies:** Pressure-based soft spheres that squash on impact, with a "jelly Foundry" variant of Collision Foundry.
- **Granular flow:** Sand or grain particles for an hourglass, an avalanche slope, the Brazil-nut effect, and angle of repose.
- **Fluids (SPH / FLIP):** Dam break, water wheel, and buoyancy (floating rigid bodies of different densities). This also enables the Tesla valve and hydraulic press.
- **Smoke & fire:** A GPU grid fluid for the turbofan exhaust and Stirling heat.

**N:** GPU compute (WebGPU) or a worker-thread solver. The instanced swarm path handles rendering only.

## 3. Chaos & nonlinear dynamics

These are compact exhibits that show "tiny change → huge difference" and fit the lab's artistic style.

- **Double pendulum ghosts — implemented:** Experiment 07 now provides 10–50 independent pendulums, adjustable initial-angle differences (including 0.0001°), luminous trails, and replay from release.
- **Magnetic pendulum fractal:** A bob over 3 magnets. The floor is painted with a basin-of-attraction fractal that fills in live.
- **Metronome synchronization:** Metronomes on a swinging platform fall into sync (Kuramoto).
- **Galton board:** Balls form a bell curve, and tilting the board skews the distribution.
- **Lorenz / strange attractor chamber:** Luminous particles trace the attractor (reuses `lib/fields.ts` force-model patterns).

**R:** orbit trails, instancing, force fields.

## 4. Counter-intuitive rotation ("physics magic tricks")

- **Dzhanibekov effect:** A T-handle spinning in zero-g flips periodically.
- **Gyroscope & precession:** A spinning wheel on a string refuses to fall.
- **Tippe top & rattleback:** The top flips upside down, and the rattleback reverses its spin direction.
- **Euler's disk:** A coin spins down with an accelerating wobble and rising pitch (pairs with audio).

**N:** Rapier's JS bindings (0.19) do not expose gyroscopic forces; they exist only in the Rust crate, off by default. Apply the ω × Iω torque manually each step with `addTorque`. Without it, these effects will not appear. This is an accuracy test for the engine, not just a demo.

## 5. Structures & civil engineering

- **Earthquake shake table:** Towers with or without a base isolator and tuned mass damper. Scrub frequency to hit resonance (reuses Destruction's breakable joints).
- **Bridge builder:** Place beams, run a truck across, and color members by stress. The bridge fails at the weakest joint.
- **Arches & catenary:** Stack voussoirs without mortar. The keystone holds the arch, and removing it collapses it.
- **Tacoma resonance:** A deck driven by wind vortex shedding oscillates at increasing amplitude.
- **Tensegrity:** A structure of struts and cables that floats. Needs the rope system from the Pulley workshop.

## 6. Control systems & robotics

These are interactive and show why controllers matter.

- **Inverted pendulum / cart-pole:** Tune the P, I, and D gains live and poke the pole to test recovery.
- **Rocket landing:** Thrust vectoring with a PID or a manual mode. Wind gusts and fuel limits make it playable.
- **Quadcopter:** Motor thrust mixing, hover, and a flip maneuver, with prop wash particles.
- **Robotic arm IK:** Drag the end effector while joints follow under torque limits, then pick and place.
- **Evolved walkers:** Ragdolls learn a gait over generations using a genetic algorithm in a worker.

**R:** joints, telemetry. **N:** a controller loop run at a fixed step alongside Rapier's step.

## 7. Astrophysics & gravity (grows Orbital Reactor and Singularity)

- **True N-body mode:** Real Newtonian gravity next to the current artistic field, with a "reality vs. art" toggle.
- **Lagrange points:** Place a probe and watch it stay at L4/L5 or drift away from L1–L3.
- **Gravity slingshot:** Aim a probe past a planet and show the speed gained.
- **Tidal disruption & ring formation:** A moon crosses the Roche limit and breaks into a ring (combines Destruction's joints with Orbital).
- **Planet builder:** Accrete debris into a planet that grows, heats, and becomes spherical.

## 8. Games & challenges (goal-driven modes)

These add goals on top of the sandbox, which gives a reason to replay.

- **Rube Goldberg puzzles:** Place a limited parts kit so a ball rings the bell. Extends Chain Reaction.
- **Demolition challenge:** Collapse a tower with the fewest shots, with a score and replay.
- **Egg drop:** Build a cage with limited parts and survive a drop from the highest level.
- **Marble run builder:** Snap track pieces together, time the run, and use the loop and jump pieces.
- **Physics golf:** One ball and one shot that uses the level's attractors, fans, and bouncers.

## 9. Lab tooling & meta-features (benefit every demo)

- **Time rewind & scrub:** A ring buffer of body transforms lets users drag a timeline back and branch "what if".
- **Shareable scenes:** Encode seed, parameters, and spawned bodies in a URL. Needs a determinism check (a Rapier snapshot hash).
- **Live graphs:** Energy, momentum, and angular momentum plotted over time, so users can see when energy isn't conserved.
- **Integrator / timestep comparison:** Run the same scene at 1/30, 1/60, and 1/240 side by side to make numerical error visible.
- **Scenario editor:** Place, scale, and set materials for bodies, then save to a local library.
- **Recording:** Export a GIF or WebM clip of the last 10 seconds.
- **Benchmark mode:** Stress a scene until FPS drops to find the body-count ceiling per device (feeds the Auto graphics heuristics).

## 10. New interaction modes

- **Device tilt gravity:** On mobile, the gyroscope sets the gravity direction.
- **WebXR:** Grab and throw bodies with VR hands, and walk around the turbofan at full scale.
- **Hand tracking (webcam):** Push the swarm with an open palm.
- **Audio-reactive:** Microphone amplitude drives the Singularity charge or Swarm energy.
- **Multiplayer sandbox:** Shared room over WebRTC. The host is authoritative and others receive snapshot sync.
- **Sonification:** Collision impulse maps to pitch and volume, and material to timbre.

## Suggested next picks

Ranked by the effort they need against their payoff, given the existing code.

1. **Time rewind + live energy graphs** (§9): every current demo benefits, and it builds on the snapshot/telemetry work.
2. **Double pendulum ghosts / magnetic pendulum fractal** (§3): small scope, strong visuals, reuses trails and instancing.
3. **Earthquake shake table** (§5): reuses breakable joints directly.
4. **Rube Goldberg puzzle mode** (§8): turns Chain Reaction into a game.
5. **Cart-pole / rocket landing** (§6): introduces the controller loop that engineering exhibits (governor, motors) also need.
6. **Cloth or granular** (§2): the first step beyond rigid bodies. Decide on a WebGPU vs. CPU-worker solver first.

## 11. From web research (checked 2026-09-24)

### New ideas found in the wild

- **Drivable vehicle sandbox:** Rapier's `DynamicRayCastVehicleController` (a raycast vehicle ported from Bullet), in the style of Bruno Simon's folio. Needs the raw world API because @react-three/rapier has no vehicle hook. [folio-2025](https://github.com/brunosimon/folio-2025)
- **Walkable avatar:** A character controller (`World.createCharacterController`) that pushes lab objects around. [Codrops](https://tympanus.net/codrops/2025/05/28/building-a-physics-based-character-controller-with-the-help-of-ai/)
- **Pixel-to-voxel drop:** An image or webcam feed breaks into voxel rigid bodies that fall into the chamber. [Codrops](https://tympanus.net/codrops/2026/01/05/how-to-create-a-pixel-to-voxel-video-drop-effect-with-three-js-and-rapier/)
- **Deformable text / logo:** The "GRAVITY" title bends around the pointer and springs back (TSL vertex compute). [Codrops](https://tympanus.net/codrops/2025/07/22/interactive-text-destruction-with-three-js-webgpu-and-tsl/)
- **10k-body GPU pile:** A comparison with Rapier on the CPU next to an all-GPU AVBD solver. [WebPhysics](https://github.com/jure/webphysics)
- **Naval architecture tank:** Buoyancy, stability, and capsizing hulls. [Ciechanowski](https://ciechanow.ski/naval-architecture/)
- **Self-stable bicycle:** Shows why a riderless bike stays upright (relates to gyro and caster effects). [Ciechanowski](https://ciechanow.ski/bicycle/)
- **Planet presets:** Move the whole lab to the Moon, Jupiter, or zero-g, with measuring tools (ruler, stopwatch) and live energy bars. [PhET](https://phet.colorado.edu/)
- **Fireflies sync:** A visual version of Kuramoto sync, alongside the metronome exhibit. [Nicky Case](https://ncase.me/projects/)

### Name clash

A Codrops/R3F showcase is already called ["Singularity"](https://singularity.niccolofanton.dev/) and also uses Rapier. Review it for performance techniques in dense scenes, and consider renaming ours.

### Capability map (rapier.js 0.19.x, @react-three/rapier v2)

| Need | Available? | Notes |
| --- | --- | --- |
| Joint motors / limits | Yes | `configureMotorVelocity/Position`, for gearbox, motor, and governor |
| Multibody joints | Yes (raw API) | For robot arm IK and Strandbeest linkages; no R3F hook |
| Vehicle | Yes (raw API) | `DynamicRayCastVehicleController`, for the suspension rig and drivable car |
| Contact force events | Yes | `onContactForce` with a threshold, so Destruction can fracture on force rather than speed |
| Snapshots | Yes | `world.takeSnapshot()` makes time rewind cheap |
| Cross-device determinism | Yes | `rapier3d-deterministic` package, required for shareable scene URLs |
| Voxel colliders | Yes (0.16+) | For the pixel-to-voxel idea |
| Gyroscopic torque | **No (JS)** | Add ω × Iω manually |
| Soft bodies / cloth / fluids | No | Use Three.js WebGPU compute examples ([cloth](https://threejs.org/examples/webgpu_compute_cloth.html), [MLS-MPM fluid](https://threejs.org/examples/webgpu_compute_particles_fluid.html)), [WebGPU-Ocean](https://github.com/matsuoka-601/WebGPU-Ocean), or [JoltPhysics.js](https://github.com/jrouwe/JoltPhysics.js) (WASM soft bodies) |

### References to learn from

- [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) has compact JS reference implementations for §2 and §3: soft bodies, cloth, FLIP water, fire, PBD joints, and triple pendulum.
- [Bartosz Ciechanowski](https://ciechanow.ski/archives/) has scrubbable, cutaway explainers (gears, engine, mechanical watch, airfoil). These are the interaction model for the turbofan, gearbox, and clock exhibits.
