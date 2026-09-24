'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedRigidBodies, RigidBody, BallCollider, useBeforePhysicsStep, type RapierRigidBody, type InstancedRigidBodyProps } from '@react-three/rapier';
import { AdditiveBlending, DoubleSide, Color, type ShaderMaterial, type Mesh, type InstancedMesh } from 'three';
import { seeded } from '@/lib/lab';
import { orbitAcceleration } from '@/lib/fields';
import type { SharedSceneProps } from './physics';
const vertex=`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragment=`
uniform float uTime;uniform float uCharge;uniform vec3 uColor;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);float swirl=a*5.-uTime*1.8+r*20.;float grain=noise(vec2(sin(swirl)*4.,r*35.-uTime*.7));float lanes=pow(.5+.5*sin(r*140.+grain*5.+a*3.),3.);float mask=smoothstep(.16,.23,r)*(1.-smoothstep(.5,1.,r));float glow=exp(-abs(r-.22)*28.);float light=(lanes*.48+grain*.6)*mask+glow*1.6;vec3 c=mix(uColor,vec3(1.,.95,.75),clamp(glow*.6+uCharge*.4,0.,1.));gl_FragColor=vec4(c*light*(1.3+uCharge*3.),min(.85,light));}`;
export function Singularity(props: SharedSceneProps & { onPhase?: (phase: string) => void }) {
 const count=props.settings.quality==='low'?80:180;
 const bodies=useRef<(RapierRigidBody|null)[]>([]),particles=useRef<InstancedMesh>(null),disk=useRef<ShaderMaterial>(null),shock=useRef<Mesh>(null);
 const timer=useRef(0),phaseTime=useRef(-1),lastCommand=useRef(props.command.id),phase=useRef('STABLE');
 const uniforms=useMemo(()=>({uTime:{value:0},uCharge:{value:0},uColor:{value:new Color(props.color)}}),[props.color]);
 const instances=useMemo<InstancedRigidBodyProps[]>(()=>Array.from({length:count},(_,i)=>{const a=i*2.39996,r=3+seeded(i)*5,s=.12+seeded(i+4)*.18;return{key:i,position:[Math.cos(a)*r,2+seeded(i+8)*5,Math.sin(a)*r],rotation:[seeded(i),seeded(i+1),seeded(i+2)],scale:[s,s,s],linearVelocity:[-Math.sin(a)*3,0,Math.cos(a)*3]};}),[count]);
 useEffect(()=>{if(!particles.current)return;for(let i=0;i<count;i++)particles.current.setColorAt(i,new Color(i%4===0?'#f4dcac':props.color));if(particles.current.instanceColor)particles.current.instanceColor.needsUpdate=true;},[count,props.color]);
 useEffect(()=>{props.onPhase?.('STABLE');},[]);
 useEffect(()=>{if(lastCommand.current===props.command.id)return;lastCommand.current=props.command.id;if(props.command.action==='trigger'&&phaseTime.current<0){phaseTime.current=0;phase.current='CHARGING';props.onPhase?.('CHARGING');}},[props.command,props.onPhase]);
 useBeforePhysicsStep(()=>{
  timer.current+=1/60;
  if(phaseTime.current>=0)phaseTime.current+=1/60;
  if(phase.current==='CHARGING'&&phaseTime.current>=3){phase.current='ERUPTION';props.onPhase?.('ERUPTION');bodies.current.forEach((b,i)=>{if(!b)return;const p=b.translation(),x=p.x,y=p.y-4,z=p.z,l=Math.max(.2,Math.hypot(x,y,z));const k=(18+seeded(i)*8)*b.mass()*props.settings.strength;b.applyImpulse({x:x/l*k,y:(y/l+.3)*k,z:z/l*k},true);});}
  if(phase.current==='ERUPTION'&&phaseTime.current>5.5){phase.current='RECOVERING';props.onPhase?.('RECOVERING');}
  if(phaseTime.current>10){phaseTime.current=-1;phase.current='STABLE';props.onPhase?.('STABLE');}
  bodies.current.forEach((b,i)=>{if(!b)return;const p=b.translation(),v=b.linvel();let a=orbitAcceleration(p,v,props.settings.strength*1.6);if(phase.current==='CHARGING'){a=[-p.x*4-v.x*2,-(p.y-4)*4-v.y*2,-p.z*4-v.z*2];}else if(phase.current==='ERUPTION'){a=[-v.x*.12,-v.y*.12,-v.z*.12];}else if(Math.hypot(p.x,p.y-4,p.z)>12){a=[-p.x*1.5-v.x,-(p.y-4)*1.5-v.y,-p.z*1.5-v.z];}const k=b.mass()/60;b.applyImpulse({x:a[0]*k,y:a[1]*k,z:a[2]*k},true);b.applyTorqueImpulse({x:0,y:.00005*(i%2?1:-1),z:.00003},true);});
 });
 useFrame(()=>{if(disk.current){disk.current.uniforms.uTime.value=timer.current;disk.current.uniforms.uCharge.value=phase.current==='CHARGING'?phaseTime.current/3:phase.current==='ERUPTION'?Math.max(0,1-(phaseTime.current-3)/2):0;}if(shock.current){const t=phaseTime.current-3;shock.current.visible=t>=0&&t<2.5;shock.current.scale.setScalar(1+Math.max(0,t)*9);}});
 return <>
  <RigidBody type="fixed" position={[0,4,0]} colliders={false}><BallCollider args={[1.1]}/><mesh><sphereGeometry args={[1.1,40,32]}/><meshBasicMaterial color="#010305"/></mesh><pointLight color={props.color} intensity={65} distance={20}/></RigidBody>
  <mesh position={[0,4,0]} rotation={[-Math.PI/2+.15,0,.2]}><planeGeometry args={[14,14]}/><shaderMaterial ref={disk} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false}/></mesh>
  <mesh position={[0,4,0]} rotation={[Math.PI/2,0,.3]}><torusGeometry args={[1.18,.024,8,100]}/><meshBasicMaterial color={props.color} toneMapped={false}/></mesh>
  <mesh ref={shock} position={[0,4,0]} rotation={[-Math.PI/2,0,0]} visible={false}><torusGeometry args={[1.5,.025,6,120]}/><meshBasicMaterial color={props.color} transparent opacity={.6} blending={AdditiveBlending} toneMapped={false}/></mesh>
  <InstancedRigidBodies ref={bodies} instances={instances} colliders="cuboid" restitution={.6} friction={.1} linearDamping={.02}><instancedMesh ref={particles} args={[undefined,undefined,count]} castShadow frustumCulled={false}><icosahedronGeometry args={[1,0]}/><meshStandardMaterial color="white" metalness={.6} roughness={.3} emissive={props.color} emissiveIntensity={.45}/></instancedMesh></InstancedRigidBodies>
 </>;
}
