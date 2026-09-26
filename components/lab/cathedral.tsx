'use client';
/* oxlint-disable react/react-compiler -- The pulley solver, rope geometry, and drag state are mutated outside React rendering. */
import { useEffect, useMemo, useRef } from 'react';
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
  BEAM_Y,
  COMPARE_STRANDS,
  CRATE_DROP,
  CRATE_SIZE,
  FIXED_Y,
  HAND_START,
  LOAD_FLOOR,
  LOAD_START,
  LinkedRigs,
  PULLEY_MASS,
  WHEEL_RADIUS,
  ropePath,
  type PulleySystem,
} from '@/lib/pulley';
import type { Command, LabSettings, Metrics } from '@/lib/lab';

const STONE = '#2a2c30',
  BRASS = '#c8913f',
  STEEL = '#8c96a0';
const slackTint = new Color('#3a6f9a'),
  restTint = new Color('#4fc3ff'),
  strainTint = new Color('#ff9a3c'),
  hotTint = new Color('#fff0d8');
/** Room left and right of a rig for its scales and handle. */
const RIG_MARGIN = 0.8,
  RIG_GAP = 0.6,
  PLATE_KG = 10,
  PLATE_HEIGHT = 0.11;

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

/** Rig x offsets, packed left to right and centred on the nave. */
export function rigOffsets(rigs: PulleySystem[]) {
  const spans = rigs.map((r) => ({
    left: r.geometry.xs[0] - RIG_MARGIN,
    right: r.geometry.handX + RIG_MARGIN,
  }));
  const width =
    spans.reduce((w, s) => w + s.right - s.left, 0) +
    RIG_GAP * (rigs.length - 1);
  let cursor = -width / 2;
  return spans.map((s) => {
    const x = cursor - s.left;
    cursor += s.right - s.left + RIG_GAP;
    return x;
  });
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
  // Mass and gravity are applied live every frame; only a rig change restarts.
  const load = useRef({ mass: settings.loadMass, gravity: settings.gravity });
  load.current = { mass: settings.loadMass, gravity: settings.gravity };
  const linked = useMemo(
    () =>
      new LinkedRigs(
        settings.pulleyRig === 'compare'
          ? COMPARE_STRANDS
          : [Number(settings.pulleyRig)],
        load.current,
      ),
    [settings.pulleyRig],
  );
  const offsets = useMemo(() => rigOffsets(linked.rigs), [linked]);
  const drawers = useRef<((dt: number) => void)[]>([]),
    bar = useRef<Group>(null);
  const lastCommand = useRef(command.id),
    sample = useRef({ frames: 0, time: 0, peaks: [] as number[] }),
    stepPeaks = useRef<number[]>([]);
  const drag = useRef<{ offset: number } | null>(null);
  const plane = useMemo(() => new Plane(new Vector3(0, 0, 1), 0), []);
  const hit = useMemo(() => new Vector3(), []);
  const reference = ((settings.loadMass + PULLEY_MASS) * 9.81) / 2;
  const half =
    Math.max(...offsets.map((x, i) => x + linked.rigs[i].geometry.handX)) +
    RIG_MARGIN;

  useEffect(() => {
    if (command.id === lastCommand.current) return;
    lastCommand.current = command.id;
    if (command.action === 'pull' || command.action === 'trigger')
      linked.pullBy(2);
    else if (command.action === 'lower') linked.pullBy(-2);
  }, [command, linked]);

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
    drag.current = { offset: hit.y - linked.hand };
    setDragging?.(true);
    gl.domElement.style.cursor = 'grabbing';
  };

  useFrame((_, dt) => {
    linked.setLoad(settings.loadMass, settings.gravity);
    if (drag.current) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(plane, hit))
        linked.setTarget(hit.y - drag.current.offset);
    }
    const peaks = stepPeaks.current;
    linked.rigs.forEach((rig, i) => {
      peaks[i] = 0;
      if (!settings.paused)
        rig.advance(Math.min(dt, 0.1) * settings.speed, () => {
          peaks[i] = Math.max(peaks[i], rig.tension);
        });
      sample.current.peaks[i] = Math.max(
        sample.current.peaks[i] ?? 0,
        peaks[i],
      );
      drawers.current[i]?.(dt);
    });
    bar.current?.position.setY(linked.hand);
    sample.current.frames++;
    sample.current.time += dt;
    if (sample.current.time >= 0.4) {
      onMetrics({
        fps: Math.round(sample.current.frames / sample.current.time),
        bodies: linked.rigs.length * 2,
        energy: Math.round(linked.rigs.reduce((e, r) => e + r.kinetic, 0)),
        pulley: {
          pulled: linked.rigs[0].pulled,
          rigs: linked.rigs.map((r, i) => ({
            strands: r.strands,
            tension: r.tension,
            peak: sample.current.peaks[i] ?? 0,
            raised: r.raised,
            slack: r.slack,
          })),
        },
      });
      sample.current = { frames: 0, time: 0, peaks: [] };
    }
  });

  const hands = linked.rigs.map((r, i) => offsets[i] + r.geometry.handX);
  return (
    <group name="pulley-cathedral">
      <Nave half={half} />
      <mesh position={[0, BEAM_Y + 0.25, 0]} castShadow>
        <boxGeometry args={[half * 2 + 0.4, 0.5, 0.7]} />
        <meshStandardMaterial color="#3a3026" metalness={0.3} roughness={0.7} />
      </mesh>
      {linked.rigs.map((rig, i) => (
        <Rig
          key={`${settings.pulleyRig}-${i}`}
          rig={rig}
          x={offsets[i]}
          plates={plateCount(settings.loadMass)}
          reference={reference}
          grab={grab}
          register={(draw) => (drawers.current[i] = draw)}
        />
      ))}
      {linked.rigs.length > 1 && (
        // One bar holds every free end, so each rig is pulled the same length.
        <group ref={bar} position={[0, HAND_START, 0]}>
          <mesh
            position={[(hands[0] + hands[hands.length - 1]) / 2, 0, 0.45]}
            rotation={[0, 0, Math.PI / 2]}
            onPointerDown={grab}
          >
            <cylinderGeometry
              args={[0.07, 0.07, hands[hands.length - 1] - hands[0] + 0.4, 12]}
            />
            <meshStandardMaterial
              color={BRASS}
              emissive="#ffb057"
              emissiveIntensity={0.9}
              metalness={0.8}
              toneMapped={false}
            />
          </mesh>
          {hands.map((x) => (
            <mesh
              key={x}
              position={[x, 0, 0.22]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.03, 0.03, 0.45, 8]} />
              <meshStandardMaterial color={STEEL} metalness={0.85} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function Rig({
  rig,
  x,
  plates,
  reference,
  grab,
  register,
}: {
  rig: PulleySystem;
  x: number;
  plates: number;
  reference: number;
  grab: (event: ThreeEvent<PointerEvent>) => void;
  register: (draw: (dt: number) => void) => void;
}) {
  const { xs, sheaves, anchoredToBeam, handX } = rig.geometry;
  const rope = useRef<Mesh>(null),
    ropeMaterial = useRef<MeshStandardMaterial>(null),
    load = useRef<Group>(null),
    handle = useRef<Group>(null),
    handMarker = useRef<Mesh>(null),
    loadMarker = useRef<Mesh>(null),
    spins = useRef<(Group | null)[]>([]),
    flash = useRef(0);
  const path = useMemo<number[]>(() => [], []);
  const tint = useMemo(() => new Color(), []);
  const movable = sheaves.map((s, j) => ({ ...s, j })).filter((s) => !s.top);
  const fixed = sheaves.map((s, j) => ({ ...s, j })).filter((s) => s.top);
  const ticks = Math.floor(HAND_START - rig.handMin) + 1;

  const draw = (dt: number) => {
    load.current?.position.setY(rig.height);
    sheaves.forEach((_, j) => {
      const spin = spins.current[j];
      if (spin) spin.rotation.z = rig.angles[j];
    });
    handle.current?.position.setY(rig.hand);
    handMarker.current?.position.setY(rig.hand);
    loadMarker.current?.position.setY(rig.height - CRATE_DROP);
    // Hold a catch spike on the rope briefly so a one-step impulse is visible.
    flash.current = Math.max(rig.tension, flash.current * Math.exp(-dt * 5));
    const ratio = flash.current / reference;
    const material = ropeMaterial.current;
    if (material) {
      material.emissive.copy(tensionColor(ratio, tint));
      material.emissiveIntensity = rig.slack
        ? 0.35
        : 0.9 + Math.min(ratio, 6) * 0.45;
    }
    const mesh = rope.current;
    if (!mesh) return;
    ropePath(rig, path);
    const points: Vector3[] = [];
    for (let i = 0; i < path.length; i += 2)
      points.push(new Vector3(path[i], path[i + 1], 0));
    const curve = new CatmullRomCurve3(points, false, 'centripetal');
    const previous = mesh.geometry;
    mesh.geometry = new TubeGeometry(curve, points.length * 2, 0.05, 8, false);
    previous.dispose();
  };
  useEffect(() => {
    register(draw);
    draw(0);
  });

  const blockLeft = Math.min(0, ...movable.map((s) => s.x)),
    blockRight = Math.max(0, ...movable.map((s) => s.x));
  return (
    <group name={`pulley-rig-${rig.strands}`} position={[x, 0, 0]}>
      {fixed.map((s) => (
        <group key={s.j}>
          <mesh position={[s.x, (BEAM_Y + FIXED_Y) / 2, 0]}>
            <boxGeometry args={[0.16, BEAM_Y - FIXED_Y, 0.36]} />
            <meshStandardMaterial
              color={STEEL}
              metalness={0.85}
              roughness={0.3}
            />
          </mesh>
          <group position={[s.x, FIXED_Y, 0]}>
            <Wheel spin={(g) => (spins.current[s.j] = g)} />
          </group>
        </group>
      ))}
      {anchoredToBeam && (
        <mesh position={[xs[0], BEAM_Y - 0.05, 0]}>
          <torusGeometry args={[0.12, 0.035, 8, 20]} />
          <meshStandardMaterial
            color={BRASS}
            metalness={0.9}
            roughness={0.25}
          />
        </mesh>
      )}
      <group ref={load} position={[0, LOAD_START, 0]}>
        {movable.map((s) => (
          <group key={s.j} position={[s.x, 0, 0]}>
            <Wheel spin={(g) => (spins.current[s.j] = g)} />
          </group>
        ))}
        {/* Yoke: links every movable sheave, the becket, and the hook. */}
        <mesh position={[(blockLeft + blockRight) / 2, 0, 0]}>
          <boxGeometry args={[blockRight - blockLeft + 0.3, 0.12, 0.42]} />
          <meshStandardMaterial
            color={STEEL}
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, -0.36, 0]}>
          <boxGeometry args={[0.14, 0.6, 0.3]} />
          <meshStandardMaterial
            color={STEEL}
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
        <Cage plates={plates} />
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
      <group ref={handle} position={[handX, HAND_START, 0]}>
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
        x={handX + 0.55}
        from={HAND_START}
        step={-1}
        count={ticks}
        marker={handMarker}
      />
      <Scale
        x={xs[0] - 0.75}
        from={LOAD_START - CRATE_DROP}
        step={1 / rig.strands}
        count={ticks}
        marker={loadMarker}
      />
      <mesh position={[0, LOAD_FLOOR - CRATE_DROP - CRATE_SIZE / 2 - 0.02, 0]}>
        <boxGeometry args={[1.6, 0.04, 1.6]} />
        <meshStandardMaterial color="#302820" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Open steel cage holding one plate per 10 kg of load. */
function Cage({ plates }: { plates: number }) {
  const s = CRATE_SIZE,
    y = -CRATE_DROP;
  return (
    <group position={[0, y, 0]}>
      {[-1, 1].map((py) => (
        <mesh key={py} position={[0, (py * s) / 2, 0]} castShadow>
          <boxGeometry args={[s, 0.05, s]} />
          <meshStandardMaterial
            color="#1c1f22"
            metalness={0.7}
            roughness={0.35}
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
function Wheel({ spin }: { spin: (group: Group | null) => void }) {
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
 * 1/n metre, so matching tick numbers line up under an n:1 advantage.
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

/**
 * Stone piers, pointed ribs, and faint lancet windows around the machines.
 * `half` is the half-width the machines need; the nave widens to fit.
 */
function Nave({ half }: { half: number }) {
  // Two arcs of radius R centred ±a from the axis meet in a pointed apex.
  const pier = Math.max(4.2, half + 0.8),
    a = 0.8,
    R = pier + a,
    spring = 8,
    apex = Math.acos(-a / R);
  const windows = Math.max(2, Math.round(pier / 2.1));
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
      {Array.from({ length: windows }, (_, i) => {
        const x = -pier + ((i + 0.5) * 2 * pier) / windows;
        return (
          <mesh key={i} position={[x, 6.5, -0.6]}>
            <planeGeometry args={[0.55, 5]} />
            <meshBasicMaterial color="#ffb057" transparent opacity={0.12} />
          </mesh>
        );
      })}
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
