'use client';
/* oxlint-disable react/react-compiler -- Field buffers, magnet transforms, and drag state are mutated outside React rendering. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  Plane,
  Vector3,
  type BufferAttribute,
  type BufferGeometry,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
} from 'three';
import {
  FieldLines,
  FluxParticles,
  MagneticField,
  MAGNET_LENGTH,
  MAGNET_Y,
  POLE_OFFSET,
  magnetLayout,
} from '@/lib/magnetism';
import type { Command, LabSettings, Metrics } from '@/lib/lab';

export const MAGNET_TINTS = ['#ff7ab8', '#6fd6ff', '#b69cff', '#ffd27a'];
export const MAGNET_NAMES = ['A', 'B', 'C', 'D'];
const TINT_COLORS = MAGNET_TINTS.map((t) => new Color(t));
const NORTH = new Color('#ff4468'),
  SOUTH = new Color('#3b82ff'),
  NEUTRAL = new Color('#5b6470');
const weak = new Color('#3fd4ff'),
  mid = new Color('#ff5fb4'),
  hot = new Color('#fff1d6');

/** Maps |B| to a cool → magenta → white-hot ramp on a log scale. */
export function fluxColor(magnitude: number, out = new Color()) {
  const t = Math.min(
    1,
    Math.max(0, (Math.log10(magnitude + 1e-6) + 1.4) / 2.4),
  );
  return t < 0.55
    ? out.copy(weak).lerp(mid, t / 0.55)
    : out.copy(mid).lerp(hot, (t - 0.55) / 0.45);
}

export function particleCount(quality: LabSettings['quality']) {
  return quality === 'low' ? 700 : 1800;
}

export function FieldLoom({
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
  const count = particleCount(settings.quality);
  const scene = useMemo(() => {
    const field = new MagneticField(magnetLayout(settings.magnetCount));
    const lines = new FieldLines();
    lines.retrace(field);
    return { field, lines, traced: field.version, selected: field.count - 1 };
  }, [settings.magnetCount]);
  const flux = useMemo(() => {
    const particles = new FluxParticles(scene.field, count);
    // Warm up so the loom opens already woven rather than bursting from the poles.
    particles.advance(2.5);
    return {
      particles,
      positions: new Float32Array(count * 6),
      colors: new Float32Array(count * 6),
    };
  }, [scene, count]);
  const threadColors = useMemo(
    () => new Float32Array(scene.lines.positions.length),
    [scene],
  );
  const magnets = useRef<(Group | null)[]>([]),
    halves = useRef<(MeshStandardMaterial | null)[]>([]),
    ring = useRef<Mesh>(null);
  const particleGeometry = useRef<BufferGeometry>(null),
    threadGeometry = useRef<BufferGeometry>(null);
  const lastCommand = useRef(command.id),
    sample = useRef({ frames: 0, time: 0 });
  const drag = useRef<{ index: number; offset: Vector3 } | null>(null);
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), -MAGNET_Y), []);
  const hit = useMemo(() => new Vector3(), []);

  const paintThreads = () => {
    const { lines } = scene;
    for (let v = 0; v < lines.segments * 2; v++) {
      const c = TINT_COLORS[lines.owners[v]];
      const glow = Math.min(1, 0.25 + Math.sqrt(lines.magnitudes[v]) * 0.35);
      threadColors[v * 3] = c.r * glow;
      threadColors[v * 3 + 1] = c.g * glow;
      threadColors[v * 3 + 2] = c.b * glow;
    }
    const g = threadGeometry.current;
    if (!g) return;
    g.setDrawRange(0, lines.segments * 2);
    (g.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('color') as BufferAttribute).needsUpdate = true;
  };

  const paintParticles = () => {
    const { particles, positions, colors } = flux,
      c = new Color();
    for (let i = 0; i < count; i++) {
      const b = i * 3,
        v = i * 6;
      positions[v] = particles.positions[b];
      positions[v + 1] = particles.positions[b + 1];
      positions[v + 2] = particles.positions[b + 2];
      positions[v + 3] = particles.tails[b];
      positions[v + 4] = particles.tails[b + 1];
      positions[v + 5] = particles.tails[b + 2];
      const age = particles.ages[i],
        life = particles.lives[i];
      const fade =
        life <= 0
          ? 0
          : Math.min(1, age / 0.35, (life - age) / 0.6) *
            (0.9 + settings.strength * 0.5);
      fluxColor(particles.magnitudes[i], c).multiplyScalar(
        Math.max(0, fade) * 1.6,
      );
      // The tail vertex stays black, so additive blending fades each streak.
      colors[v] = c.r;
      colors[v + 1] = c.g;
      colors[v + 2] = c.b;
    }
    const g = particleGeometry.current;
    if (!g) return;
    (g.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('color') as BufferAttribute).needsUpdate = true;
  };

  const placeMagnets = () => {
    const c = new Color();
    scene.field.magnets.forEach((m, i) => {
      const group = magnets.current[i];
      if (group) {
        group.position.set(m.x, MAGNET_Y, m.z);
        group.rotation.set(0, -m.heading, 0);
      }
      // Tip colours follow the live moment, greying out as it passes zero.
      const s = (m.moment + 1) / 2;
      const [front, back] = [halves.current[i * 2], halves.current[i * 2 + 1]];
      if (front) {
        c.copy(SOUTH)
          .lerp(NORTH, s)
          .lerp(NEUTRAL, 1 - Math.abs(m.moment));
        front.color.copy(c);
        front.emissive.copy(c);
        front.emissiveIntensity = 0.25 + Math.abs(m.moment) * 0.6;
      }
      if (back) {
        c.copy(NORTH)
          .lerp(SOUTH, s)
          .lerp(NEUTRAL, 1 - Math.abs(m.moment));
        back.color.copy(c);
        back.emissive.copy(c);
        back.emissiveIntensity = 0.25 + Math.abs(m.moment) * 0.6;
      }
    });
    const chosen = scene.field.magnets[scene.selected];
    if (ring.current && chosen) {
      ring.current.position.set(chosen.x, 0.02, chosen.z);
      (ring.current.material as MeshBasicMaterial).color.set(
        MAGNET_TINTS[scene.selected],
      );
    }
  };

  useEffect(() => {
    paintThreads();
    paintParticles();
    placeMagnets();
  });

  useEffect(() => {
    if (command.id === lastCommand.current) return;
    lastCommand.current = command.id;
    const { field } = scene;
    if (command.action === 'flip' || command.action === 'trigger')
      field.flip(scene.selected);
    else if (command.action === 'flip-all')
      for (let i = 0; i < field.count; i++) field.flip(i);
    else if (command.action === 'rotate')
      field.rotate(scene.selected, Math.PI / 4);
  }, [command, scene]);

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

  const grab = (index: number) => (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    scene.selected = index;
    const m = scene.field.magnets[index];
    event.ray.intersectPlane(plane, hit);
    drag.current = {
      index,
      offset: new Vector3(hit.x - m.x, 0, hit.z - m.z),
    };
    setDragging?.(true);
    gl.domElement.style.cursor = 'grabbing';
  };

  useFrame((_, dt) => {
    const { field, lines } = scene;
    const held = drag.current;
    if (held) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(plane, hit))
        field.move(held.index, hit.x - held.offset.x, hit.z - held.offset.z);
    }
    if (!settings.paused) {
      const step = Math.min(dt, 0.1) * settings.speed;
      field.advance(step);
      flux.particles.advance(step, settings.strength);
    }
    if (scene.traced !== field.version) {
      lines.retrace(field);
      scene.traced = field.version;
      paintThreads();
    }
    paintParticles();
    placeMagnets();
    sample.current.frames++;
    sample.current.time += dt;
    if (sample.current.time >= 0.4) {
      onMetrics({
        fps: Math.round(sample.current.frames / sample.current.time),
        bodies: field.count,
        energy: 0,
        loom: {
          lines: lines.lines,
          linked: lines.linked,
          particles: count,
          selected: scene.selected,
        },
      });
      sample.current = { frames: 0, time: 0 };
    }
  });

  return (
    <group name="magnetic-field-loom">
      <lineSegments
        name="field-threads"
        frustumCulled={false}
        visible={settings.fieldThreads}
      >
        <bufferGeometry
          ref={threadGeometry}
          key={`threads-${settings.magnetCount}`}
        >
          <bufferAttribute
            attach="attributes-position"
            args={[scene.lines.positions, 3]}
            usage={DynamicDrawUsage}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[threadColors, 3]}
            usage={DynamicDrawUsage}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.55}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <lineSegments name="flux-particles" frustumCulled={false} renderOrder={1}>
        <bufferGeometry
          ref={particleGeometry}
          key={`flux-${settings.magnetCount}-${count}`}
        >
          <bufferAttribute
            attach="attributes-position"
            args={[flux.positions, 3]}
            usage={DynamicDrawUsage}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[flux.colors, 3]}
            usage={DynamicDrawUsage}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      {scene.field.magnets.map((_, i) => (
        <group
          key={`${settings.magnetCount}-${i}`}
          name={`magnet-${MAGNET_NAMES[i]}`}
          ref={(g) => {
            magnets.current[i] = g;
          }}
          onPointerDown={grab(i)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            scene.selected = i;
            scene.field.flip(i);
          }}
          onPointerOver={() => {
            if (!drag.current) gl.domElement.style.cursor = 'grab';
          }}
          onPointerOut={() => {
            if (!drag.current) gl.domElement.style.cursor = 'auto';
          }}
        >
          {[1, -1].map((side, j) => (
            <mesh
              key={side}
              position={[(side * MAGNET_LENGTH) / 4, 0, 0]}
              castShadow
            >
              <boxGeometry args={[MAGNET_LENGTH / 2 - 0.02, 0.42, 0.42]} />
              <meshStandardMaterial
                ref={(m) => {
                  halves.current[i * 2 + j] = m;
                }}
                metalness={0.55}
                roughness={0.3}
              />
            </mesh>
          ))}
          <mesh>
            <boxGeometry args={[0.06, 0.46, 0.46]} />
            <meshStandardMaterial
              color="#d8e2ea"
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
          {[POLE_OFFSET, -POLE_OFFSET].map((x) => (
            <mesh key={x} position={[x, 0.24, 0]}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshBasicMaterial color={MAGNET_TINTS[i]} toneMapped={false} />
            </mesh>
          ))}
          <mesh
            position={[0, -MAGNET_Y + 0.03, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[0.9, 32]} />
            <meshBasicMaterial
              color="#000000"
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
      <mesh ref={ring} name="selected-magnet" rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.12, 1.2, 64]} />
        <meshBasicMaterial color={MAGNET_TINTS[0]} toneMapped={false} />
      </mesh>
    </group>
  );
}
