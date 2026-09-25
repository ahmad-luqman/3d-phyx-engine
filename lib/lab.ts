export type DemoId =
  | 'foundry'
  | 'chain'
  | 'orbit'
  | 'destruction'
  | 'swarm'
  | 'singularity'
  | 'ghosts'
  | 'loom'
  | 'cathedral';
export type Vec3 = [number, number, number];
export type Quality = 'auto' | 'high' | 'low';
export type Command = {
  id: number;
  action:
    | 'sphere'
    | 'cube'
    | 'pulse'
    | 'launch'
    | 'trigger'
    | 'advance'
    | 'clear-trails'
    | 'flip'
    | 'flip-all'
    | 'rotate'
    | 'pull'
    | 'lower';
};
export type LabSettings = {
  gravity: number;
  coreX: number;
  strength: number;
  bounce: number;
  friction: number;
  speed: number;
  paused: boolean;
  quality: Quality;
  cinematic: boolean;
  formation: 'orbit' | 'sphere' | 'vortex';
  ghostCount: number;
  ghostAngle: number;
  ghostSeparation: number;
  ghostTrail: number;
  ghostArms: boolean;
  ghostStart: number;
  magnetCount: number;
  fieldThreads: boolean;
  loadMass: number;
};
export type Metrics = {
  fps: number;
  bodies: number;
  energy: number;
  ghosts?: { elapsed: number; separation: number; energyDrift: number };
  loom?: { lines: number; linked: number; particles: number; selected: number };
  pulley?: {
    tension: number;
    peak: number;
    pulled: number;
    raised: number;
    slack: boolean;
  };
};
export const demos = [
  {
    id: 'foundry',
    name: 'Collision Foundry',
    subtitle: 'Rigid bodies / collisions',
    label: 'Matter in motion.',
    description: 'Stack it. Throw it. Break the balance.',
    color: '#b6f36a',
    action: 'Shockwave',
    level: '01 / CLASSICAL',
    gravity: 9.81,
  },
  {
    id: 'chain',
    name: 'Chain Reaction',
    subtitle: 'Momentum / constraints',
    label: 'One small push.',
    description: 'Set a chain of events into motion.',
    color: '#ffc16e',
    action: 'Start reaction',
    level: '02 / KINETIC',
    gravity: 9.81,
  },
  {
    id: 'orbit',
    name: 'Orbital Reactor',
    subtitle: 'Attraction / repulsion',
    label: 'Bend the field.',
    description: 'Move the core. Rewrite every orbit.',
    color: '#69d8ff',
    action: 'Repulsion pulse',
    level: '03 / ORBITAL',
    gravity: 0,
  },
  {
    id: 'destruction',
    name: 'Destruction Chamber',
    subtitle: 'Impact / structural failure',
    label: 'Find the limit.',
    description: 'Every structure has a breaking point.',
    color: '#ff876e',
    action: 'Fire projectile',
    level: '04 / FRACTURE',
    gravity: 9.81,
  },
  {
    id: 'swarm',
    name: 'Magnetic Swarm',
    subtitle: 'Collective motion / fields',
    label: 'Order from chaos.',
    description: 'Hundreds of bodies. One invisible force.',
    color: '#c6a1ff',
    action: 'Scatter swarm',
    level: '05 / EMERGENT',
    gravity: 0,
  },
  {
    id: 'singularity',
    name: 'Singularity',
    subtitle: 'Accretion / energy release',
    label: 'Beyond equilibrium.',
    description: 'Charge the core. Unleash the collapse.',
    color: '#74f4d4',
    action: 'Initiate eruption',
    level: '06 / EXTREME',
    gravity: 0,
  },
  {
    id: 'ghosts',
    name: 'Pendulum Ghosts',
    subtitle: 'Chaos / initial conditions',
    label: 'Almost the same.',
    description: 'A fraction of a degree. An entirely different future.',
    color: '#9db5ff',
    action: 'Replay release',
    level: '07 / CHAOTIC',
    gravity: 9.81,
  },
  {
    id: 'loom',
    name: 'Magnetic Field Loom',
    subtitle: 'Field lines / polarity',
    label: 'Weave the invisible.',
    description: 'Drag the magnets. Flip a pole. Watch the field reconnect.',
    color: '#ff7ab8',
    action: 'Flip polarity',
    level: '08 / FIELD',
    gravity: 0,
  },
  {
    id: 'cathedral',
    name: 'Pulley Cathedral',
    subtitle: 'Mechanical advantage / tension',
    label: 'Half the force.',
    description: 'Pull two metres of rope. Lift the load one.',
    color: '#ffb057',
    action: 'Pull 2 m',
    level: '09 / MECHANICAL',
    gravity: 9.81,
  },
] as const;
/** Exhibits that run on Rapier rigid bodies; the rest use dedicated solvers. */
export function usesRapier(id: DemoId) {
  return id !== 'ghosts' && id !== 'loom' && id !== 'cathedral';
}
export function defaults(id: DemoId): LabSettings {
  return {
    coreX: 0,
    gravity: demos.find((d) => d.id === id)!.gravity,
    strength: 1,
    bounce: 0.35,
    friction: 0.6,
    speed: 1,
    paused: false,
    quality: 'auto',
    cinematic: false,
    formation: 'orbit',
    ghostCount: 50,
    ghostAngle: 135,
    ghostSeparation: 0.0001,
    ghostTrail: 8,
    ghostArms: true,
    ghostStart: 20,
    magnetCount: 2,
    fieldThreads: true,
    loadMass: 20,
  };
}
export function seeded(index: number) {
  const x = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
