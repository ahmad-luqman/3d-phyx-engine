import type { Vec3 } from './lab';
export type Point = { x: number; y: number; z: number };
export function orbitAcceleration(
  p: Point,
  v: Point,
  strength: number,
  coreX = 0,
): Vec3 {
  const x = p.x - coreX,
    y = p.y - 4,
    z = p.z,
    radius = Math.max(1.3, Math.hypot(x, y, z));
  const pull = (28 * strength) / (radius * radius + 3);
  // A small tangential drive offsets collision losses; this is an artistic force field.
  return [
    (-x / radius) * pull - z * 0.06 - v.x * 0.035,
    -y * 0.7 - v.y * 0.22,
    (-z / radius) * pull + x * 0.06 - v.z * 0.035,
  ];
}
export function formationTarget(
  index: number,
  count: number,
  time: number,
  formation: 'orbit' | 'sphere' | 'vortex',
): Vec3 {
  const phi = index * 2.399963229728653;
  if (formation === 'sphere') {
    const y = 1 - (2 * (index + 0.5)) / count,
      r = Math.sqrt(1 - y * y);
    return [
      Math.cos(phi + time * 0.15) * r * 5,
      5 + y * 4,
      Math.sin(phi + time * 0.15) * r * 5,
    ];
  }
  if (formation === 'vortex') {
    const t = index / Math.max(1, count - 1),
      r = 1.2 + t * 5,
      a = phi + time * (1.5 - t);
    return [Math.cos(a) * r, 1 + t * 8, Math.sin(a) * r];
  }
  const ring = index % 3,
    r = 3 + ring * 1.8,
    a = phi + time * (0.45 + ring * 0.1);
  return [
    Math.cos(a) * r,
    3 + ring * 1.3 + Math.sin(a * 2) * 0.5,
    Math.sin(a) * r,
  ];
}
export function seekAcceleration(
  p: Point,
  v: Point,
  target: Vec3,
  strength: number,
): Vec3 {
  const gain = 2.8 * strength,
    damp = 1.6;
  const a: Vec3 = [
    (target[0] - p.x) * gain - v.x * damp,
    (target[1] - p.y) * gain - v.y * damp,
    (target[2] - p.z) * gain - v.z * damp,
  ];
  const magnitude = Math.hypot(...a);
  return magnitude > 40 ? (a.map((n) => (n * 40) / magnitude) as Vec3) : a;
}
