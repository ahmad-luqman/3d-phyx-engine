'use client';
import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import type { Group } from 'three';
import type { LabSettings, Metrics, Command, DemoId } from '@/lib/lab';

import { Foundry, IntroducedMatter, Simulation, type DragState } from './physics';

import { ChainReaction } from './chain';

import { OrbitalReactor } from './orbit';

import { DestructionChamber } from './destruction';

import { MagneticSwarm } from './swarm';

function Stage({ color }: { color: string }) {
  const ring = useRef<Group>(null);
  useFrame((_, dt) => { if (ring.current) ring.current.rotation.y += dt * 0.025; });
  return <>
    <RigidBody type="fixed" colliders={false}><CuboidCollider args={[12, .3, 12]} position={[0, -.35, 0]} /></RigidBody>
    <mesh receiveShadow position={[0, -.4, 0]}><cylinderGeometry args={[11.6, 11.8, .65, 96]} /><meshStandardMaterial color="#10191b" metalness={.72} roughness={.45} /></mesh>
    <Grid position={[0, -.06, 0]} args={[23, 23]} cellSize={1} cellThickness={.5} cellColor="#253536" sectionSize={5} sectionThickness={.9} sectionColor="#3d5553" fadeDistance={35} infiniteGrid={false} />
    <group ref={ring}>{[10.5, 11.3].map((r, i) => <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.02, 0]}><torusGeometry args={[r, i ? .025 : .04, 8, 160]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={i ? .3 : 1.2} /></mesh>)}</group>
    <ContactShadows position={[0, -.035, 0]} opacity={.4} scale={30} blur={2.5} far={12} resolution={256} frames={1} />
  </>;
}
export default function LabScene({ settings, onMetrics, command, demo = 'foundry', color = '#b6f36a' }: { settings: LabSettings; onMetrics: (m: Metrics) => void; command: Command; demo?: DemoId; color?: string }) {
 const drag = useRef<DragState>(null);
 const [dragging, setDragging] = useState(false);
 const props = { settings, command, color, drag, setDragging };
 return <Canvas shadows camera={{ position: [15, 12, 18], fov: 43 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
  <color attach="background" args={['#080d10']} /><fog attach="fog" args={['#080d10', 28, 65]} />
  <ambientLight intensity={.55} /><directionalLight position={[7, 15, 8]} intensity={3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} /><pointLight position={[-8, 5, -5]} color="#4ed7d3" intensity={90} />
  <Suspense fallback={null}><Physics paused gravity={[0, -settings.gravity, 0]} timeStep={1 / 60}><Stage color={color} />{demo === 'swarm' ? <MagneticSwarm {...props} /> : demo === 'destruction' ? <DestructionChamber {...props} /> : demo === 'orbit' ? <OrbitalReactor {...props} /> : demo === 'chain' ? <ChainReaction {...props} /> : <Foundry {...props} />}<IntroducedMatter {...props} /><Simulation settings={settings} command={command} onMetrics={onMetrics} drag={drag} /></Physics></Suspense>
  <OrbitControls enabled={!dragging} makeDefault target={[0, 2, 0]} minDistance={8} maxDistance={38} maxPolarAngle={Math.PI / 2 - .05} />
  <EffectComposer><Bloom luminanceThreshold={1} intensity={.6} mipmapBlur /><Vignette darkness={.65} offset={.3} /></EffectComposer>
 </Canvas>;
}
