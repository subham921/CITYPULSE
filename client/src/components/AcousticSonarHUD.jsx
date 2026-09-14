import React, { useState, useEffect, useRef } from 'react';
import { Radio, AlertTriangle, Waves, Zap, Compass, CheckCircle2, ChevronDown } from 'lucide-react';
import { simulateUltrasonic } from '../utils/api';
import { playSonarPing, playHazardAlert } from '../utils/audioFx';

const CORRIDORS = [
  'College Street / MG Road Crossing',
  'Amherst Street (St. Paul\'s Cathedral Road)',
  'Park Circus Seven Point Crossing',
  'Central Avenue (CR Avenue & BB Ganguly St)',
  'Thanthania Kalibari Junction',
  'EM Bypass - Chingrighata Flyover Base',
  'Behala Chowrasta / Diamond Harbour Rd'
];

export default function AcousticSonarHUD({ onIncidentGenerated, onToast }) {
  const [depthCm, setDepthCm] = useState(18.5);
  const [bumperLimitCm] = useState(35.0);
  const [sensorId] = useState('US-SONAR-01');
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedCorridor, setSelectedCorridor] = useState(CORRIDORS[0]);
  const canvasRef = useRef(null);

  const isAboveBumper = depthCm >= bumperLimitCm;
  const overflowCm = isAboveBumper ? +(depthCm - bumperLimitCm).toFixed(1) : 0;

  // Render 360-degree acoustic radar scope canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let angle = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(cx, cy) - 8;

      ctx.clearRect(0, 0, w, h);

      // Outer Glow & Circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isAboveBumper ? 'rgba(244, 63, 94, 0.4)' : 'rgba(0, 242, 254, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Range Rings (10cm, 20cm, 35cm, 50cm)
      [0.25, 0.5, 0.7, 1.0].forEach((ratio, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * ratio, 0, Math.PI * 2);
        ctx.strokeStyle = i === 2 ? 'rgba(244, 63, 94, 0.6)' : 'rgba(0, 242, 254, 0.15)';
        ctx.lineWidth = i === 2 ? 1.5 : 1;
        if (i === 2) ctx.setLineDash([4, 4]);
        else ctx.setLineDash([]);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Sweep Beam
      const sweepGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      sweepGradient.addColorStop(0, 'rgba(0, 242, 254, 0.4)');
      sweepGradient.addColorStop(1, 'rgba(0, 242, 254, 0.0)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + 0.35);
      ctx.fillStyle = sweepGradient;
      ctx.fill();
      ctx.restore();

      // Acoustic Echo Blip based on current depth
      const blipDistRatio = Math.min(1.0, depthCm / 60.0);
      const bx = cx + Math.cos(angle - 0.2) * (radius * blipDistRatio);
      const by = cy + Math.sin(angle - 0.2) * (radius * blipDistRatio);

      ctx.beginPath();
      ctx.arc(bx, by, isAboveBumper ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isAboveBumper ? '#f43f5e' : '#00f2fe';
      ctx.shadowColor = isAboveBumper ? '#f43f5e' : '#00f2fe';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      angle = (angle + 0.035) % (Math.PI * 2);
      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [depthCm, isAboveBumper]);

  const handleSimulate = async (forceAbove) => {
    setIsSimulating(true);
    playSonarPing();
    try {
      const res = await simulateUltrasonic(forceAbove, null, selectedCorridor);
      if (res && res.water_depth_cm !== undefined) {
        setDepthCm(res.water_depth_cm);
        if (res.above_bumper) {
          playHazardAlert();
          if (onToast) onToast(`🚨 WATERLOGGED: ${res.water_depth_cm}cm exceeds 35cm bumper limit (+${res.clearance_overflow_cm}cm)! Alert dispatched.`, 'error');
        } else {
          if (onToast) onToast(`📡 Safe road telemetry: ${res.water_depth_cm}cm water level logged.`, 'success');
        }
        if (onIncidentGenerated) onIncidentGenerated();
      }
    } catch (e) {
      if (onToast) onToast(`Simulation request failed: ${e.message}`, 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="hologram-card rounded-2xl p-5 mb-6 relative overflow-hidden border border-cyan-500/25">
      {/* Background Decorative Ambient Radial Glow */}
      <div className={`absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
        isAboveBumper ? 'bg-rose-600/15' : 'bg-cyan-500/10'
      }`} />

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between pb-3.5 mb-4 border-b border-slate-800/80 gap-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl ${isAboveBumper ? 'bg-rose-500/20 text-rose-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
            <Waves className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-['Orbitron'] font-bold text-sm tracking-wide text-white">
                ULTRASONIC DEPTH TELEMETRY & FLOOD SONAR
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {sensorId}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              Bus-Chassis Acoustic Transducer • Calibrated Bumper Limit: 35.0 cm
            </p>
          </div>
        </div>

        {/* Target Corridor Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-slate-400 hidden sm:inline">Corridor:</span>
          <select
            value={selectedCorridor}
            onChange={(e) => setSelectedCorridor(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            {CORRIDORS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Radar Canvas, Physical Bus Gauge, Telemetry Verdict */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: 360-Degree Sonar Radar Scope */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
          <div className="relative">
            <canvas ref={canvasRef} width={200} height={200} className="rounded-full shadow-inner" />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className={`text-xl font-['Orbitron'] font-bold ${isAboveBumper ? 'text-rose-400 text-glow-rose' : 'text-cyan-300 text-glow-cyan'}`}>
                {depthCm.toFixed(1)}
              </span>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                cm depth
              </span>
            </div>
          </div>
          <span className="mt-2 text-[11px] font-mono text-slate-400">
            Acoustic ToF Echo Radar (343 m/s)
          </span>
        </div>

        {/* Center: Bus Chassis Cross-Section & Fluid Water Level */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300">Surface Water Height</span>
            <span className="text-cyan-400 font-bold">{depthCm.toFixed(1)} cm / 100 cm max</span>
          </div>

          {/* Depth Progress Bar with 35cm Threshold Line */}
          <div className="relative w-full h-8 rounded-xl bg-slate-950/80 p-1 border border-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2 font-mono text-[11px] font-bold ${
                isAboveBumper
                  ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/40'
                  : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950'
              }`}
              style={{ width: `${Math.min(100, (depthCm / 80) * 100)}%` }}
            >
              {depthCm > 12 && `${depthCm.toFixed(1)} cm`}
            </div>

            {/* 35cm Bumper Threshold Marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-rose-400 z-10 flex flex-col items-center"
              style={{ left: `${(35.0 / 80) * 100}%` }}
              title="Bus Bumper Threshold (35.0cm)"
            >
              <div className="absolute -top-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="absolute -bottom-5 text-[9px] font-mono text-rose-400 whitespace-nowrap">
                35cm Bumper
              </span>
            </div>
          </div>

          {/* Physical Bus Bumper Graphic Details */}
          <div className="pt-3 flex items-center justify-between text-xs font-mono text-slate-400 border-t border-slate-800/60">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>Ground Baseline: 0.0 cm</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>Bumper Clearance: 35.0 cm</span>
            </div>
          </div>
        </div>

        {/* Right: Telemetric Verdict Card & Interactive Simulation Triggers */}
        <div className="lg:col-span-3 flex flex-col space-y-3">
          {/* Verdict Box */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col space-y-1 ${
              isAboveBumper
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                : 'bg-cyan-950/30 border-cyan-500/30 text-cyan-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {isAboveBumper ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              <span className="font-bold text-xs uppercase tracking-wide">
                {isAboveBumper ? 'CRITICAL FLOOD ALERT' : 'SURFACE CLEARANCE SAFE'}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-300">
              {isAboveBumper
                ? `🚨 Water level exceeds bumper clearance by +${overflowCm} cm! High engine risk.`
                : `✓ Road passable. Clearance margin: +${(bumperLimitCm - depthCm).toFixed(1)} cm.`}
            </p>
          </div>

          {/* Interactive Trigger Buttons */}
          <div className="flex flex-col space-y-2">
            <button
              disabled={isSimulating}
              onClick={() => handleSimulate(false)}
              className="flex items-center justify-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-600/30 transition-all disabled:opacity-50"
            >
              <Radio className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>Simulate Sonar Ping</span>
            </button>

            <button
              disabled={isSimulating}
              onClick={() => handleSimulate(true)}
              className="flex items-center justify-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white shadow-md shadow-rose-600/30 transition-all disabled:opacity-50"
            >
              <Waves className="w-3.5 h-3.5" />
              <span>Force High Flood (&gt;35cm)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
