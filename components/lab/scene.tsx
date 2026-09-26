'use client';
import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { PCFShadowMap, Vector3, type Group } from 'three';
import {
  usesRapier,
  type LabSettings,
  type Metrics,
  type Command,
  type DemoId,
  type Vec3,
} from '@/lib/lab';

import {
  Foundry,
  IntroducedMatter,
  Simulation,
  type DragState,
} from './physics';

import { ChainReaction } from './chain';

import { OrbitalReactor } from './orbit';

import { DestructionChamber } from './destruction';

import { MagneticSwarm } from './swarm';

import { Singularity } from './singularity';

import { PendulumGhosts } from './ghosts';
import { FieldLoom } from './loom';
import { PulleyCathedral } from './cathedral';
import { AdaptiveQuality } from './resilience';

function Stage({ color }: { color: string }) {
  const ring = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.y += dt * 0.025;
  });
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[12, 0.3, 12]} position={[0, -0.35, 0]} />
      </RigidBody>
      <mesh receiveShadow position={[0, -0.4, 0]}>
        <cylinderGeometry args={[11.6, 11.8, 0.65, 96]} />
        <meshStandardMaterial
          color="#10191b"
          metalness={0.72}
          roughness={0.45}
        />
      </mesh>
      <Grid
        position={[0, -0.06, 0]}
        args={[23, 23]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#253536"
        sectionSize={5}
        sectionThickness={0.9}
        sectionColor="#3d5553"
        fadeDistance={35}
        infiniteGrid={false}
      />
      <group ref={ring}>
        {[10.5, 11.3].map((r, i) => (
          <mesh
            key={r}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.02, 0]}
          >
            <torusGeometry args={[r, i ? 0.025 : 0.04, 8, 160]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={i ? 0.3 : 1.2}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}
export default function LabScene({
  settings,
  onMetrics,
  command,
  demo = 'foundry',
  color = '#b6f36a',
  onPhase,
}: {
  settings: LabSettings;
  onMetrics: (m: Metrics) => void;
  command: Command;
  demo?: DemoId;
  color?: string;
  onPhase?: (phase: string) => void;
}) {
  const drag = useRef<DragState>(null);
  const [dragging, setDragging] = useState(false);
  const [low, setLow] = useState(settings.quality === 'low');
  const [userMoved, setUserMoved] = useState(false);
  const [reducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const props = { settings, command, color, drag, setDragging };
  const rapier = usesRapier(demo);
  const view = cameraViews[demo] ?? cameraViews.default;
  return (
    <Canvas
      shadows={low ? false : { type: PCFShadowMap }}
      camera={{
        position: view.end,
        fov: 43,
      }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#080d10']} />
      <fog attach="fog" args={['#080d10', 28, 65]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[7, 15, 8]}
        intensity={3}
        castShadow={!low}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <pointLight position={[-8, 5, -5]} color="#4ed7d3" intensity={90} />
      <Suspense fallback={null}>
        <Physics paused gravity={[0, -settings.gravity, 0]} timeStep={1 / 60}>
          <Stage color={color} />
          {demo === 'cathedral' ? (
            <PulleyCathedral
              settings={settings}
              command={command}
              onMetrics={onMetrics}
              setDragging={setDragging}
            />
          ) : demo === 'loom' ? (
            <FieldLoom
              settings={settings}
              command={command}
              onMetrics={onMetrics}
              setDragging={setDragging}
            />
          ) : demo === 'ghosts' ? (
            <PendulumGhosts
              settings={settings}
              command={command}
              onMetrics={onMetrics}
            />
          ) : demo === 'singularity' ? (
            <Singularity {...props} onPhase={onPhase} />
          ) : demo === 'swarm' ? (
            <MagneticSwarm {...props} />
          ) : demo === 'destruction' ? (
            <DestructionChamber {...props} />
          ) : demo === 'orbit' ? (
            <OrbitalReactor {...props} />
          ) : demo === 'chain' ? (
            <ChainReaction {...props} />
          ) : (
            <Foundry {...props} />
          )}
          {rapier && <IntroducedMatter {...props} />}
          {rapier && (
            <Simulation
              settings={settings}
              command={command}
              onMetrics={onMetrics}
              drag={drag}
              setDragging={setDragging}
            />
          )}
        </Physics>
      </Suspense>
      <CameraEntrance stopped={userMoved || reducedMotion} view={view} />
      <AdaptiveQuality quality={settings.quality} onLow={setLow} />
      <OrbitControls
        onStart={() => setUserMoved(true)}
        autoRotate={settings.cinematic && !reducedMotion && !settings.paused}
        autoRotateSpeed={0.4}
        enabled={!dragging}
        makeDefault
        target={view.target}
        minDistance={8}
        maxDistance={38}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
      {!low && (
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={1} intensity={0.6} mipmapBlur />
          <Vignette darkness={0.65} offset={0.3} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

type CameraView = { start: Vec3; end: Vec3; target: Vec3 };
const cameraViews: Partial<Record<DemoId, CameraView>> & {
  default: CameraView;
} = {
  default: { start: [18, 14, 22], end: [14, 10, 17], target: [0, 2, 0] },
  ghosts: { start: [5, 8, 25], end: [2.5, 6, 20], target: [0, 4.3, 0] },
  loom: { start: [4, 16, 20], end: [2, 11.5, 14], target: [0, 1.2, 0] },
  cathedral: { start: [6, 2, 24], end: [2.5, 4.8, 17], target: [0, 4.6, 0] },
};
function CameraEntrance({
  stopped,
  view,
}: {
  stopped: boolean;
  view: CameraView;
}) {
  const { camera } = useThree();
  const elapsed = useRef(0),
    start = useRef(new Vector3(...view.start)),
    end = useRef(new Vector3(...view.end));
  useEffect(() => {
    if (!stopped && elapsed.current === 0) camera.position.copy(start.current);
  }, [stopped, camera]);
  useFrame((_, dt) => {
    if (stopped || elapsed.current >= 1.8) return;
    elapsed.current += dt;
    const t = Math.min(1, elapsed.current / 1.8);
    camera.position.lerpVectors(
      start.current,
      end.current,
      1 - Math.pow(1 - t, 3),
    );
  });
  return null;
}
