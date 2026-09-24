'use client';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { flushSync } from 'react-dom';
import {
  Atom,
  ArrowUpRight,
  RotateCcw,
  Pause,
  Play,
  Expand,
  Circle,
  Box,
  Zap,
  ChevronRight,
  MoveUpRight,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { SceneBoundary } from '@/components/lab/resilience';
import {
  demos,
  defaults,
  type DemoId,
  type LabSettings,
  type Metrics,
  type Command,
} from '@/lib/lab';
import {
  registerLabTools,
  browserModelContext,
  type LabActions,
} from '@/lib/webmcp';
const Scene = lazy(() => import('@/components/lab/scene'));
const Preview = lazy(() => import('@/components/lab/preview'));
export default function Home() {
  const mounted = useSyncExternalStore(
    subscribeClient,
    () => true,
    () => false,
  );
  const [demo, setDemo] = useState<DemoId>('foundry');
  const [settings, setSettings] = useState<LabSettings>(defaults('foundry'));
  const [reset, setReset] = useState(0),
    [phase, setPhase] = useState('STABLE');
  const [command, setCommand] = useState<Command>({ id: 0, action: 'pulse' });
  const [metrics, setMetrics] = useState<Metrics>({
    fps: 0,
    bodies: 0,
    energy: 0,
  });
  const [preview, setPreview] = useState<DemoId>('foundry'),
    [hovered, setHovered] = useState(false);
  const [notice, setNotice] = useState('');
  const info = demos.find((d) => d.id === demo)!;
  const fieldDemo = ['orbit', 'swarm', 'singularity'].includes(demo);
  const selectDemo = useCallback((id: DemoId) => {
    setDemo(id);
    setPreview(id);
    setSettings((s) => ({
      ...defaults(id),
      quality: s.quality,
      cinematic: s.cinematic,
    }));
    setReset((n) => n + 1);
    setPhase('STABLE');
    setMetrics({ fps: 0, bodies: 0, energy: 0 });
  }, []);
  const resetDemo = useCallback(() => {
    setSettings((s) => ({
      ...defaults(demo),
      quality: s.quality,
      cinematic: s.cinematic,
    }));
    setReset((n) => n + 1);
    setPhase('STABLE');
  }, [demo]);
  const update = <K extends keyof LabSettings>(key: K, value: LabSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));
  const fire = useCallback((action: Command['action']) => {
    setSettings((s) => ({ ...s, paused: false }));
    setCommand((c) => ({ id: c.id + 1, action }));
  }, []);
  const primaryAction = useCallback(() => {
    if (demo === 'singularity' && phase !== 'STABLE') return;
    fire(
      demo === 'chain' || demo === 'singularity'
        ? 'trigger'
        : demo === 'destruction'
          ? 'launch'
          : 'pulse',
    );
  }, [demo, phase, fire]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat ||
        (event.target as HTMLElement)?.closest(
          'input,textarea,button,[role="slider"],[role="radio"],[role="tab"],[contenteditable="true"]',
        )
      )
        return;
      if (event.code === 'Space') {
        event.preventDefault();
        setSettings((s) => ({ ...s, paused: !s.paused }));
      } else if (event.key.toLowerCase() === 'r') resetDemo();
      else if (event.key.toLowerCase() === 'b') fire('sphere');
      else if (event.key.toLowerCase() === 'c') fire('cube');
      else if (event.key.toLowerCase() === 'f') primaryAction();
      else if (/^[1-6]$/.test(event.key))
        selectDemo(demos[Number(event.key) - 1].id);
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [resetDemo, fire, primaryAction, selectDemo]);
  const actions = useRef<LabActions>(null!);
  useLayoutEffect(() => {
    actions.current = {
      select: (id) => flushSync(() => selectDemo(id)),
      reset: () => flushSync(resetDemo),
      pause: (paused) =>
        flushSync(() => setSettings((s) => ({ ...s, paused }))),
      read: () => ({ demo, paused: settings.paused, bodies: metrics.bodies }),
    };
  });
  useEffect(
    () => registerLabTools(() => actions.current, browserModelContext()),
    [],
  );
  const fullScreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else setNotice('Fullscreen is unavailable in this browser.');
    } catch {
      setNotice('Fullscreen is unavailable in this browser.');
    }
  };
  return (
    <main
      className="lab"
      style={{ '--demo-color': info.color } as React.CSSProperties}
    >
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Gravity lab home">
          <Atom size={27} strokeWidth={1.3} />
          <span>
            GRAVITY<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="top-caption">AN EXPERIMENTAL PHYSICS LAB</div>
        <div className="system-status">
          <span className="status-dot" />
          {metrics.fps ? 'SYSTEM ONLINE' : 'INITIALIZING'}
          <span className="version">V.01</span>
        </div>
      </header>
      <Tabs
        value={demo}
        onValueChange={(v) => selectDemo(v as DemoId)}
        className="workspace"
        orientation="vertical"
      >
        <aside className="sidebar">
          <div className="section-heading">
            <span>EXPERIMENTS</span>
            <span>06</span>
          </div>
          <TabsList
            className="demo-list"
            aria-label="Physics experiments"
            onMouseLeave={() => {
              setHovered(false);
              setPreview(demo);
            }}
          >
            {demos.map((d, i) => (
              <TabsTrigger
                key={d.id}
                value={d.id}
                className="demo-option"
                onMouseEnter={() => {
                  setPreview(d.id);
                  setHovered(true);
                }}
                onFocus={() => {
                  setPreview(d.id);
                  setHovered(true);
                }}
                onBlur={() => setHovered(false)}
              >
                <span className="demo-number">0{i + 1}</span>
                <span className="demo-copy">
                  <strong>{d.name}</strong>
                  <small>{d.subtitle}</small>
                </span>
                <ChevronRight size={15} />
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="sidebar-bottom">
            {mounted && (
              <Suspense fallback={null}>
                <Preview id={preview} animate={hovered} />
              </Suspense>
            )}
            <p>
              A playground for
              <br />
              the laws of nature.
            </p>
            <span className="secondary-meta">REAL-TIME · THREE DIMENSIONS</span>
          </div>
        </aside>
        <TabsContent
          value={demo}
          className="experiment"
          aria-label={`${info.name} interactive scene`}
        >
          <div className="scene-wrap">
            {mounted && (
              <SceneBoundary
                key={`${demo}-${reset}`}
                onRetry={() => {
                  update('quality', 'low');
                  setReset((n) => n + 1);
                }}
              >
                <Suspense
                  fallback={
                    <div className="loading">Initializing physics…</div>
                  }
                >
                  <Scene
                    settings={settings}
                    onMetrics={setMetrics}
                    command={command}
                    demo={demo}
                    color={info.color}
                    onPhase={setPhase}
                  />
                </Suspense>
              </SceneBoundary>
            )}
          </div>
          <div className="scene-heading">
            <div className="eyebrow">
              <span />
              {info.level}
            </div>
            <h1>{info.label}</h1>
            <p>{info.description}</p>
          </div>
          <div className="scene-tools">
            <button
              className="icon-button"
              onClick={fullScreen}
              aria-label="Toggle fullscreen"
              title="Fullscreen"
            >
              <Expand size={18} />
            </button>
          </div>
          {demo === 'singularity' && (
            <div className="phase-indicator" aria-live="polite">
              <span className="status-dot" />
              CORE {phase}
            </div>
          )}
          <div className="scene-label">
            <span className="crosshair">+</span>
            {fieldDemo
              ? 'FIELD CONTAINMENT CHAMBER'
              : 'GRAVITATIONAL TEST CHAMBER'}
            <span>
              {String(demos.findIndex((d) => d.id === demo) + 1).padStart(
                2,
                '0',
              )}
            </span>
          </div>
          <div className="canvas-help">
            <MoveUpRight size={14} />
            {demo === 'orbit' || demo === 'singularity'
              ? 'Drag to orbit · Scroll to zoom'
              : 'Drag objects to throw · Drag space to orbit'}
          </div>
          <div className="transport">
            <button
              onClick={() => update('paused', !settings.paused)}
              className="icon-button"
              aria-label={
                settings.paused ? 'Resume simulation' : 'Pause simulation'
              }
              title="Pause / resume (Space)"
            >
              {settings.paused ? <Play size={17} /> : <Pause size={17} />}
            </button>
            <button
              onClick={resetDemo}
              className="icon-button"
              aria-label="Reset experiment"
              title="Reset experiment (R)"
            >
              <RotateCcw size={17} />
            </button>
            <div className="transport-divider" />
            <span>{settings.paused ? 'PAUSED' : 'SIMULATION RUNNING'}</span>
            <i className={settings.paused ? '' : 'status-dot'} />
          </div>
          {notice && (
            <output className="notice">
              {notice}
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice('')}
              >
                ×
              </button>
            </output>
          )}
        </TabsContent>
        <aside className="controls" aria-label="Simulation controls">
          <div className="section-heading">
            <span>CONTROL ROOM</span>
            <span className="live-tag">LIVE</span>
          </div>
          <div className="control-section environment-controls">
            <div className="control-title">
              <span>Environment</span>
              <Atom size={15} />
            </div>
            <Range
              label="Gravity"
              value={settings.gravity}
              min={0}
              max={20}
              step={0.1}
              unit="m/s²"
              onChange={(v) => update('gravity', v)}
            />
            {(fieldDemo || demo === 'destruction' || demo === 'chain') && (
              <Range
                label={
                  demo === 'destruction'
                    ? 'Projectile power'
                    : demo === 'chain'
                      ? 'Impulse strength'
                      : 'Field strength'
                }
                value={settings.strength}
                min={0.2}
                max={3}
                step={0.1}
                onChange={(v) => update('strength', v)}
              />
            )}
            {demo === 'orbit' && (
              <Range
                label="Attractor position"
                value={settings.coreX}
                min={-4}
                max={4}
                step={0.1}
                unit="m"
                onChange={(v) => update('coreX', v)}
              />
            )}
            {demo === 'swarm' && (
              <Choice
                label="Formation"
                value={settings.formation}
                options={['orbit', 'sphere', 'vortex']}
                onChange={(v) =>
                  update('formation', v as LabSettings['formation'])
                }
              />
            )}
            {!fieldDemo && (
              <>
                <Range
                  label="Restitution"
                  value={settings.bounce}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => update('bounce', v)}
                />
                <Range
                  label="Friction"
                  value={settings.friction}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => update('friction', v)}
                />
              </>
            )}
          </div>
          <div className="control-section">
            <Choice
              label="Time scale"
              value={String(settings.speed)}
              options={['0.25', '0.5', '1']}
              labels={['0.25×', '0.5×', '1×']}
              onChange={(v) => update('speed', Number(v))}
            />
          </div>
          <div className="control-section">
            <div className="control-title">
              Introduce matter
              <ArrowUpRight size={15} />
            </div>
            <div className="spawn-buttons">
              <button onClick={() => fire('sphere')} title="Spawn sphere (B)">
                <Circle size={17} />
                Sphere
              </button>
              <button onClick={() => fire('cube')} title="Spawn cube (C)">
                <Box size={17} />
                Cube
              </button>
            </div>
            <button
              className="primary-action"
              onClick={primaryAction}
              disabled={demo === 'singularity' && phase !== 'STABLE'}
              title="Activate experiment (F)"
            >
              <Zap size={17} />
              {demo === 'singularity' && phase !== 'STABLE'
                ? phase.toLowerCase() + '…'
                : info.action}
              <span>↗</span>
            </button>
          </div>
          <div className="telemetry">
            <div className="section-heading">
              TELEMETRY<span>↗</span>
            </div>
            <div>
              <span>Frame rate</span>
              <strong>
                {metrics.fps || '—'}
                <small> FPS</small>
              </strong>
            </div>
            <div>
              <span>Rigid bodies</span>
              <strong>{metrics.bodies || '—'}</strong>
            </div>
            <div>
              <span>Kinetic energy</span>
              <strong>
                {metrics.energy.toLocaleString()}
                <small> J</small>
              </strong>
            </div>
            <div>
              <span>Physics solver</span>
              <strong className="solver">
                RAPIER
                <span className="status-dot" />
              </strong>
            </div>
          </div>
          <div className="display-controls">
            <Choice
              label="Graphics"
              value={settings.quality}
              options={['auto', 'high', 'low']}
              onChange={(v) => update('quality', v as LabSettings['quality'])}
            />
            <label className="switch-label" htmlFor="cinematic-camera">
              Cinematic camera
              <Switch
                id="cinematic-camera"
                aria-label="Cinematic camera"
                checked={settings.cinematic}
                onCheckedChange={(v) => update('cinematic', v)}
              />
            </label>
          </div>
        </aside>
      </Tabs>
      <footer className="footer">
        <span>
          <span className="status-dot" />{' '}
          {settings.paused ? 'SIMULATION PAUSED' : 'ALL SYSTEMS NOMINAL'}
        </span>
        <span>
          SPACE pause<span className="muted">/</span>R reset
          <span className="muted">/</span>1–6 switch
        </span>
        <span>
          GRAVITY LAB<span className="muted">/</span>2026
        </span>
      </footer>
    </main>
  );
}
function Range({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="range-control">
      <div>
        <span>{label}</span>
        <output>
          {value.toFixed(step < 0.1 ? 2 : 1)}
          <small> {unit}</small>
        </output>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </div>
  );
}
function Choice({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="choice">
      <div className="choice-label">{label}</div>
      <RadioGroup
        aria-label={label}
        value={value}
        onValueChange={(v) => onChange(String(v))}
        className="choice-options"
      >
        {options.map((option, i) => (
          <label key={option} className={option === value ? 'selected' : ''}>
            <RadioGroupItem value={option} />
            <span>{labels?.[i] || option}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

function subscribeClient() {
  return () => {};
}
