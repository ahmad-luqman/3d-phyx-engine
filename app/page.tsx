'use client';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Atom, ArrowUpRight, RotateCcw, Pause, Play, Expand, Circle, Box, Zap, ChevronRight, MoveUpRight } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { demos, defaults, type DemoId, type LabSettings, type Metrics, type Command } from '@/lib/lab';
const Scene = lazy(() => import('@/components/lab/scene'));
export default function Home() {
 const [mounted, setMounted] = useState(false);
 const [demo, setDemo] = useState<DemoId>('foundry');
 const [settings, setSettings] = useState<LabSettings>(defaults('foundry'));
 const [command, setCommand] = useState<Command>({ id: 0, action: 'pulse' });
 const fire = (action: Command['action']) => { setSettings(s => ({ ...s, paused: false })); setCommand(c => ({ id: c.id + 1, action })); };
 const [reset, setReset] = useState(0);
 const [metrics, setMetrics] = useState<Metrics>({ fps: 0, bodies: 45, energy: 0 });
 useEffect(() => setMounted(true), []);
 const info = demos.find(d => d.id === demo)!;
 const update = (key: keyof LabSettings, value: number | boolean | string) => setSettings(s => ({ ...s, [key]: value }));
 return <main className="lab" style={{ '--demo-color': info.color } as React.CSSProperties}>
  <header className="topbar"><a className="brand" href="/" aria-label="Gravity lab home"><Atom size={27} strokeWidth={1.3} /><span>GRAVITY<span className="brand-dot">.</span></span></a><div className="top-caption">AN EXPERIMENTAL PHYSICS LAB</div><div className="system-status"><span className="status-dot" /> SYSTEM ONLINE <span className="version">V.01</span></div></header>
  <Tabs value={demo} onValueChange={v => { setDemo(v as DemoId); setSettings(defaults(v as DemoId)); setReset(n => n + 1); }} className="workspace" orientation="vertical">
   <aside className="sidebar"><div className="section-heading"><span>EXPERIMENTS</span><span>06</span></div><TabsList className="demo-list">{demos.map((d, i) => <TabsTrigger disabled={i > 4} key={d.id} value={d.id} className="demo-option"><span className="demo-number">0{i + 1}</span><span className="demo-copy"><strong>{d.name}</strong><small>{d.subtitle}</small></span><ChevronRight size={15} /></TabsTrigger>)}</TabsList><div className="sidebar-bottom"><span className="little-orbit">◎</span><p>A playground for<br />the laws of nature.</p><span className="secondary-meta">REAL-TIME · THREE DIMENSIONS</span></div></aside>
   <TabsContent value={demo} className="experiment">
    <div className="scene-wrap">{mounted && <Suspense fallback={<div className="loading">Initializing physics…</div>}><Scene key={reset} settings={settings} onMetrics={setMetrics} command={command} demo={demo} color={info.color} /></Suspense>}</div>
    <div className="scene-heading"><div className="eyebrow"><span />{info.level}</div><h1>{info.label}</h1><p>{info.description}</p></div>
    <div className="scene-tools"><button className="icon-button" onClick={() => { const el = document.documentElement; if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.(); }} aria-label="Toggle fullscreen"><Expand size={18} /></button></div>
    <div className="scene-label"><span className="crosshair">+</span> GRAVITATIONAL TEST CHAMBER <span>01</span></div>
    <div className="canvas-help"><MoveUpRight size={14} /> Drag objects to throw <span>·</span> Drag space to orbit</div>
    <div className="transport"><button onClick={() => update('paused', !settings.paused)} className="icon-button" aria-label={settings.paused ? 'Resume simulation' : 'Pause simulation'}>{settings.paused ? <Play size={17} /> : <Pause size={17} />}</button><button onClick={() => setReset(n => n + 1)} className="icon-button" aria-label="Reset experiment"><RotateCcw size={17} /></button><div className="transport-divider" /><span>{settings.paused ? 'PAUSED' : 'SIMULATION RUNNING'}</span><i className={settings.paused ? '' : 'status-dot'} /></div>
   </TabsContent>
   <aside className="controls"><div className="section-heading"><span>CONTROL ROOM</span><span className="live-tag">LIVE</span></div><div className="control-section"><div className="control-title"><span>Environment</span><Atom size={15} /></div><Range label="Gravity" value={settings.gravity} min={0} max={20} step={.1} unit="m/s²" onChange={v => update('gravity', v)} />{demo === 'swarm' && <><Range label="Field strength" value={settings.strength} min={.2} max={3} step={.1} onChange={v => update('strength', v)} /><Choice label="Formation" value={settings.formation} options={['orbit','sphere','vortex']} onChange={v => update('formation', v)} /></>}{demo === 'destruction' && <Range label="Projectile power" value={settings.strength} min={.3} max={3} step={.1} onChange={v => update('strength', v)} />}{demo === 'orbit' && <><Range label="Field strength" value={settings.strength} min={.2} max={3} step={.1} onChange={v => update('strength', v)} /><Range label="Attractor position" value={settings.coreX} min={-4} max={4} step={.1} unit="m" onChange={v => update('coreX', v)} /></>}<Range label="Restitution" value={settings.bounce} min={0} max={1} step={.05} onChange={v => update('bounce', v)} /><Range label="Friction" value={settings.friction} min={0} max={1} step={.05} onChange={v => update('friction', v)} /></div><div className="control-section"><div className="control-title">Time scale <span className="control-value">{settings.speed.toFixed(2)}×</span></div><div className="speed-options">{[.25, .5, 1].map(s => <button key={s} className={settings.speed === s ? 'selected' : ''} onClick={() => update('speed', s)}>{s === 1 ? 'Real time' : `${s}×`}</button>)}</div></div><div className="control-section"><div className="control-title">Introduce matter <ArrowUpRight size={15} /></div><div className="spawn-buttons"><button onClick={() => fire('sphere')}><Circle size={17} /> Sphere</button><button onClick={() => fire('cube')}><Box size={17} /> Cube</button></div><button className="primary-action" onClick={() => fire(demo === 'chain' ? 'trigger' : demo === 'destruction' ? 'launch' : 'pulse')}><Zap size={17} />{info.action}<span>↗</span></button></div><div className="telemetry"><div className="section-heading">TELEMETRY <span>↗</span></div><div><span>Frame rate</span><strong>{metrics.fps || '—'} <small>FPS</small></strong></div><div><span>Active bodies</span><strong>{metrics.bodies}</strong></div><div><span>Physics solver</span><strong className="solver">RAPIER <span className="status-dot" /></strong></div><div><span>Kinetic energy</span><strong>{metrics.energy.toLocaleString()} <small>J</small></strong></div></div></aside>
  </Tabs><footer className="footer"><span><span className="status-dot" /> ALL SYSTEMS NOMINAL</span><span>RIGID BODIES. INFINITE POSSIBILITIES.</span><span>GRAVITY LAB <span className="muted">/</span> 2026</span></footer>
 </main>;
}
function Range({ label, value, min, max, step, unit = '', onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
 return <div className="range-control"><div><label>{label}</label><output>{value.toFixed(step < .1 ? 2 : 1)} <small>{unit}</small></output></div><Slider aria-label={label} value={[value]} min={min} max={max} step={step} onValueChange={v => onChange(Array.isArray(v) ? v[0] : v)} /></div>;
}

function Choice({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(v:string)=>void}) { return <div className="choice"><div className="choice-label">{label}</div><RadioGroup aria-label={label} value={value} onValueChange={v=>onChange(String(v))} className="choice-options">{options.map(option=><label key={option} className={option===value?'selected':''}><RadioGroupItem value={option} /><span>{option}</span></label>)}</RadioGroup></div>; }
