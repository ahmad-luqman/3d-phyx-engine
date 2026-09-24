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
