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
  usesRapier,
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
  const ghostDemo = demo === 'ghosts';
  const loomDemo = demo === 'loom';
  const cathedralDemo = demo === 'cathedral';
  const pulley = metrics.pulley;
  const magnetName = 'ABCD'[
    Math.min(
      metrics.loom?.selected ?? settings.magnetCount - 1,
      settings.magnetCount - 1,
    )
  ];
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
      ghostStart: demo === 'ghosts' ? 0 : 20,
      quality: s.quality,
      cinematic: s.cinematic,
    }));
    setReset((n) => n + 1);
    setPhase('STABLE');
  }, [demo]);
  const update = <K extends keyof LabSettings>(key: K, value: LabSettings[K]) =>
    setSettings((s) => ({
      ...s,
      [key]: value,
      ...(ghostDemo &&
      ['ghostCount', 'ghostAngle', 'ghostSeparation', 'gravity'].includes(key)
        ? { ghostStart: 0 }
        : {}),
    }));
  const fire = useCallback(
    (action: Command['action']) => {
      if (!usesRapier(demo) && (action === 'sphere' || action === 'cube'))
        return;
      setSettings((s) => ({
        ...s,
        paused:
          action === 'clear-trails' || action === 'rotate' ? s.paused : false,
        ...(demo === 'ghosts' && action === 'trigger' ? { ghostStart: 0 } : {}),
      }));
      setCommand((c) => ({ id: c.id + 1, action }));
    },
    [demo],
  );
  const primaryAction = useCallback(() => {
    if (demo === 'singularity' && phase !== 'STABLE') return;
    fire(
      demo === 'cathedral'
        ? 'pull'
        : demo === 'loom'
          ? 'flip'
          : demo === 'chain' || demo === 'singularity' || demo === 'ghosts'
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
      else if (/^[1-9]$/.test(event.key))
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
            <span>{String(demos.length).padStart(2, '0')}</span>
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
          {ghostDemo && (
            <div className="ghost-time">
              <span className="ghost-spectrum" />
              <span>
                T +{' '}
                {(metrics.ghosts?.elapsed ?? 20).toFixed(1).padStart(5, '0')} s
              </span>
              <span>{settings.ghostCount} TRAJECTORIES</span>
            </div>
          )}
          {loomDemo && (
            <div className="ghost-time loom-status">
              <span className="ghost-spectrum loom-spectrum" />
              <span>MAGNET {magnetName} SELECTED</span>
              <span>{metrics.loom?.linked ?? 0} LINKED LINES</span>
            </div>
          )}
          {cathedralDemo && (
            <div className="ghost-time pulley-status">
              <span className="ghost-spectrum pulley-spectrum" />
              <span>
                PULLED {(pulley?.pulled ?? 0).toFixed(2)} m · RAISED{' '}
                {(pulley?.raised ?? 0).toFixed(2)} m
              </span>
              <span>ROPE {pulley?.slack ? 'SLACK' : 'TAUT'}</span>
            </div>
          )}
          {demo === 'singularity' && (
            <div className="phase-indicator" aria-live="polite">
              <span className="status-dot" />
              CORE {phase}
            </div>
          )}
          <div className="scene-label">
            <span className="crosshair">+</span>
            {ghostDemo
              ? 'SENSITIVE DEPENDENCE ON INITIAL CONDITIONS'
              : loomDemo
                ? 'MAGNETOSTATIC FIELD CHAMBER'
                : cathedralDemo
                  ? 'MECHANICAL ADVANTAGE NAVE'
                  : fieldDemo
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
            {loomDemo
              ? 'Drag magnets · Double-click to flip · Drag space to orbit'
              : cathedralDemo
                ? 'Drag the glowing handle · Drag space to orbit'
                : ghostDemo || demo === 'orbit' || demo === 'singularity'
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
              <span>
                {ghostDemo
                  ? 'Release conditions'
                  : loomDemo
                    ? 'Magnets'
                    : cathedralDemo
                      ? 'Load'
                      : 'Environment'}
              </span>
              <Atom size={15} />
            </div>
            {loomDemo && (
              <>
                <Choice
                  label="Magnets"
                  value={String(settings.magnetCount)}
                  options={['2', '3', '4']}
                  labels={['Pair', 'Triangle', 'Ring']}
                  onChange={(v) => update('magnetCount', Number(v))}
                />
                <Range
                  label="Flux flow"
                  value={settings.strength}
                  min={0.2}
                  max={3}
                  step={0.1}
                  unit="×"
                  onChange={(v) => update('strength', v)}
                />
                <p className="ghost-note">
                  Changing the layout restores the magnets to their starting
                  positions.
                </p>
              </>
            )}
            {!loomDemo && (
              <Range
                label="Gravity"
                value={settings.gravity}
                min={0}
                max={20}
                step={0.1}
                unit="m/s²"
                onChange={(v) => update('gravity', v)}
              />
            )}
            {cathedralDemo && (
              <Range
                label="Load mass"
                value={settings.loadMass}
                min={5}
                max={80}
                step={1}
                unit="kg"
                onChange={(v) => update('loadMass', v)}
              />
            )}
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
            {ghostDemo && (
              <>
                <Range
                  label="Release angle"
                  value={settings.ghostAngle}
                  min={30}
                  max={170}
                  step={1}
                  unit="°"
                  onChange={(v) => update('ghostAngle', v)}
                />
                <div className="ghost-precision">
                  <Choice
                    label="Difference per ghost"
                    value={String(settings.ghostSeparation)}
                    options={['0', '0.0001', '0.001', '0.01']}
                    labels={['Identical', '0.0001°', '0.001°', '0.01°']}
                    onChange={(v) => update('ghostSeparation', Number(v))}
                  />
                </div>
                <Choice
                  label="Pendulums"
                  value={String(settings.ghostCount)}
                  options={['10', '25', '50']}
                  onChange={(v) => update('ghostCount', Number(v))}
                />
                <p className="ghost-note">
                  Changing release conditions restarts the experiment.
                </p>
              </>
            )}
            {!fieldDemo && !ghostDemo && !loomDemo && !cathedralDemo && (
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
            {loomDemo ? (
              <>
                <label className="switch-label" htmlFor="field-threads">
                  Field lines
                  <Switch
                    id="field-threads"
                    checked={settings.fieldThreads}
                    onCheckedChange={(v) => update('fieldThreads', v)}
                  />
                </label>
                <div className="spawn-buttons ghost-actions">
                  <button onClick={() => fire('rotate')}>
                    Rotate {magnetName} 45°
                  </button>
                  <button onClick={() => fire('flip-all')}>Flip all</button>
                </div>
              </>
            ) : cathedralDemo ? (
              <div className="spawn-buttons ghost-actions">
                <button onClick={() => fire('lower')}>Let out 2 m</button>
              </div>
            ) : ghostDemo ? (
              <>
                <Choice
                  label="Trail memory"
                  value={String(settings.ghostTrail)}
                  options={['4', '8', '12']}
                  labels={['4 s', '8 s', '12 s']}
                  onChange={(v) => update('ghostTrail', Number(v))}
                />
                <label className="switch-label" htmlFor="ghost-arms">
                  Ghost arms
                  <Switch
                    id="ghost-arms"
                    checked={settings.ghostArms}
                    onCheckedChange={(v) => update('ghostArms', v)}
                  />
                </label>
                <div className="spawn-buttons ghost-actions">
                  <button onClick={() => fire('advance')}>Jump +20 s</button>
                  <button onClick={() => fire('clear-trails')}>
                    Clear trails
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="control-title">
                  Introduce matter
                  <ArrowUpRight size={15} />
                </div>
                <div className="spawn-buttons">
                  <button
                    onClick={() => fire('sphere')}
                    title="Spawn sphere (B)"
                  >
                    <Circle size={17} />
                    Sphere
                  </button>
                  <button onClick={() => fire('cube')} title="Spawn cube (C)">
                    <Box size={17} />
                    Cube
                  </button>
                </div>
              </>
            )}
            <button
              className="primary-action"
              onClick={primaryAction}
              disabled={demo === 'singularity' && phase !== 'STABLE'}
              title="Activate experiment (F)"
            >
              <Zap size={17} />
              {demo === 'singularity' && phase !== 'STABLE'
                ? phase.toLowerCase() + '…'
                : loomDemo
                  ? `${info.action} ${magnetName}`
                  : info.action}
              <span>↗</span>
            </button>
          </div>
          {ghostDemo && (
            <p className="ghost-note ghost-explainer">
              Opens 20 s after release. Replay to see the paths start together.
              White marks the reference pendulum.
            </p>
          )}
          {cathedralDemo && (
            <p className="ghost-note ghost-explainer">
              Two strands hold the movable pulley, so each carries half the
              load: pull twice as far, with half the force. Let rope out quickly
              and it goes slack.
            </p>
          )}
          {loomDemo && (
            <p className="ghost-note ghost-explainer">
              Click a magnet to select it. Particles stream from each source
              pole to a sink; linked lines end on a different magnet.
            </p>
          )}
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
            {cathedralDemo && (
              <>
                <div title="Tension in each strand; the peak includes catch spikes">
                  <span>Rope tension</span>
                  <strong>
                    {pulley ? pulley.tension.toFixed(0) : '—'}
                    <small>
                      {' '}
                      N · peak {pulley ? pulley.peak.toFixed(0) : '—'}
                    </small>
                  </strong>
                </div>
                <div title="Rope drawn in at the free end, and the load's rise">
                  <span>Pulled / raised</span>
                  <strong>
                    {(pulley?.pulled ?? 0).toFixed(2)}
                    <small> m · {(pulley?.raised ?? 0).toFixed(2)} m</small>
                  </strong>
                </div>
                <div>
                  <span>Advantage</span>
                  <strong>
                    2 : 1
                    <small>
                      {' '}
                      ·{' '}
                      {((settings.loadMass + 2) * settings.gravity).toFixed(
                        0,
                      )}{' '}
                      N load
                    </small>
                  </strong>
                </div>
              </>
            )}
            {!cathedralDemo && (
              <div>
                <span>
                  {ghostDemo
                    ? 'Pendulums'
                    : loomDemo
                      ? 'Flux particles'
                      : 'Rigid bodies'}
                </span>
                <strong>
                  {ghostDemo
                    ? settings.ghostCount
                    : loomDemo
                      ? (metrics.loom?.particles ?? '—')
                      : metrics.bodies || '—'}
                </strong>
              </div>
            )}
            {cathedralDemo ? null : loomDemo ? (
              <div title="Traced field lines, and how many end on a different magnet's sink pole">
                <span>Field lines</span>
                <strong>
                  {metrics.loom?.lines ?? '—'}
                  <small> · {metrics.loom?.linked ?? 0} linked</small>
                </strong>
              </div>
            ) : (
              <div>
                <span>
                  {ghostDemo ? 'Reference kinetic' : 'Kinetic energy'}
                </span>
                <strong>
                  {metrics.energy.toLocaleString()}
                  <small> J</small>
                </strong>
              </div>
            )}
            {ghostDemo && (
              <div title="Root-mean-square tip distance from the reference, excluding visual depth offsets">
                <span>RMS separation</span>
                <strong>
                  {(metrics.ghosts?.separation ?? 0).toFixed(3)}
                  <small> m</small>
                </strong>
              </div>
            )}
            <div>
              <span>Physics solver</span>
              <strong className="solver">
                {ghostDemo
                  ? 'RK4 · 240 Hz'
                  : loomDemo
                    ? 'RK4 TRACER'
                    : cathedralDemo
                      ? 'CONSTRAINT · 240 Hz'
                      : 'RAPIER'}
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
          <span className="muted">/</span>1–9 switch
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
