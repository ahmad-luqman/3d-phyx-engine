import { test } from 'node:test';
import { setMaxListeners } from 'node:events';
import assert from 'node:assert/strict';
import { Suspense, useEffect } from 'react';
import { create, act } from '@react-three/test-renderer';
import { Physics, RigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
import { Foundry, IntroducedMatter, PhysicalObject, Simulation, type SharedSceneProps } from '../components/lab/physics';
import { ChainReaction } from '../components/lab/chain';
import { OrbitalReactor } from '../components/lab/orbit';
import { DestructionChamber } from '../components/lab/destruction';
import { MagneticSwarm } from '../components/lab/swarm';
import { defaults, type DemoId } from '../lib/lab';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT:true, window: Object.assign(new EventTarget(), { performance: globalThis.performance }) });
setMaxListeners(0, window);
const noop=()=>{};
type Context=ReturnType<typeof useRapier>;
function Capture({onReady}:{onReady:(c:Context)=>void}) {const c=useRapier();useEffect(()=>onReady(c),[c,onReady]);return null;}

async function mount(id:DemoId,Component:React.ComponentType<SharedSceneProps>){
 let context:Context|undefined;
 const props:SharedSceneProps={settings:defaults(id),command:{id:0,action:'pulse'},drag:{current:null},setDragging:noop,color:'#b6f36a'};
 const onReady=(c:Context)=>{context=c;};
 const element=()=> <Suspense fallback={null}><Physics paused gravity={[0,-props.settings.gravity,0]} timeStep={1/60}><RigidBody type="fixed" colliders={false}><CuboidCollider args={[12,.3,12]} position={[0,-.35,0]}/></RigidBody><Component {...props}/><IntroducedMatter {...props}/><Simulation settings={props.settings} command={props.command} onMetrics={noop} drag={props.drag}/><Capture onReady={onReady}/></Physics></Suspense>;
 const renderer=await create(element());
 for(let i=0;i<100&&!context;i++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
 assert.ok(context,`${id}: physics initialized`);
 return {renderer,context,props,update:()=>renderer.update(element())};
}
const scenes=[['foundry',Foundry,65],['chain',ChainReaction,62],['orbit',OrbitalReactor,42],['destruction',DestructionChamber,80],['swarm',MagneticSwarm,240]] as const;
for(const [id,Component,count]of scenes)test(`${id}: mounts real Rapier bodies, advances and cleans up`,async()=>{
 const {renderer,context}=await mount(id,Component);
 try{
  let bodies=0;context.world.forEachRigidBody(b=>{if(b.isDynamic())bodies++;});assert.equal(bodies,count);
  for(let n=0;n<120;n++) context.step(1/60);
  context.world.forEachRigidBody(b=>{const p=b.translation();assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z));assert.ok(p.y>-3,`${id} body escaped below floor`);});
 }finally{await renderer.unmount();}
});
test('unspecified body velocity initializes at zero instead of crashing',async()=>{
 function DefaultBody(props:SharedSceneProps){return <PhysicalObject spec={{id:1,position:[0,3,0]}} {...props}/>;}
 const {renderer,context}=await mount('foundry',DefaultBody);
 try{context.world.forEachRigidBody(b=>{if(b.isDynamic())assert.deepEqual({...b.linvel()},{x:0,y:0,z:0});});}finally{await renderer.unmount();}
});
test('spawn, shockwave, pause and reset operate on the simulated world',async()=>{
 const {renderer,context,props,update}=await mount('foundry',Foundry);
 try{
  props.command={id:1,action:'sphere'};await update();assert.equal(context.world.bodies.len(),67);
  props.command={id:2,action:'pulse'};await update();
  let moving=0;context.world.forEachRigidBody(b=>{if(b.isDynamic()&&Math.hypot(...Object.values(b.linvel()))>1)moving++;});assert.ok(moving>50);
  props.settings={...props.settings,paused:true};await update();
  const positions:Record<number,string>={};context.world.forEachRigidBody(b=>{positions[b.handle]=JSON.stringify(b.translation());});await renderer.advanceFrames(30,1/60);context.world.forEachRigidBody(b=>assert.equal(JSON.stringify(b.translation()),positions[b.handle]));
 }finally{await renderer.unmount();}
 const fresh=await mount('foundry',Foundry);assert.equal(fresh.context.world.bodies.len(),66);await fresh.renderer.unmount();
});
