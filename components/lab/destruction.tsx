'use client';
import { useEffect, useRef } from 'react';
import { useRapier, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import { PhysicalObject, type SharedSceneProps } from './physics';
import type { ImpulseJoint } from '@dimforge/rapier3d-compat';
const COLS=10,ROWS=8;
export function DestructionChamber(props: SharedSceneProps) {
 const { world,rapier }=useRapier();
 const bodies=useRef(Array.from({length:COLS*ROWS},()=>({current:null as RapierRigidBody|null})));
 const joints=useRef<{a:number;b:number;joint:ImpulseJoint}[]>([]);
 const damage=useRef(new Set<number>());
 const age=useRef(0);
 useEffect(()=>{
  const links:typeof joints.current=[];
  for(let i=0;i<COLS*ROWS;i++){
   for(const j of [i%COLS<COLS-1?i+1:-1,i+COLS<COLS*ROWS?i+COLS:-1]){
    const a=bodies.current[i].current,b=j>=0?bodies.current[j].current:null;if(!a||!b)continue;
    const p=a.translation(),q=b.translation(),orientation={x:0,y:0,z:0,w:1};
    const data=rapier.JointData.fixed({x:(q.x-p.x)/2,y:(q.y-p.y)/2,z:0},orientation,{x:(p.x-q.x)/2,y:(p.y-q.y)/2,z:0},orientation);
    const joint=world.createImpulseJoint(data,a,b,true);joint.setContactsEnabled(false);links.push({a:i,b:j,joint});
   }
  }
  joints.current=links;
  return()=>{for(const {joint} of links)if(joint.isValid())world.removeImpulseJoint(joint,true);joints.current=[];};
 },[world,rapier]);
 useBeforePhysicsStep(()=>{
  age.current++;
  if(!damage.current.size)return;
  joints.current=joints.current.filter(link=>{if(damage.current.has(link.a)||damage.current.has(link.b)){if(link.joint.isValid())world.removeImpulseJoint(link.joint,true);return false;}return true;});
  damage.current.clear();
 });
 const hit=(index:number,force:number)=>{if(age.current<30||force<650)return;const radius=force>3500?2:1;for(let y=-radius;y<=radius;y++)for(let x=-radius;x<=radius;x++){const col=index%COLS+x,row=Math.floor(index/COLS)+y;if(col>=0&&col<COLS&&row>=0&&row<ROWS)damage.current.add(row*COLS+col);}};
 return <>{Array.from({length:COLS*ROWS},(_,i)=><PhysicalObject key={i} bodyRef={bodies.current[i]} onImpact={force=>hit(i,force)} spec={{id:i,position:[(i%COLS-(COLS-1)/2)*.94,.33+Math.floor(i/COLS)*.65,0],size:[.9,.61,.72],mass:1.2,color:i%COLS===0||i%COLS===COLS-1||Math.floor(i/COLS)===ROWS-1?props.color:i%3===0?'#b2c0b8':'#5d7570'}} {...props} />)}
  <mesh position={[0,.02,8]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.7,.76,48]} /><meshBasicMaterial color={props.color}/></mesh>
  <mesh position={[0,.025,5]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.025,4]}/><meshBasicMaterial color={props.color}/></mesh>
 </>;
}
