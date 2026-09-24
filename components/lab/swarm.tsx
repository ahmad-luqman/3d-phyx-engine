'use client';
/* oxlint-disable react/react-compiler -- Rapier and Three.js require imperative mutations of scene objects and physics refs. */
import { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import {
  InstancedRigidBodies,
  useBeforePhysicsStep,
  type RapierRigidBody,
  type InstancedRigidBodyProps,
} from '@react-three/rapier';
import { Color, Plane, Vector3, type InstancedMesh } from 'three';
import { formationTarget, seekAcceleration } from '@/lib/fields';
import { seeded } from '@/lib/lab';
import type { SharedSceneProps } from './physics';
export function MagneticSwarm(props: SharedSceneProps) {
  const count = props.settings.quality === 'low' ? 96 : 240;
  const bodies = useRef<(RapierRigidBody | null)[]>([]),
    mesh = useRef<InstancedMesh>(null);
  const time = useRef(0);
  const { camera, gl } = useThree();
  const instances = useMemo<InstancedRigidBodyProps[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        key: i,
        position: formationTarget(i, count, 0, 'sphere'),
        rotation: [seeded(i) * 3, seeded(i + 1) * 3, 0],
      })),
    [count],
  );
  useEffect(() => {
    if (!mesh.current) return;
    for (let i = 0; i < count; i++)
      mesh.current.setColorAt(
        i,
        new Color(
          i % 7 === 0 ? '#ecdbff' : i % 3 === 0 ? '#7f66ba' : props.color,
        ),
      );
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
  }, [count, props.color]);
  useBeforePhysicsStep(() => {
    time.current += 1 / 60;
    bodies.current?.forEach((b, i) => {
      if (!b || !b.isValid() || props.drag.current?.body.handle === b.handle)
        return;
      const target = formationTarget(
        i,
        count,
        time.current,
        props.settings.formation,
      );
      const a = seekAcceleration(
        b.translation(),
        b.linvel(),
        target,
        props.settings.strength,
      );
      const k = b.mass() / 60;
      b.applyImpulse({ x: a[0] * k, y: a[1] * k, z: a[2] * k }, true);
    });
  });
  const grab = (e: ThreeEvent<PointerEvent>) => {
    if (e.instanceId === undefined || props.settings.paused || e.button !== 0)
      return;
    const b = bodies.current[e.instanceId];
    if (!b) return;
    e.stopPropagation();
    props.drag.current = {
      body: b,
      plane: new Plane().setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new Vector3()),
        e.point,
      ),
      target: e.point.clone(),
    };
    props.setDragging(true);
    gl.domElement.style.cursor = 'grabbing';
  };
  return (
    <>
      <InstancedRigidBodies
        ref={bodies}
        instances={instances}
        colliders="cuboid"
        restitution={props.settings.bounce}
        friction={props.settings.friction}
        linearDamping={0.1}
        angularDamping={0.5}
      >
        <instancedMesh
          ref={mesh}
          args={[undefined, undefined, count]}
          castShadow
          onPointerDown={grab}
          frustumCulled={false}
        >
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial
            metalness={0.65}
            roughness={0.25}
            emissive={props.color}
            emissiveIntensity={0.32}
          />
        </instancedMesh>
      </InstancedRigidBodies>
      <mesh position={[0, 4, 0]}>
        <octahedronGeometry args={[0.45]} />
        <meshStandardMaterial
          color={props.color}
          emissive={props.color}
          emissiveIntensity={2}
          wireframe
        />
      </mesh>
    </>
  );
}
