'use client';
import { useEffect, useRef } from 'react';
import { RigidBody, BallCollider, useSphericalJoint, type RapierRigidBody } from '@react-three/rapier';
import { PhysicalObject, type BodySpec, type SharedSceneProps } from './physics';
import type { Vec3 } from '@/lib/lab';
export function ChainReaction(props: SharedSceneProps) {
 const anchor = useRef<RapierRigidBody>(null!), bob = useRef<RapierRigidBody>(null!);
 const last = useRef(props.command.id);
 useSphericalJoint(anchor, bob, [[0,0,0],[0,4.7,0]]);
 useEffect(() => { if (last.current === props.command.id) return; last.current = props.command.id; if (props.command.action === 'trigger') bob.current?.applyImpulse({x:20 * props.settings.strength,y:0,z:0},true); }, [props.command, props.settings.strength]);
 const points: Vec3[] = [];
 for (let i = 0; i < 19; i++) points.push([-5.6 + i * .62, .96, -1.4]);
 for (let i = 1; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI; points.push([5.56 + Math.cos(a) * 1.5, .96, .1 + Math.sin(a) * 1.5]); }
 for (let i = 1; i <= 19; i++) points.push([5.56 - i * .62, .96, 1.6]);
 return <>
  <RigidBody ref={anchor} type="fixed" position={[-7.5,6, -1.4]} colliders={false}><mesh><sphereGeometry args={[.15,16,16]} /><meshStandardMaterial color={props.color} emissive={props.color} emissiveIntensity={2} /></mesh></RigidBody>
  <RigidBody ref={bob} position={[-7.5,1.3,-1.4]} colliders={false} restitution={.25} linearDamping={.05}><BallCollider args={[.85]} mass={6} /><mesh castShadow><sphereGeometry args={[.85,24,24]} /><meshStandardMaterial color={props.color} roughness={.2} metalness={.7} /></mesh><mesh position={[0,2.35,0]}><cylinderGeometry args={[.035,.035,4.7,8]} /><meshStandardMaterial color="#b8c8bb" metalness={.8} roughness={.3} /></mesh></RigidBody>
  <mesh position={[-7.5,6.1,-1.4]}><boxGeometry args={[.5,.25,3.5]} /><meshStandardMaterial color="#50635a" metalness={.6} roughness={.35} /></mesh>
  {[-2.9,.1].map(z => <mesh key={z} position={[-7.5,3,z]} castShadow><boxGeometry args={[.2,6,.2]} /><meshStandardMaterial color="#344b42" /></mesh>)}
  {points.map((position, i) => { const next = points[Math.min(i+1,points.length-1)]; const prev = points[Math.max(i-1,0)]; const rotation: Vec3 = [0,-Math.atan2(next[2]-prev[2],next[0]-prev[0]),0]; const spec: BodySpec = { id:i,position,rotation,size:[.23,1.85,.85],color:i%5 === 0 ? props.color : '#b8c6ae' }; return <PhysicalObject key={i} spec={spec} {...props} />; })}
  {Array.from({length:15},(_,i)=><PhysicalObject key={`tower-${i}`} spec={{id:100+i,position:[-6.7 + (i%3)*.6, .32 + Math.floor(i/3)*.62, 3.4],size:[.57,.57,.57],color:i%3 ? '#8d9e78': props.color}} {...props} />)}
 </>;
}
