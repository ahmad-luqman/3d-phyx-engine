'use client';
/* oxlint-disable react/react-compiler -- Fixed-step simulation buffers and Three.js instances are mutated outside React rendering. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  Object3D,
  type BufferAttribute,
  type InstancedMesh,
  type ShaderMaterial,
} from 'three';
import {
  PendulumEnsemble,
  PENDULUM_LENGTH,
  PENDULUM_PIVOT,
} from '@/lib/pendulum';
import { GhostTrailHistory } from '@/lib/ghost-trails';
import type { Command, LabSettings, Metrics } from '@/lib/lab';
const vertex = `attribute vec3 tint; attribute float born; varying vec3 vTint; varying float vBorn; void main(){vTint=tint;vBorn=born;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment = `uniform float uTime;uniform float uDuration;varying vec3 vTint;varying float vBorn;void main(){float age=uTime-vBorn;if(age<0.||age>uDuration)discard;float fade=pow(1.-age/uDuration,1.7);gl_FragColor=vec4(vTint*1.8,fade*.48);}`;
export function ghostColor(index: number, count: number) {
  const t = index / Math.max(1, count - 1);
  return new Color().setHSL(0.48 + t * 0.4, 0.82, 0.63);
}
export function PendulumGhosts({
  settings,
  command,
  onMetrics,
}: {
  settings: LabSettings;
  command: Command;
  onMetrics: (metrics: Metrics) => void;
}) {
  const rods = useRef<InstancedMesh>(null),
    bobs = useRef<InstancedMesh>(null),
    trailMaterial = useRef<ShaderMaterial>(null);
  const positionAttribute = useRef<BufferAttribute>(null),
    timeAttribute = useRef<BufferAttribute>(null);
  const lastCommand = useRef(command.id),
    sample = useRef({ frames: 0, time: 0 });
  const runtime = useMemo(() => {
    const model = new PendulumEnsemble({
      count: settings.ghostCount,
      angle: settings.ghostAngle,
      separation: settings.ghostSeparation,
      gravity: settings.gravity,
    });
    const history = new GhostTrailHistory(settings.ghostCount);
    history.clear(model);
    model.advance(settings.ghostStart, () => history.sample(model));
    return { model, history };
  }, [
    settings.ghostCount,
    settings.ghostAngle,
    settings.ghostSeparation,
    settings.gravity,
    settings.ghostStart,
  ]);
  const tint = useMemo(() => {
    const colors = new Float32Array(runtime.history.positions.length);
    for (let i = 0; i < settings.ghostCount; i++) {
      const c = ghostColor(i, settings.ghostCount);
      for (let j = 0; j < runtime.history.capacity * 2; j++) {
        const base = (i * runtime.history.capacity * 2 + j) * 3;
        colors[base] = c.r;
        colors[base + 1] = c.g;
        colors[base + 2] = c.b;
      }
    }
    return colors;
  }, [runtime, settings.ghostCount]);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uDuration: { value: 8 } }),
    [],
  );
  const dummy = useMemo(() => new Object3D(), []);
  const drawBodies = () => {
    if (!rods.current || !bobs.current) return;
    const point = { x1: 0, y1: 0, x2: 0, y2: 0 };
    for (let i = 0; i < settings.ghostCount; i++) {
      runtime.model.points(i, point);
      const z = (i / Math.max(1, settings.ghostCount - 1) - 0.5) * 0.65;
      for (let j = 0; j < 2; j++) {
        const a = runtime.model.state[i * 4 + j],
          x = j === 0 ? 0 : point.x1,
          y = j === 0 ? PENDULUM_PIVOT : point.y1;
        const endX = j === 0 ? point.x1 : point.x2,
          endY = j === 0 ? point.y1 : point.y2;
        dummy.position.set((x + endX) / 2, (y + endY) / 2, z);
        dummy.rotation.set(0, 0, a);
        dummy.scale.set(i === 0 ? 1.4 : 1, PENDULUM_LENGTH, 1);
        dummy.updateMatrix();
        if (i > 0 && !settings.ghostArms) {
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
        }
        rods.current.setMatrixAt(i * 2 + j, dummy.matrix);
        dummy.position.set(endX, endY, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(i === 0 ? 0.11 : j === 0 ? 0.045 : 0.067);
        dummy.updateMatrix();
        bobs.current.setMatrixAt(i * 2 + j, dummy.matrix);
      }
    }
    rods.current.instanceMatrix.needsUpdate = true;
    bobs.current.instanceMatrix.needsUpdate = true;
  };
  useLayoutEffect(() => {
    for (let i = 0; i < settings.ghostCount; i++)
      for (let j = 0; j < 2; j++) {
        const c =
          i === 0 ? new Color('#f3fdff') : ghostColor(i, settings.ghostCount);
        rods.current?.setColorAt(i * 2 + j, c);
        bobs.current?.setColorAt(i * 2 + j, c.multiplyScalar(2));
      }
    if (rods.current?.instanceColor)
      rods.current.instanceColor.needsUpdate = true;
    if (bobs.current?.instanceColor)
      bobs.current.instanceColor.needsUpdate = true;
    drawBodies();
  });
  useEffect(() => {
    if (command.id === lastCommand.current) return;
    lastCommand.current = command.id;
    if (command.action === 'trigger') {
      runtime.model = new PendulumEnsemble(runtime.model.options);
      runtime.history.clear(runtime.model);
    } else if (command.action === 'advance')
      runtime.model.advance(20, () => runtime.history.sample(runtime.model));
    else if (command.action === 'clear-trails')
      runtime.history.clear(runtime.model);
  }, [command, runtime]);
  useFrame((_, dt) => {
    if (!settings.paused)
      runtime.model.advance(Math.min(dt, 0.1) * settings.speed, () => {
        if (settings.quality !== 'low' || runtime.model.steps % 8 === 0)
          runtime.history.sample(runtime.model);
      });
    drawBodies();
    if (positionAttribute.current) positionAttribute.current.needsUpdate = true;
    if (timeAttribute.current) timeAttribute.current.needsUpdate = true;
    if (trailMaterial.current) {
      trailMaterial.current.uniforms.uTime.value = runtime.model.time;
      trailMaterial.current.uniforms.uDuration.value = settings.ghostTrail;
    }
    sample.current.frames++;
    sample.current.time += dt;
    if (sample.current.time >= 0.4) {
      const energy = runtime.model.energy(0);
      onMetrics({
        fps: Math.round(sample.current.frames / sample.current.time),
        bodies: settings.ghostCount * 2,
        energy: Math.round(energy.kinetic),
        ghosts: {
          elapsed: runtime.model.time,
          separation: runtime.model.separation(),
          energyDrift: Math.abs(energy.total - runtime.model.initialEnergy),
        },
      });
      sample.current = { frames: 0, time: 0 };
    }
  });
  return (
    <group name="pendulum-ghosts">
      <lineSegments
        name="ghost-trajectories"
        frustumCulled={false}
        renderOrder={1}
      >
        <bufferGeometry
          key={[
            settings.ghostCount,
            settings.ghostAngle,
            settings.ghostSeparation,
            settings.gravity,
            settings.ghostStart,
          ].join(':')}
        >
          <bufferAttribute
            ref={positionAttribute}
            attach="attributes-position"
            args={[runtime.history.positions, 3]}
            usage={DynamicDrawUsage}
          />
          <bufferAttribute
            ref={timeAttribute}
            attach="attributes-born"
            args={[runtime.history.times, 1]}
            usage={DynamicDrawUsage}
          />
          <bufferAttribute attach="attributes-tint" args={[tint, 3]} />
        </bufferGeometry>
        <shaderMaterial
          ref={trailMaterial}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={uniforms}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <instancedMesh
        name="ghost-arms"
        ref={rods}
        args={[undefined, undefined, settings.ghostCount * 2]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.017, 0.017, 1, 6]} />
        <meshBasicMaterial
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        name="ghost-bobs"
        ref={bobs}
        args={[undefined, undefined, settings.ghostCount * 2]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <group name="pendulum-gantry">
        {[-5.5, 5.5].map((x) => (
          <group key={x}>
            <mesh position={[x, 2.8, -1.1]} castShadow>
              <boxGeometry args={[0.12, 5.6, 0.22]} />
              <meshStandardMaterial
                color="#42545e"
                roughness={0.25}
                metalness={0.8}
              />
            </mesh>
            <mesh position={[x, 0.08, -1.1]}>
              <cylinderGeometry args={[0.36, 0.42, 0.16, 24]} />
              <meshStandardMaterial
                color="#587182"
                metalness={0.7}
                roughness={0.25}
              />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 5.55, -1.1]}>
          <boxGeometry args={[11.1, 0.13, 0.22]} />
          <meshStandardMaterial
            color="#637583"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        <mesh
          position={[0, PENDULUM_PIVOT, -0.35]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.11, 0.11, 1.65, 24]} />
          <meshStandardMaterial
            color="#a8cbd5"
            metalness={0.7}
            roughness={0.2}
          />
        </mesh>
        <mesh
          position={[0, PENDULUM_PIVOT, 0.5]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.17, 0.035, 8, 32]} />
          <meshBasicMaterial color="#c9fbff" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
