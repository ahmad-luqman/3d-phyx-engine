'use client';
import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import type { Group } from 'three';
import type { LabSettings, Metrics } from '@/lib/lab';

function Stage() {
  const ring = useRef<Group>(null);
  useFrame((_, dt) => { if (ring.current) ring.current.rotation.y += dt * 0.025; });
  return <>
    <RigidBody type="fixed" colliders={false}><CuboidCollider args={[12, .3, 12]} position={[0, -.35, 0]} /></RigidBody>
    <mesh receiveShadow position={[0, -.4, 0]}><cylinderGeometry args={[11.6, 11.8, .65, 96]} /><meshStandardMaterial color="#10191b" metalness={.72} roughness={.45} /></mesh>
    <Grid position={[0, -.06, 0]} args={[23, 23]} cellSize={1} cellThickness={.5} cellColor="#253536" sectionSize={5} sectionThickness={.9} sectionColor="#3d5553" fadeDistance={35} infiniteGrid={false} />
    <group ref={ring}>{[10.5, 11.3].map((r, i) => <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.02, 0]}><torusGeometry args={[r, i ? .025 : .04, 8, 160]} /><meshStandardMaterial color="#b6f36a" emissive="#b6f36a" emissiveIntensity={i ? .3 : 1.2} /></mesh>)}</group>
    <ContactShadows position={[0, -.035, 0]} opacity={.4} scale={30} blur={2.5} far={12} resolution={256} frames={1} />
  </>;
}
function Foundry() {
  return <>{Array.from({ length: 45 }, (_, i) => { const row = Math.floor(i / 9), x = i % 3, z = Math.floor(i % 9 / 3); return <RigidBody key={i} position={[(x - 1) * 1.04, row * 1.03 + .6, (z - 1) * 1.04]} restitution={.35} colliders="cuboid"><mesh castShadow receiveShadow><boxGeometry args={[.96, .96, .96]} /><meshStandardMaterial color={i % 4 === 0 ? '#b6f36a' : '#55736b'} roughness={.3} metalness={.55} /></mesh></RigidBody>; })}</>;
}
function Telemetry({ onMetrics }: { onMetrics: (m: Metrics) => void }) {
 const sample = useRef({ frames: 0, elapsed: 0 });
 useFrame((_, dt) => { sample.current.frames++; sample.current.elapsed += dt; if (sample.current.elapsed > 1) { onMetrics({ fps: Math.round(sample.current.frames / sample.current.elapsed), bodies: 45, energy: 0 }); sample.current = { frames: 0, elapsed: 0 }; }}); return null;
}
export default function LabScene({ settings, onMetrics }: { settings: LabSettings; onMetrics: (m: Metrics) => void }) {
 return <Canvas shadows camera={{ position: [15, 12, 18], fov: 43 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
  <color attach="background" args={['#080d10']} /><fog attach="fog" args={['#080d10', 28, 65]} />
  <ambientLight intensity={.55} /><directionalLight position={[7, 15, 8]} intensity={3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} /><pointLight position={[-8, 5, -5]} color="#4ed7d3" intensity={90} />
  <Suspense fallback={null}><Physics paused={settings.paused} gravity={[0, -settings.gravity, 0]} timeStep={1 / 60}><Stage /><Foundry /></Physics></Suspense>
  <OrbitControls makeDefault target={[0, 2, 0]} minDistance={8} maxDistance={38} maxPolarAngle={Math.PI / 2 - .05} />
  <EffectComposer><Bloom luminanceThreshold={1} intensity={.6} mipmapBlur /><Vignette darkness={.65} offset={.3} /></EffectComposer><Telemetry onMetrics={onMetrics} />
 </Canvas>;
}
