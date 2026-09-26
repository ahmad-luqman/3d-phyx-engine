'use client';
/* oxlint-disable react/react-compiler -- Arrow transforms are set imperatively each frame. */
import { useEffect, useRef } from 'react';
import { Color, type Group, type Mesh } from 'three';
import { CRATE_DROP, CRATE_SIZE, WHEEL_RADIUS } from '@/lib/pulley';

export const STONE = '#2a2c30',
  BRASS = '#c8913f',
  STEEL = '#8c96a0';
export const slackTint = new Color('#3a6f9a'),
  restTint = new Color('#4fc3ff'),
  strainTint = new Color('#ff9a3c'),
  hotTint = new Color('#fff0d8');
const PLATE_KG = 10,
  PLATE_HEIGHT = 0.11;
/** Newtons drawn per metre of force arrow, and the longest arrow drawn. */
export const FORCE_SCALE = 180,
  FORCE_MAX = 3.2;

/**
 * Rope glow by tension ratio. 1 is a 2:1 rig holding the load at rest under
 * 9.81 m/s², so every rig and layout shares one absolute scale.
 */
export function tensionColor(ratio: number, out = new Color()) {
  if (ratio <= 1) return out.copy(slackTint).lerp(restTint, Math.max(0, ratio));
  if (ratio <= 2.5)
    return out.copy(restTint).lerp(strainTint, (ratio - 1) / 1.5);
  return out.copy(strainTint).lerp(hotTint, Math.min(1, (ratio - 2.5) / 4));
}

export function plateCount(mass: number) {
  return Math.min(8, Math.max(1, Math.round(mass / PLATE_KG)));
}

/** Places a force arrow: origin, direction (up or down), and force in newtons. */
export type ArrowSetter = (
  x: number,
  y: number,
  up: boolean,
  newtons: number,
) => void;

/** Force arrow drawn in front of the machine; `bind` receives its setter. */
export function Arrow({
  color,
  bind,
  scale = FORCE_SCALE,
}: {
  color: string;
  bind: (set: ArrowSetter) => void;
  /** Newtons per metre of arrow. */
  scale?: number;
}) {
  const group = useRef<Group>(null),
    shaft = useRef<Mesh>(null),
    head = useRef<Mesh>(null);
  useEffect(() =>
    bind((x, y, up, newtons) => {
      const g = group.current;
      if (!g || !shaft.current || !head.current) return;
      const length = Math.min(FORCE_MAX, Math.max(0, newtons) / scale);
      g.visible = length > 0.05;
      g.position.set(x, y, 0.35);
      g.rotation.z = up ? 0 : Math.PI;
      const body = Math.max(0.001, length - 0.18);
      shaft.current.scale.y = body;
      shaft.current.position.y = body / 2;
      head.current.position.y = body + 0.09;
    }),
  );
  return (
    <group ref={group} name="force-arrow" visible={false}>
      <mesh ref={shaft}>
        <cylinderGeometry args={[0.035, 0.035, 1, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={head}>
        <coneGeometry args={[0.1, 0.18, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Open steel cage holding one plate per 10 kg of load. */
export function Cage({ plates }: { plates: number }) {
  const s = CRATE_SIZE,
    y = -CRATE_DROP;
  return (
    <group position={[0, y, 0]}>
      {[-1, 1].map((py) => (
        <mesh key={py} position={[0, (py * s) / 2, 0]} castShadow>
          <boxGeometry args={[s, 0.05, s]} />
          <meshStandardMaterial
            color="#1c1f22"
            metalness={0.4}
            roughness={0.6}
          />
        </mesh>
      ))}
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([px, pz]) => (
        <mesh key={`${px}${pz}`} position={[(px * s) / 2, 0, (pz * s) / 2]}>
          <boxGeometry args={[0.05, s, 0.05]} />
          <meshStandardMaterial
            color={STEEL}
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
      ))}
      {Array.from({ length: plates }, (_, k) => (
        <mesh
          key={k}
          name="pulley-plate"
          position={[0, -s / 2 + 0.03 + PLATE_HEIGHT * (k + 0.5), 0]}
          castShadow
        >
          <cylinderGeometry args={[0.42, 0.42, PLATE_HEIGHT * 0.86, 28]} />
          <meshStandardMaterial
            color={k % 2 ? '#2b2f33' : '#3a3f44'}
            metalness={0.75}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Brass sheave with spokes; `spin` receives the rotating group. */
export function Wheel({
  spin,
  radius = WHEEL_RADIUS,
}: {
  spin: (group: Group | null) => void;
  radius?: number;
}) {
  return (
    <group>
      <group ref={spin}>
        <mesh castShadow>
          <torusGeometry args={[radius, 0.07, 12, 48]} />
          <meshStandardMaterial
            color={BRASS}
            metalness={0.95}
            roughness={0.22}
          />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
            <boxGeometry args={[radius * 2, 0.05, 0.05]} />
            <meshStandardMaterial
              color={BRASS}
              metalness={0.9}
              roughness={0.3}
            />
          </mesh>
        ))}
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.34, 16]} />
        <meshStandardMaterial color={STEEL} metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

/**
 * Graduated rail. The pull scale ticks every metre and the load scale every
 * 1/n metre, so matching tick numbers line up under an n:1 advantage.
 */
export function Scale({
  x,
  from,
  step,
  count,
  marker,
}: {
  x: number;
  from: number;
  step: number;
  count: number;
  marker: React.RefObject<Mesh | null>;
}) {
  const top = Math.max(from, from + step * (count - 1)),
    bottom = Math.min(from, from + step * (count - 1));
  return (
    <group>
      <mesh position={[x, (top + bottom) / 2, -0.1]}>
        <boxGeometry args={[0.03, top - bottom + 0.2, 0.03]} />
        <meshStandardMaterial color={STEEL} metalness={0.8} roughness={0.35} />
      </mesh>
      {Array.from({ length: count }, (_, k) => (
        <mesh key={k} position={[x, from + step * k, -0.1]}>
          <boxGeometry args={[k === 0 ? 0.34 : 0.2, 0.025, 0.03]} />
          <meshBasicMaterial color={k === 0 ? '#ffffff' : '#9aa6b2'} />
        </mesh>
      ))}
      <mesh ref={marker} position={[x, from, -0.1]}>
        <boxGeometry args={[0.4, 0.05, 0.05]} />
        <meshBasicMaterial color="#ffb057" toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Stone piers and pointed ribs around the machines.
 * `half` is the half-width the machines need; the nave widens to fit.
 */
export function Nave({ half }: { half: number }) {
  // Two arcs of radius R centred ±a from the axis meet in a pointed apex.
  const pier = Math.max(4.2, half + 0.8),
    a = 0.8,
    R = pier + a,
    spring = 8,
    apex = Math.acos(-a / R);
  return (
    <group position={[0, 0, -2.4]}>
      {[-pier, pier].map((x) => (
        <mesh key={x} position={[x, spring / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.8, spring, 0.8]} />
          <meshStandardMaterial color={STONE} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[a, spring, 0]} rotation={[0, 0, apex]}>
        <torusGeometry args={[R, 0.18, 8, 48, Math.PI - apex]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      <mesh position={[-a, spring, 0]}>
        <torusGeometry args={[R, 0.18, 8, 48, Math.PI - apex]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      <spotLight
        position={[0, 14, 4]}
        angle={0.5 + half * 0.03}
        penumbra={0.8}
        intensity={140 + half * 12}
        color="#ffd6a0"
      />
    </group>
  );
}
