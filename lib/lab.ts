export type DemoId = 'foundry' | 'chain' | 'orbit' | 'destruction' | 'swarm' | 'singularity';
export type Vec3 = [number, number, number];
export type Quality = 'auto' | 'high' | 'low';
export type Command = { id: number; action: 'sphere' | 'cube' | 'pulse' | 'launch' | 'trigger' };
export type LabSettings = { gravity: number; coreX: number; strength: number; bounce: number; friction: number; speed: number; paused: boolean; quality: Quality; formation: 'orbit' | 'sphere' | 'vortex' };
export type Metrics = { fps: number; bodies: number; energy: number };
export const demos = [
  { id: 'foundry', name: 'Collision Foundry', subtitle: 'Rigid bodies / collisions', label: 'Matter in motion.', description: 'Stack it. Throw it. Break the balance.', color: '#b6f36a', action: 'Shockwave', level: '01 / CLASSICAL', gravity: 9.81 },
  { id: 'chain', name: 'Chain Reaction', subtitle: 'Momentum / constraints', label: 'One small push.', description: 'Set a chain of events into motion.', color: '#ffc16e', action: 'Start reaction', level: '02 / KINETIC', gravity: 9.81 },
  { id: 'orbit', name: 'Orbital Reactor', subtitle: 'Attraction / repulsion', label: 'Bend the field.', description: 'Move the core. Rewrite every orbit.', color: '#69d8ff', action: 'Repulsion pulse', level: '03 / ORBITAL', gravity: 0 },
  { id: 'destruction', name: 'Destruction Chamber', subtitle: 'Impact / structural failure', label: 'Find the limit.', description: 'Every structure has a breaking point.', color: '#ff876e', action: 'Fire projectile', level: '04 / FRACTURE', gravity: 9.81 },
  { id: 'swarm', name: 'Magnetic Swarm', subtitle: 'Collective motion / fields', label: 'Order from chaos.', description: 'Hundreds of bodies. One invisible force.', color: '#c6a1ff', action: 'Scatter swarm', level: '05 / EMERGENT', gravity: 0 },
  { id: 'singularity', name: 'Singularity', subtitle: 'Accretion / energy release', label: 'Beyond equilibrium.', description: 'Charge the core. Unleash the collapse.', color: '#74f4d4', action: 'Initiate eruption', level: '06 / EXTREME', gravity: 0 },
] as const;
export function defaults(id: DemoId): LabSettings {
  return { coreX: 0, gravity: demos.find(d => d.id === id)!.gravity, strength: 1, bounce: 0.35, friction: 0.6, speed: 1, paused: false, quality: 'auto', formation: 'orbit' };
}
export function seeded(index: number) { const x = Math.sin(index * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
