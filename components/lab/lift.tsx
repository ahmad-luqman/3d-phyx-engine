'use client';
/* oxlint-disable react/react-compiler -- The lift solver, rope geometry, and bell state are mutated outside React rendering. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CatmullRomCurve3,
  Color,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
} from 'three';
import {
  CAB_BOTTOM,
  CAB_HEIGHT,
  CAB_TOP,
  CHIME_SPEED,
  CounterweightLift as LiftModel,
  SHEAVE_RADIUS,
  SHEAVE_Y,
  SLAM_SPEED,
} from '@/lib/lift';
import { BEAM_Y } from '@/lib/pulley';
import type { Command, LabSettings, Metrics } from '@/lib/lab';
import {
  Arrow,
  BRASS,
  Nave,
  STEEL,
  Wheel,
  plateCount,
  restTint,
  tensionColor,
  type ArrowSetter,
} from './cathedral-parts';

const CAB_X = -SHEAVE_RADIUS,
  CAB_WIDTH = 1.5,
  WEIGHT_X = SHEAVE_RADIUS,
  WEIGHT_HEIGHT = 1.4,
  BELL_X = -2.7,
  BELL_Y = 7.9,
  STRIKER_Y = CAB_TOP + CAB_HEIGHT,
  /** The lift's loads are heavier, so its arrows use a coarser scale. */
  LIFT_FORCE_SCALE = 600;
const chime = new Color('#ffd27a'),
  ring = new Color('#ff9a3c'),
  slam = new Color('#ff5a4a'),
  braked = new Color('#ff4a3a'),
  running = new Color('#6dff9c'),
  winding = new Color('#ffb057');

/** Bell glow for an arrival speed: gold chime, amber ring, red slam. */
export function strikeColor(speed: number, out = new Color()) {
  return out.copy(
    speed < CHIME_SPEED ? chime : speed < SLAM_SPEED ? ring : slam,
  );
}

export function CounterweightLift({
  settings,
  command,
  onMetrics,
}: {
  settings: LabSettings;
  command: Command;
  onMetrics: (metrics: Metrics) => void;
  setDragging?: (v: boolean) => void;
}) {
  // Cargo, counterweight, and gravity apply live; the lift itself persists.
  const initial = useRef({
    cargo: settings.loadMass,
    counterweight: settings.counterweight,
    gravity: settings.gravity,
  });
  const lift = useMemo(() => new LiftModel(initial.current), []);
  const rope = useRef<Mesh>(null),
    ropeMaterial = useRef<MeshStandardMaterial>(null),
    cab = useRef<Group>(null),
    weight = useRef<Group>(null),
    sheave = useRef<Group | null>(null),
    bell = useRef<Group>(null),
    bellMaterial = useRef<MeshStandardMaterial>(null),
    wave = useRef<Mesh>(null),
    lamp = useRef<MeshBasicMaterial>(null),
    arrows = useRef<ArrowSetter[]>([]);
  const lastCommand = useRef(command.id),
    lastRings = useRef(0),
    strike = useRef({ age: 99, speed: 0 }),
    sample = useRef({ frames: 0, time: 0 }),
    fps = useRef(0);
  const tint = useMemo(() => new Color(), []);
  const bellShape = useMemo(() => {
    // Profile of a bell: flared lip, waisted body, domed crown.
    const profile = [
      [0.02, 0.62],
      [0.2, 0.6],
      [0.3, 0.5],
      [0.32, 0.3],
      [0.36, 0.1],
      [0.46, 0.0],
      [0.48, -0.04],
    ].map(([x, y]) => new Vector2(x, y));
    return new LatheGeometry(profile, 40);
  }, []);

  const report = () =>
    onMetrics({
      fps: fps.current,
      bodies: 2,
      energy: Math.round(lift.kinetic),
      lift: {
        height: lift.height - CAB_BOTTOM,
        speed: lift.velocity,
        tension: lift.tension,
        braked: lift.braked,
        rings: lift.rings,
        arrival: lift.arrival,
      },
    });

  useEffect(() => {
    if (command.id === lastCommand.current) return;
    lastCommand.current = command.id;
    const action = command.action;
    // The primary action toggles the brake; the secondary one winds down.
    if (action === 'pull' || action === 'trigger') {
      if (lift.braked || lift.winding) lift.release();
      else lift.hold();
    } else if (action === 'lower') lift.sendDown();
    // Report now so the brake button's label follows the click at once.
    report();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- report reads the live lift; re-running on it would repeat the command.
  }, [command, lift]);

  const draw = (dt: number) => {
    const h = lift.height,
      top = lift.counterweightTop;
    cab.current?.position.setY(h);
    weight.current?.position.setY(top);
    if (sheave.current) sheave.current.rotation.z = lift.angle;
    const ratio = lift.tension / (lift.cabMass * 9.81);
    const material = ropeMaterial.current;
    if (material) {
      material.emissive.copy(tensionColor(ratio, tint));
      material.emissiveIntensity = 0.9 + Math.min(ratio, 6) * 0.45;
    }
    lamp.current?.color.copy(
      lift.winding ? winding : lift.braked ? braked : running,
    );
    // Bell: a damped swing and flash sized by the arrival speed.
    strike.current.age += dt;
    const { age, speed } = strike.current;
    const decay = Math.exp(-age / 1.1);
    if (bell.current)
      bell.current.rotation.z =
        Math.min(0.5, speed * 0.12) * decay * Math.sin(age * 2 * Math.PI * 1.4);
    const bm = bellMaterial.current;
    if (bm) {
      strikeColor(speed, bm.emissive);
      bm.emissiveIntensity = 0.1 + 3 * decay * Math.min(1, speed / 2);
    }
    const w = wave.current;
    if (w) {
      const t = Math.min(1, age / 0.9);
      w.visible = t < 1;
      w.scale.setScalar(1 + t * (2 + speed));
      (w.material as MeshBasicMaterial).opacity = (1 - t) * 0.8;
      strikeColor(speed, (w.material as MeshBasicMaterial).color);
    }
    if (settings.forceLens) {
      const [cabWeight, cabRope, weightWeight, weightRope] = arrows.current;
      cabWeight?.(CAB_X, h + 0.8, false, lift.cabMass * lift.gravity);
      cabRope?.(CAB_X, h + CAB_HEIGHT + 0.1, true, lift.tension);
      weightWeight?.(
        WEIGHT_X,
        top - WEIGHT_HEIGHT / 2,
        false,
        lift.counterweight * lift.gravity,
      );
      weightRope?.(WEIGHT_X, top + 0.1, true, lift.counterweightTension);
    }
    const mesh = rope.current;
    if (!mesh) return;
    const r = SHEAVE_RADIUS,
      points = [
        new Vector3(CAB_X, h + CAB_HEIGHT, 0),
        new Vector3(CAB_X, (h + CAB_HEIGHT + SHEAVE_Y) / 2, 0),
        new Vector3(CAB_X, SHEAVE_Y, 0),
      ];
    for (let i = 1; i < 12; i++) {
      const a = Math.PI - (Math.PI * i) / 12;
      points.push(new Vector3(r * Math.cos(a), SHEAVE_Y + r * Math.sin(a), 0));
    }
    points.push(
      new Vector3(WEIGHT_X, SHEAVE_Y, 0),
      new Vector3(WEIGHT_X, (SHEAVE_Y + top) / 2, 0),
      new Vector3(WEIGHT_X, top, 0),
    );
    const curve = new CatmullRomCurve3(points, false, 'centripetal');
    const previous = mesh.geometry;
    mesh.geometry = new TubeGeometry(curve, 96, 0.05, 8, false);
    previous.dispose();
  };
  useEffect(() => draw(0));

  useFrame((_, dt) => {
    lift.cargo = settings.loadMass;
    lift.counterweight = settings.counterweight;
    lift.gravity = settings.gravity;
    if (!settings.paused) lift.advance(Math.min(dt, 0.1) * settings.speed);
    if (lift.rings !== lastRings.current) {
      lastRings.current = lift.rings;
      strike.current = { age: 0, speed: lift.arrival };
    }
    draw(dt);
    sample.current.frames++;
    sample.current.time += dt;
    if (sample.current.time >= 0.4) {
      fps.current = Math.round(sample.current.frames / sample.current.time);
      report();
      sample.current = { frames: 0, time: 0 };
    }
  });

  const plates = plateCount(settings.loadMass),
    slabs = Math.min(15, Math.max(2, Math.round(settings.counterweight / 10))),
    bind = (i: number) => (set: ArrowSetter) => (arrows.current[i] = set);
  return (
    <group name="counterweight-lift">
      <Nave half={3.4} />
      <mesh position={[0, BEAM_Y + 0.25, 0]} castShadow>
        <boxGeometry args={[7.6, 0.5, 0.7]} />
        <meshStandardMaterial color="#3a3026" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Sheave hangs from the beam; the lamp shows the brake. */}
      <mesh position={[0, (BEAM_Y + SHEAVE_Y) / 2, 0]}>
        <boxGeometry args={[0.18, BEAM_Y - SHEAVE_Y, 0.4]} />
        <meshStandardMaterial color={STEEL} metalness={0.85} roughness={0.3} />
      </mesh>
      <group position={[0, SHEAVE_Y, 0]}>
        <Wheel radius={SHEAVE_RADIUS} spin={(g) => (sheave.current = g)} />
      </group>
      <mesh name="lift-brake-lamp" position={[0, SHEAVE_Y + 0.05, 0.3]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshBasicMaterial ref={lamp} color={braked} toneMapped={false} />
      </mesh>
      {/* Guide rails for the cab and the counterweight. */}
      {[CAB_X - CAB_WIDTH / 2 - 0.08, CAB_X + CAB_WIDTH / 2 + 0.08, 1.15].map(
        (x) => (
          <mesh key={x} position={[x, 4.2, -0.35]}>
            <boxGeometry args={[0.07, 8.4, 0.07]} />
            <meshStandardMaterial
              color={STEEL}
              metalness={0.85}
              roughness={0.3}
            />
          </mesh>
        ),
      )}
      <group ref={cab} position={[0, CAB_BOTTOM, 0]}>
        {[0, CAB_HEIGHT].map((y) => (
          <mesh key={y} position={[CAB_X, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[CAB_WIDTH, 0.08, 1.2]} />
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
          <mesh
            key={`${px}${pz}`}
            position={[
              CAB_X + (px * CAB_WIDTH) / 2,
              CAB_HEIGHT / 2,
              (pz * 1.2) / 2,
            ]}
          >
            <boxGeometry args={[0.06, CAB_HEIGHT, 0.06]} />
            <meshStandardMaterial color={BRASS} metalness={0.85} />
          </mesh>
        ))}
        {Array.from({ length: plates }, (_, k) => (
          <mesh
            key={k}
            name="lift-cargo"
            position={[CAB_X, 0.1 + 0.11 * (k + 0.5), 0]}
            castShadow
          >
            <cylinderGeometry args={[0.42, 0.42, 0.095, 28]} />
            <meshStandardMaterial
              color={k % 2 ? '#2b2f33' : '#3a3f44'}
              metalness={0.75}
              roughness={0.35}
            />
          </mesh>
        ))}
      </group>
      <group ref={weight} position={[0, lift.counterweightTop, 0]}>
        {Array.from({ length: slabs }, (_, k) => (
          <mesh
            key={k}
            name="lift-counterweight"
            position={[WEIGHT_X, -((k + 0.5) * WEIGHT_HEIGHT) / slabs, 0]}
            castShadow
          >
            <boxGeometry args={[0.6, (WEIGHT_HEIGHT / slabs) * 0.88, 0.5]} />
            <meshStandardMaterial
              color={k % 2 ? '#43372c' : '#54463a'}
              metalness={0.6}
              roughness={0.5}
            />
          </mesh>
        ))}
      </group>
      <mesh name="lift-rope" ref={rope} castShadow>
        <meshStandardMaterial
          ref={ropeMaterial}
          color="#171410"
          emissive={restTint}
          emissiveIntensity={1.35}
          roughness={0.6}
          toneMapped={false}
        />
      </mesh>
      {/* Striker plate at the top of travel, linked to the bell. */}
      <mesh position={[CAB_X, STRIKER_Y + 0.06, 0]}>
        <boxGeometry args={[CAB_WIDTH * 0.6, 0.06, 0.5]} />
        <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh
        position={[(BELL_X + CAB_X) / 2, STRIKER_Y + 0.1, -0.1]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.025, 0.025, CAB_X - BELL_X, 8]} />
        <meshStandardMaterial color={STEEL} metalness={0.85} />
      </mesh>
      <mesh position={[BELL_X, (BEAM_Y + BELL_Y + 0.62) / 2, 0]}>
        <boxGeometry args={[0.08, BEAM_Y - BELL_Y - 0.62, 0.08]} />
        <meshStandardMaterial color={STEEL} metalness={0.85} />
      </mesh>
      <group ref={bell} name="lift-bell" position={[BELL_X, BELL_Y + 0.62, 0]}>
        <mesh geometry={bellShape} position={[0, -0.62, 0]} castShadow>
          <meshStandardMaterial
            ref={bellMaterial}
            color="#b0802e"
            emissive={chime}
            emissiveIntensity={0.1}
            metalness={0.95}
            roughness={0.25}
            side={2}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color={STEEL} metalness={0.9} />
        </mesh>
      </group>
      <mesh
        ref={wave}
        position={[BELL_X, BELL_Y, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        visible={false}
      >
        <torusGeometry args={[0.5, 0.02, 8, 64]} />
        <meshBasicMaterial
          color={chime}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {settings.forceLens && (
        <group name="force-lens">
          <Arrow color="#ff7a59" bind={bind(0)} scale={LIFT_FORCE_SCALE} />
          <Arrow color="#6fe3ff" bind={bind(1)} scale={LIFT_FORCE_SCALE} />
          <Arrow color="#ff7a59" bind={bind(2)} scale={LIFT_FORCE_SCALE} />
          <Arrow color="#6fe3ff" bind={bind(3)} scale={LIFT_FORCE_SCALE} />
        </group>
      )}
    </group>
  );
}
