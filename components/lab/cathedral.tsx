'use client';
/* oxlint-disable react/react-compiler -- The pulley solver, rope geometry, and drag state are mutated outside React rendering. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  EdgesGeometry,
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
  ropePath,
  type PulleySystem,
} from '@/lib/pulley';
import type { Command, LabSettings, Metrics } from '@/lib/lab';
import {
  Arrow,
  BRASS,
  Cage,
  Nave,
  STEEL,
  Scale,
  Wheel,
  plateCount,
  restTint,
  slackTint,
  tensionColor,
  type ArrowSetter,
} from './cathedral-parts';

import { CounterweightLift } from './lift';

export { plateCount, tensionColor } from './cathedral-parts';

/** Room beyond a rig's lanyard reel (left) and pull scale (right). */
const LEFT_PAD = 0.35,
  RIGHT_PAD = 0.8,
  RIG_GAP = 0.5;
const lanyardIdle = new Color('#5d6670'),
  lanyardHot = new Color('#ffb057');

/** Rig x offsets, packed left to right and centred on the nave. */
export function rigOffsets(rigs: PulleySystem[]) {
  const spans = rigs.map((r) => ({
    left: r.geometry.lanyardX - LEFT_PAD,
    right: r.geometry.handX + RIGHT_PAD,
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

export function PulleyCathedral(props: {
  settings: LabSettings;
  command: Command;
  onMetrics: (metrics: Metrics) => void;
  setDragging?: (v: boolean) => void;
}) {
  return props.settings.pulleyRig === 'lift' ? (
    <CounterweightLift {...props} />
  ) : (
    <PulleyRigs {...props} />
  );
}

function PulleyRigs({
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
  // Load and rating are applied live every frame; only a rig change restarts.
  const load = useRef({
    mass: settings.loadMass,
    gravity: settings.gravity,
    rating: settings.ropeRating,
  });
  load.current = {
    mass: settings.loadMass,
    gravity: settings.gravity,
    rating: settings.ropeRating,
  };
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
    sample = useRef({
      frames: 0,
      time: 0,
      peaks: [] as number[],
      strains: [] as number[],
    });
  const drag = useRef<{ offset: number } | null>(null);
  const plane = useMemo(() => new Plane(new Vector3(0, 0, 1), 0), []);
  const hit = useMemo(() => new Vector3(), []);
  const reference = ((settings.loadMass + PULLEY_MASS) * 9.81) / 2;
  const half = Math.max(
    ...offsets.map((x, i) => {
      const g = linked.rigs[i].geometry;
      return Math.max(x + g.handX + RIGHT_PAD, -(x + g.lanyardX - LEFT_PAD));
    }),
  );

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
    linked.setLoad(settings.loadMass, settings.gravity, settings.ropeRating);
    if (drag.current) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(plane, hit))
        linked.setTarget(hit.y - drag.current.offset);
    }
    const { peaks, strains } = sample.current;
    linked.rigs.forEach((rig, i) => {
      if (!settings.paused)
        rig.advance(Math.min(dt, 0.1) * settings.speed, () => {
          peaks[i] = Math.max(peaks[i] ?? 0, rig.tension);
          strains[i] = Math.max(strains[i] ?? 0, rig.strain);
        });
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
            peak: peaks[i] ?? r.tension,
            strain: strains[i] ?? r.strain,
            raised: r.raised,
            slack: r.slack,
            snapped: r.snapped,
          })),
        },
      });
      sample.current = {
        frames: 0,
        time: 0,
        peaks: [],
        strains: [],
      };
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
          lens={settings.forceLens}
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
  lens,
  grab,
  register,
}: {
  rig: PulleySystem;
  x: number;
  plates: number;
  reference: number;
  lens: boolean;
  grab: (event: ThreeEvent<PointerEvent>) => void;
  register: (draw: (dt: number) => void) => void;
}) {
  const { xs, sheaves, anchoredToBeam, handX, lanyardX } = rig.geometry;
  const rope = useRef<Mesh>(null),
    ropeMaterial = useRef<MeshStandardMaterial>(null),
    lanyard = useRef<Mesh>(null),
    lanyardMaterial = useRef<MeshStandardMaterial>(null),
    load = useRef<Group>(null),
    ghost = useRef<Group>(null),
    handle = useRef<Group>(null),
    handMarker = useRef<Mesh>(null),
    loadMarker = useRef<Mesh>(null),
    spins = useRef<(Group | null)[]>([]),
    arrows = useRef<ArrowSetter[]>([]),
    flash = useRef(0),
    lanyardFlash = useRef(0),
    tilt = useRef(0);
  const path = useMemo<number[]>(() => [], []);
  const tint = useMemo(() => new Color(), []);
  const ghostEdges = useMemo(
    () =>
      new EdgesGeometry(new BoxGeometry(CRATE_SIZE, CRATE_SIZE, CRATE_SIZE)),
    [],
  );
  const movable = sheaves.map((s, j) => ({ ...s, j })).filter((s) => !s.top);
  const fixed = sheaves.map((s, j) => ({ ...s, j })).filter((s) => s.top);
  const ticks = Math.floor(HAND_START - rig.handMin) + 1;
  const reelY = BEAM_Y - 0.25;

  const draw = (dt: number) => {
    const h = rig.height;
    // Hang along the lanyard once it holds the load; upright otherwise.
    const target =
      rig.snapped && !rig.grounded
        ? Math.atan2(rig.x - lanyardX, BEAM_Y - h)
        : 0;
    tilt.current += (target - tilt.current) * (1 - Math.exp(-dt * 10));
    load.current?.position.set(rig.x, h, 0);
    if (load.current) load.current.rotation.z = tilt.current;
    sheaves.forEach((_, j) => {
      const spin = spins.current[j];
      if (spin) spin.rotation.z = rig.angles[j];
    });
    handle.current?.position.setY(rig.hand);
    handMarker.current?.position.setY(rig.hand);
    loadMarker.current?.position.setY(h - CRATE_DROP);
    // Hold a catch spike on the rope briefly so a one-step impulse is visible.
    flash.current = Math.max(rig.tension, flash.current * Math.exp(-dt * 5));
    const ratio = flash.current / reference;
    const material = ropeMaterial.current;
    if (material) {
      if (rig.snapped) material.emissive.copy(slackTint);
      else material.emissive.copy(tensionColor(ratio, tint));
      material.emissiveIntensity =
        rig.slack || rig.snapped ? 0.35 : 0.9 + Math.min(ratio, 6) * 0.45;
    }
    // Lanyard: reel on the beam to the top of the block.
    const line = lanyard.current;
    if (line) {
      const dx = rig.x - lanyardX,
        dy = h + 0.1 - reelY,
        length = Math.hypot(dx, dy);
      line.position.set((lanyardX + rig.x) / 2, (reelY + h + 0.1) / 2, -0.05);
      line.rotation.z = Math.atan2(-dx, dy);
      line.scale.y = length;
    }
    lanyardFlash.current = Math.max(
      rig.lanyardTension / reference,
      lanyardFlash.current * Math.exp(-dt * 3),
    );
    const lm = lanyardMaterial.current;
    if (lm) {
      lm.emissive
        .copy(lanyardIdle)
        .lerp(lanyardHot, Math.min(1, lanyardFlash.current));
      lm.emissiveIntensity = rig.snapped ? 1.2 : 0.25;
    }
    if (lens) {
      const [weight, hand, ...strands] = arrows.current;
      weight?.(rig.x, h - CRATE_DROP, false, rig.totalMass * rig.gravity);
      hand?.(handX, rig.hand - 0.3, false, rig.snapped ? 0 : rig.tension);
      strands.forEach((set, j) =>
        set(xs[j], h + 0.25, true, rig.snapped ? 0 : rig.tension),
      );
      // Ghost: where the load settles once the hand reaches its target.
      const settle = Math.max(
        LOAD_FLOOR,
        (rig.reach - rig.target) / rig.strands,
      );
      if (ghost.current) {
        ghost.current.visible = !rig.snapped && Math.abs(settle - h) > 0.05;
        ghost.current.position.setY(settle - CRATE_DROP);
      }
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
  const bind = (i: number) => (set: ArrowSetter) => (arrows.current[i] = set);
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
      {/* Self-retracting safety lanyard: reel housing and its steel line. */}
      <mesh position={[lanyardX, reelY + 0.08, -0.05]}>
        <cylinderGeometry args={[0.2, 0.2, 0.18, 20]} />
        <meshStandardMaterial color="#b3432f" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh name="pulley-lanyard" ref={lanyard}>
        <cylinderGeometry args={[0.018, 0.018, 1, 6]} />
        <meshStandardMaterial
          ref={lanyardMaterial}
          color="#3a3f44"
          emissive={lanyardIdle}
          emissiveIntensity={0.25}
          metalness={0.8}
          toneMapped={false}
        />
      </mesh>
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
      {lens && (
        <group name="force-lens">
          <Arrow color="#ff7a59" bind={bind(0)} />
          <Arrow color="#ffb057" bind={bind(1)} />
          {Array.from({ length: rig.strands }, (_, j) => (
            <Arrow key={j} color="#6fe3ff" bind={bind(j + 2)} />
          ))}
          <group ref={ghost} name="pulley-ghost" visible={false}>
            <lineSegments geometry={ghostEdges}>
              <lineBasicMaterial color="#ffe2b8" transparent opacity={0.45} />
            </lineSegments>
          </group>
        </group>
      )}
    </group>
  );
}
