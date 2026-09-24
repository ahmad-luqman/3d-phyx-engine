'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import { RigidBody, BallCollider, useBeforePhysicsStep } from '@react-three/rapier';
import type { Group } from 'three';
import { seeded } from '@/lib/lab';
import { orbitAcceleration } from '@/lib/fields';
import { type SharedSceneProps } from './physics';
export function OrbitalReactor(props: SharedSceneProps) {
 const rings=useRef<Group>(null);
 useFrame((_,dt)=>{if(rings.current&&!props.settings.paused){rings.current.rotation.y+=dt*.18*props.settings.speed;rings.current.rotation.z+=dt*.07*props.settings.speed;}});
 useBeforePhysicsStep(world=>world.forEachRigidBody(b=>{if(!b.isDynamic()||props.drag.current?.body===b)return;const a=orbitAcceleration(b.translation(),b.linvel(),props.settings.strength,props.settings.coreX);const k=b.mass()/60;b.applyImpulse({x:a[0]*k,y:a[1]*k,z:a[2]*k},true);}));
 return <>
  <RigidBody type="fixed" position={[props.settings.coreX,4,0]} colliders={false}><BallCollider args={[1.05]} /><mesh><icosahedronGeometry args={[1,2]} /><meshStandardMaterial color="#061c27" metalness={.8} roughness={.2} emissive={props.color} emissiveIntensity={.3} /></mesh><mesh scale={1.025}><icosahedronGeometry args={[1,1]} /><meshBasicMaterial color={props.color} wireframe /></mesh><pointLight color={props.color} intensity={35} distance={15} /></RigidBody>
  <group position={[props.settings.coreX,4,0]} ref={rings}>{[1.6,2.1,2.5].map((r,i)=><mesh key={r} rotation={[Math.PI/2+i*.65,i*.8,0]}><torusGeometry args={[r,.018,6,100]} /><meshBasicMaterial color={props.color} toneMapped={false} /></mesh>)}</group>
  {Array.from({length:42},(_,i)=>{const a=i*2.39996,r=3.2+seeded(i)*4.2,s=.18+seeded(i+43)*.3;const speed=Math.sqrt(28*props.settings.strength/r);const material=<meshStandardMaterial color={i%3===0?'#d8f6ff':props.color} emissive={props.color} emissiveIntensity={i%4===0?2:.4} roughness={.25} metalness={.5}/>;const orb=<mesh castShadow><sphereGeometry args={[s,12,12]}/>{material}</mesh>;return <RigidBody key={i} colliders="ball" position={[Math.cos(a)*r,3+seeded(i+2)*3,Math.sin(a)*r]} linearVelocity={[-Math.sin(a)*speed,0,Math.cos(a)*speed]} restitution={props.settings.bounce} friction={props.settings.friction} linearDamping={.01}>{i<8?<Trail width={.5} length={6} color={props.color} attenuation={w=>w*w}>{orb}</Trail>:orb}</RigidBody>;})}
 </>;
}
