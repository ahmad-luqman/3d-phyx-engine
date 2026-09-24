'use client';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier';
import { Plane, Vector3 } from 'three';
import { seeded, type Command, type LabSettings, type Metrics, type Vec3 } from '@/lib/lab';

export type BodySpec = { id: number; position: Vec3; size?: Vec3; shape?: 'cube' | 'sphere'; color?: string; velocity?: Vec3; mass?: number; rotation?: Vec3 };
export type DragState = { body: RapierRigidBody; plane: Plane; target: Vector3 } | null;
export type SharedSceneProps = { settings: LabSettings; command: Command; drag: MutableRefObject<DragState>; setDragging: (v: boolean) => void; color: string };
export function PhysicalObject({ spec, settings, drag, setDragging, bodyRef, onImpact }: { spec: BodySpec; settings: LabSettings; drag: MutableRefObject<DragState>; setDragging: (v: boolean) => void; onImpact?: (force: number) => void; bodyRef?: MutableRefObject<RapierRigidBody | null> }) {
 const body = useRef<RapierRigidBody>(null);
 const { camera, gl } = useThree();
 const size = spec.size || [.92, .92, .92];
 const endDrag = () => { if (drag.current?.body === body.current) { drag.current = null; setDragging(false); gl.domElement.style.cursor = 'grab'; } };
 useEffect(() => { window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag); window.addEventListener('blur', endDrag); return () => { window.removeEventListener('pointerup', endDrag); window.removeEventListener('pointercancel', endDrag); window.removeEventListener('blur', endDrag); if (drag.current?.body === body.current) { drag.current = null; setDragging(false); } }; }, []);
 const down = (event: ThreeEvent<PointerEvent>) => {
  if (settings.paused || event.button !== 0 || !body.current) return;
  event.stopPropagation();
  const normal = camera.getWorldDirection(new Vector3());
  drag.current = { body: body.current, plane: new Plane().setFromNormalAndCoplanarPoint(normal, event.point), target: event.point.clone() };
  body.current.wakeUp(); setDragging(true); gl.domElement.style.cursor = 'grabbing';
 };
 return <RigidBody ref={b => { body.current = b; if (bodyRef) bodyRef.current = b; }} position={spec.position} rotation={spec.rotation} linearVelocity={spec.velocity} colliders={spec.shape === 'sphere' ? 'ball' : 'cuboid'} restitution={settings.bounce} friction={settings.friction} mass={spec.mass || 1} linearDamping={.08} angularDamping={.15} ccd onContactForce={onImpact ? e => onImpact(e.totalForceMagnitude) : undefined}>
  <group onPointerDown={down} onPointerUp={endDrag} onPointerOver={() => { gl.domElement.style.cursor = 'grab'; }} onPointerOut={() => { if (!drag.current) gl.domElement.style.cursor = 'auto'; }}>
   {spec.shape === 'sphere' ? <mesh castShadow receiveShadow><sphereGeometry args={[size[0] / 2, 20, 16]} /><meshStandardMaterial color={spec.color || '#b6f36a'} metalness={.55} roughness={.25} /></mesh> : <RoundedBox args={size} radius={.045} smoothness={1} castShadow receiveShadow><meshStandardMaterial color={spec.color || '#658179'} roughness={.28} metalness={.55} /></RoundedBox>}
  </group>
 </RigidBody>;
}
export function Foundry(props: SharedSceneProps) {
 const specs: BodySpec[] = Array.from({ length: 63 }, (_, i) => {
  const tower = i < 45, j = i - 45;
  return tower ? { id: i, position: [(i % 3 - 1) * 1.01 - 1.2, Math.floor(i / 9) * .96 + .49, (Math.floor(i % 9 / 3) - 1) * 1.01], color: i % 7 === 0 ? props.color : i % 3 === 0 ? '#d0dacc' : '#56786b' } : { id: i, position: [3.5 + (j % 2) * .86, Math.floor(j / 4) * .86 + .45, (Math.floor(j % 4 / 2) - .5) * .86], size: [.8,.8,.8], color: j % 2 ? '#8bac79' : props.color };
 });
 return <>{specs.map(spec => <PhysicalObject key={spec.id} spec={spec} {...props} />)}<PhysicalObject spec={{ id: 90, position: [-4, 1, 4], size: [1.6,1.6,1.6], shape: 'sphere', color: props.color }} {...props} /><PhysicalObject spec={{ id: 91, position: [3, .8, 4], size: [1.2,1.2,1.2], shape: 'sphere', color: '#b9cece' }} {...props} /></>;
}
export function IntroducedMatter(props: SharedSceneProps) {
 const [items, setItems] = useState<BodySpec[]>([]);
 const last = useRef(props.command.id);
 useEffect(() => {
  if (last.current === props.command.id) return;
  last.current = props.command.id;
  const { action, id } = props.command;
  if (action !== 'sphere' && action !== 'cube' && action !== 'launch') return;
  setItems(old => [...old.slice(-47), { id, position: action === 'launch' ? [0, 3, 10] : [(seeded(id) - .5) * 9, 9 + seeded(id + 1) * 3, (seeded(id + 2) - .5) * 7], shape: action === 'cube' ? 'cube' : 'sphere', size: action === 'launch' ? [1.5,1.5,1.5] : [1.1,1.1,1.1], mass: action === 'launch' ? 7 : 1, velocity: action === 'launch' ? [0, .5, -16 * props.settings.strength] : [0,0,0], color: props.color }]);
 }, [props.command]);
 return <>{items.map(spec => <PhysicalObject key={spec.id} spec={spec} {...props} />)}</>;
}
export function Simulation({ settings, command, onMetrics, drag }: { settings: LabSettings; command: Command; onMetrics: (m: Metrics) => void; drag: MutableRefObject<DragState> }) {
 const { world, step } = useRapier();
 const { raycaster, pointer, camera } = useThree();
 const sample = useRef({ frames: 0, elapsed: 0 });
 const last = useRef(command.id);
 const target = useRef(new Vector3());
 useEffect(() => {
  if (last.current === command.id) return; last.current = command.id;
  if (command.action !== 'pulse') return;
  world.forEachRigidBody(b => { if (!b.isDynamic()) return; const p = b.translation(); const l = Math.hypot(p.x, p.y - 1, p.z) || 1; const force = Math.min(22, 35 / Math.max(1, l)) * settings.strength * b.mass(); b.applyImpulse({ x: p.x / l * force, y: Math.max(.5, (p.y - 1) / l) * force, z: p.z / l * force }, true); });
 }, [command, world, settings.strength]);
 useFrame((_, dt) => {
  if (!settings.paused) {
   const held = drag.current;
   if (held && held.body.isValid()) {
    raycaster.setFromCamera(pointer, camera); raycaster.ray.intersectPlane(held.plane, target.current);
    const p = held.body.translation(), v = held.body.linvel();
    const gain = Math.min(dt, .04) * held.body.mass();
    held.body.applyImpulse({ x: ((target.current.x - p.x) * 45 - v.x * 8) * gain, y: ((Math.max(.6, target.current.y) - p.y) * 45 - v.y * 8 + settings.gravity) * gain, z: ((target.current.z - p.z) * 45 - v.z * 8) * gain }, true);
   }
   step(Math.min(dt, .05) * settings.speed);
   world.forEachRigidBody(b => { if (!b.isDynamic()) return; const p = b.translation(); if (p.y < -18 || Math.hypot(p.x, p.z) > 45 || p.y > 60) { b.setTranslation({ x: seeded(b.handle + 1) * 8 - 4, y: 7, z: seeded(b.handle + 2) * 8 - 4 }, true); b.setLinvel({x:0,y:0,z:0}, true); b.setAngvel({x:0,y:0,z:0}, true); } });
  }
  sample.current.frames++; sample.current.elapsed += dt;
  if (sample.current.elapsed > .75) {
   let bodies = 0, energy = 0;
   world.forEachRigidBody(b => { if (b.isDynamic()) { bodies++; const v = b.linvel(); energy += .5 * b.mass() * (v.x*v.x + v.y*v.y + v.z*v.z); } });
   onMetrics({ fps: Math.round(sample.current.frames / sample.current.elapsed), bodies, energy: Math.round(energy) }); sample.current = { frames:0, elapsed:0 };
  }
 }, -1);
 return null;
}
