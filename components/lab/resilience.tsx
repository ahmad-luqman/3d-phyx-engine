'use client';
import { Component, useEffect, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Quality } from '@/lib/lab';
export class SceneBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback" role="alert">
        <span>RENDERER INTERRUPTED</span>
        <h2>Let’s restart the chamber.</h2>
        <p>
          The 3D scene couldn’t initialize. Try again with reduced graphics.
        </p>
        <button onClick={this.props.onRetry}>Restart in low quality ↗</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function AdaptiveQuality({
  quality,
  onLow,
}: {
  quality: Quality;
  onLow: (low: boolean) => void;
}) {
  const { setDpr, gl } = useThree();
  const sample = useRef({ time: 0, frames: 0, slow: 0 });
  useEffect(() => {
    const low =
      quality === 'low' ||
      (quality === 'auto' && window.matchMedia('(max-width: 700px)').matches);
    setDpr(
      low
        ? 1
        : Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.5),
    );
    onLow(low);
    sample.current = { time: 0, frames: 0, slow: 0 };
  }, [quality, setDpr, onLow]);
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
    };
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => gl.domElement.removeEventListener('webglcontextlost', lost);
  }, [gl]);
  useFrame((_, dt) => {
    if (quality !== 'auto') return;
    sample.current.time += dt;
    sample.current.frames++;
    if (sample.current.time > 2) {
      const fps = sample.current.frames / sample.current.time;
      sample.current.slow = fps < 35 ? sample.current.slow + 1 : 0;
      if (sample.current.slow >= 2) {
        setDpr(1);
        onLow(true);
      }
      sample.current.frames = 0;
      sample.current.time = 0;
    }
  });
  return null;
}
