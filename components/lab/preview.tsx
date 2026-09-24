'use client';
import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { demos, type DemoId } from '@/lib/lab';
function Miniature({ id }: { id: DemoId }) {
  const group = useRef<Group>(null);
  const color = demos.find((d) => d.id === id)!.color;
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.3;
  });
  return (
    <group ref={group}>
      {id === 'singularity' ? (
        <>
          <mesh>
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshStandardMaterial color="#021110" />
          </mesh>
          <mesh rotation={[0.7, 0, 0.3]}>
            <torusGeometry args={[1.2, 0.1, 8, 50]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </>
      ) : (
        Array.from({ length: id === 'swarm' ? 26 : 12 }, (_, i) => {
          let p: [number, number, number];
          if (id === 'foundry')
            p = [((i % 3) - 1) * 0.55, Math.floor(i / 3) * 0.55 - 0.8, 0];
          else if (id === 'destruction')
            p = [((i % 4) - 1.5) * 0.55, Math.floor(i / 4) * 0.5 - 0.5, 0];
          else if (id === 'chain') {
            const a = (i / 12) * Math.PI * 1.6;
            p = [Math.cos(a) * 1.4, -0.2, Math.sin(a) * 1.4];
          } else {
            const a = i * 2.3999,
              r = id === 'swarm' ? 1.3 : 1.6;
            p = [Math.cos(a) * r, Math.sin(i) * 0.7, Math.sin(a) * r];
          }
          return (
            <mesh
              key={i}
              position={p}
              rotation={
                id === 'chain' ? [0, (-i / 12) * Math.PI * 1.6, 0] : [0, 0, 0]
              }
            >
              {id === 'orbit' ? (
                <sphereGeometry args={[0.16, 8, 8]} />
              ) : (
                <boxGeometry
                  args={
                    id === 'swarm'
                      ? [0.2, 0.2, 0.2]
                      : id === 'chain'
                        ? [0.15, 0.8, 0.35]
                        : [0.48, 0.43, 0.45]
                  }
                />
              )}
              <meshStandardMaterial
                color={i % 3 === 0 ? color : '#6c867a'}
                metalness={0.5}
                roughness={0.35}
              />
            </mesh>
          );
        })
      )}
    </group>
  );
}
export default function DemoPreview({
  id,
  animate,
}: {
  id: DemoId;
  animate: boolean;
}) {
  return (
    <div className="demo-preview" aria-hidden="true">
      <Canvas
        orthographic
        camera={{ position: [4, 3, 5], zoom: 36 }}
        frameloop={animate ? 'always' : 'demand'}
        dpr={1}
        gl={{ antialias: false, alpha: true }}
      >
        <ambientLight intensity={1.6} />
        <directionalLight position={[3, 4, 5]} intensity={3} />
        <Miniature key={id} id={id} />
      </Canvas>
    </div>
  );
}
