'use client';
/* oxlint-disable react/react-compiler -- The pulley solver, rope geometry, and drag state are mutated outside React rendering. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  CatmullRomCurve3,
  Color,
  Plane,
  TubeGeometry,
  Vector3,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from 'three';
import {
  ANCHOR_X,
  BEAM_Y,
  CRATE_DROP,
  CRATE_SIZE,
  FIXED_X,
  FIXED_Y,
  HAND_MIN,
  HAND_START,
  HAND_X,
  LOAD_FLOOR,
  LOAD_START,
  PULLEY_MASS,
  PulleySystem,
  WHEEL_RADIUS,
  ropePath,
} from '@/lib/pulley';
import type { Command, LabSettings, Metrics } from '@/lib/lab';

const STONE = '#2a2c30',
  BRASS = '#c8913f',
  STEEL = '#8c96a0';
const slackTint = new Color('#3a6f9a'),
  restTint = new Color('#4fc3ff'),
  strainTint = new Color('#ff9a3c'),
  hotTint = new Color('#fff0d8');

/** Rope glow by tension ratio (1 = holding the load at rest under 9.81 m/s²). */
export function tensionColor(ratio: number, out = new Color()) {
  if (ratio <= 1) return out.copy(slackTint).lerp(restTint, Math.max(0, ratio));
  if (ratio <= 2.5)
    return out.copy(restTint).lerp(strainTint, (ratio - 1) / 1.5);
  return out.copy(strainTint).lerp(hotTint, Math.min(1, (ratio - 2.5) / 4));
}

export function PulleyCathedral({
  settings,
  command,
  onMetrics,
  setDragging,
}: {
  settings: LabSettings;
  command: Command;
  onMetrics: (metrics: Metrics) => void;
  setDragging?: (v: boolean) => void;
}) {
  const { raycaster, pointer, camera, gl } = useThree();
  const [system] = useState(
    () =>
      new PulleySystem({ mass: settings.loadMass, gravity: settings.gravity }),
  );
  const rope = useRef<Mesh>(null),
    ropeMaterial = useRef<MeshStandardMaterial>(null),
    load = useRef<Group>(null),
    movable = useRef<Group>(null),
    fixed = useRef<Group>(null),
    handle = useRef<Group>(null),
    handMarker = useRef<Mesh>(null),
    loadMarker = useRef<Mesh>(null);
  const lastCommand = useRef(command.id),
    sample = useRef({ frames: 0, time: 0, peak: 0 }),
    flash = useRef(0);
  const drag = useRef<{ offset: number } | null>(null);
  const plane = useMemo(() => new Plane(new Vector3(0, 0, 1), 0), []);
  const hit = useMemo(() => new Vector3(), []);
  const path = useMemo<number[]>(() => [], []);
  const tint = useMemo(() => new Color(), []);

  const draw = () => {
    load.current?.position.setY(system.height);
    if (movable.current) movable.current.rotation.z = system.movableAngle;
    if (fixed.current) fixed.current.rotation.z = system.fixedAngle;
    handle.current?.position.setY(system.hand);
    handMarker.current?.position.setY(system.hand);
    loadMarker.current?.position.setY(system.height - CRATE_DROP);
    const mesh = rope.current;
    if (!mesh) return;
    ropePath(system, path);
    const points: Vector3[] = [];
    for (let i = 0; i < path.length; i += 2)
      points.push(new Vector3(path[i], path[i + 1], 0));
    const curve = new CatmullRomCurve3(points, false, 'centripetal');
    const previous = mesh.geometry;
    mesh.geometry = new TubeGeometry(curve, points.length * 2, 0.05, 8, false);
    previous.dispose();
  };

  useEffect(draw);

  useEffect(() => {
    if (command.id === lastCommand.current) return;
    lastCommand.current = command.id;
    if (command.action === 'pull' || command.action === 'trigger')
      system.pullBy(2);
    else if (command.action === 'lower') system.pullBy(-2);
  }, [command, system]);

  useEffect(() => {
    const release = () => {
      if (!drag.current) return;
      drag.current = null;
      setDragging?.(false);
      gl.domElement.style.cursor = 'auto';
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
      release();
    };
  }, [setDragging, gl]);

  const grab = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (!event.ray.intersectPlane(plane, hit)) return;
    drag.current = { offset: hit.y - system.hand };
    setDragging?.(true);
    gl.domElement.style.cursor = 'grabbing';
  };

  useFrame((_, dt) => {
    system.mass = settings.loadMass;
    system.gravity = settings.gravity;
    if (drag.current) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(plane, hit))
        system.setTarget(hit.y - drag.current.offset);
    }
    let peak = 0;
    if (!settings.paused)
      system.advance(Math.min(dt, 0.1) * settings.speed, () => {
        peak = Math.max(peak, system.tension);
      });
    sample.current.peak = Math.max(sample.current.peak, peak);
    // Hold a catch spike on the rope briefly so a one-step impulse is visible.
    flash.current = Math.max(
      system.tension,
      flash.current * Math.exp(-dt * 5),
      peak,
    );
    const reference = ((settings.loadMass + PULLEY_MASS) * 9.81) / 2;
    const ratio = flash.current / reference;
    const material = ropeMaterial.current;
    if (material) {
      material.emissive.copy(tensionColor(ratio, tint));
      material.emissiveIntensity = system.slack
        ? 0.35
        : 0.9 + Math.min(ratio, 6) * 0.45;
    }
    draw();
    sample.current.frames++;
    sample.current.time += dt;
    if (sample.current.time >= 0.4) {
      onMetrics({
        fps: Math.round(sample.current.frames / sample.current.time),
        bodies: 2,
        energy: Math.round(system.kinetic),
        pulley: {
          tension: system.tension,
          peak: sample.current.peak,
          pulled: system.pulled,
          raised: system.raised,
          slack: system.slack,
        },
      });
      sample.current = { frames: 0, time: 0, peak: 0 };
    }
  });

  return (
    <group name="pulley-cathedral">
      <Nave />
      {/* Ceiling beam, fixed pulley bracket, and rope anchor. */}
      <mesh position={[0.4, BEAM_Y + 0.25, 0]} castShadow>
        <boxGeometry args={[5.4, 0.5, 0.7]} />
        <meshStandardMaterial color="#3a3026" metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[FIXED_X, (BEAM_Y + FIXED_Y) / 2, 0]}>
        <boxGeometry args={[0.16, BEAM_Y - FIXED_Y, 0.36]} />
        <meshStandardMaterial color={STEEL} metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[ANCHOR_X, BEAM_Y - 0.05, 0]}>
        <torusGeometry args={[0.12, 0.035, 8, 20]} />
        <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.25} />
      </mesh>
      <group position={[FIXED_X, FIXED_Y, 0]}>
        <Wheel spin={fixed} />
      </group>
      <group ref={load} position={[0, LOAD_START, 0]}>
        <Wheel spin={movable} />
        <mesh position={[0, -0.62, 0]}>
          <boxGeometry args={[0.14, 0.5, 0.3]} />
          <meshStandardMaterial
            color={STEEL}
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, -CRATE_DROP, 0]} castShadow receiveShadow>
          <boxGeometry args={[CRATE_SIZE, CRATE_SIZE, CRATE_SIZE]} />
          <meshStandardMaterial
            color="#1c1f22"
            metalness={0.6}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, -CRATE_DROP, CRATE_SIZE / 2 + 0.005]}>
          <planeGeometry args={[CRATE_SIZE * 0.72, 0.06]} />
          <meshBasicMaterial color={BRASS} toneMapped={false} />
        </mesh>
      </group>
      <mesh name="pulley-rope" ref={rope} castShadow>
        <meshStandardMaterial
          ref={ropeMaterial}
          color="#171410"
          emissive={restTint}
          emissiveIntensity={1.35}
          roughness={0.6}
          toneMapped={false}
        />
      </mesh>
      <group ref={handle} position={[HAND_X, HAND_START, 0]}>
        <mesh name="pulley-handle" onPointerDown={grab}>
          <sphereGeometry args={[0.5, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.06, 12, 32]} />
          <meshStandardMaterial
            color={BRASS}
            emissive="#ffb057"
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
      </group>
      <Scale
        x={HAND_X + 0.55}
        from={HAND_START}
        step={-1}
        count={Math.floor(HAND_START - HAND_MIN) + 1}
        marker={handMarker}
      />
      <Scale
        x={-1.2}
        from={LOAD_START - CRATE_DROP}
        step={0.5}
        count={Math.floor(HAND_START - HAND_MIN) + 1}
        marker={loadMarker}
      />
      <mesh position={[0, LOAD_FLOOR - CRATE_DROP - CRATE_SIZE / 2 - 0.02, 0]}>
        <boxGeometry args={[1.6, 0.04, 1.6]} />
        <meshStandardMaterial color="#302820" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Brass sheave with spokes; `spin` receives the rotating group. */
function Wheel({ spin }: { spin: React.RefObject<Group | null> }) {
  return (
    <group>
      <group ref={spin}>
        <mesh castShadow>
          <torusGeometry args={[WHEEL_RADIUS, 0.07, 12, 48]} />
          <meshStandardMaterial
            color={BRASS}
            metalness={0.95}
            roughness={0.22}
          />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
            <boxGeometry args={[WHEEL_RADIUS * 2, 0.05, 0.05]} />
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
 * half metre, so matching tick numbers line up under a 2:1 advantage.
 */
function Scale({
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

/** Stone piers, pointed ribs, and faint lancet windows around the machine. */
function Nave() {
  // Two arcs of radius R centred ±a from the axis meet in a pointed apex.
  const R = 5,
    a = 0.8,
    spring = 8,
    apex = Math.acos(-a / R);
  return (
    <group position={[0.4, 0, -2.4]}>
      {[-4.2, 4.2].map((x) => (
        <mesh key={x} position={[x, spring / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.8, spring, 0.8]} />
          <meshStandardMaterial color={STONE} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[a, spring, 0]} rotation={[0, 0, apex]}>
        <torusGeometry args={[R, 0.18, 8, 40, Math.PI - apex]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      <mesh position={[-a, spring, 0]}>
        <torusGeometry args={[R, 0.18, 8, 40, Math.PI - apex]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} position={[x, 6.5, -0.6]}>
          <planeGeometry args={[0.55, 5]} />
          <meshBasicMaterial color="#ffb057" transparent opacity={0.12} />
        </mesh>
      ))}
      <spotLight
        position={[0, 14, 4]}
        angle={0.5}
        penumbra={0.8}
        intensity={140}
        color="#ffd6a0"
      />
    </group>
  );
}
