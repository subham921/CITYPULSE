import React from 'react';
import { Activity, Gauge, Navigation, AlertTriangle } from 'lucide-react';

const CORRIDORS = [
  { name: 'College Street / MG Rd', status: 'Moderate', speed: 18, risk: 'High Water Risk', color: 'border-amber-500/40 text-amber-300' },
  { name: 'Park Circus 7-Point', status: 'Heavy Congestion', speed: 12, risk: 'Near-Miss Alert', color: 'border-rose-500/40 text-rose-300' },
  { name: 'EM Bypass (Chingrighata)', status: 'Free Flow', speed: 44, risk: 'Clear Flow', color: 'border-emerald-500/40 text-emerald-300' },
  { name: 'Central Avenue (CR Ave)', status: 'Moderate', speed: 26, risk: 'Surface Distress', color: 'border-cyan-500/40 text-cyan-300' },
  { name: 'Howrah Approach / Strand Rd', status: 'Dense', speed: 15, risk: 'Monitored', color: 'border-purple-500/40 text-purple-300' }
];

export default function CorridorTrafficBar() {
  return (
    <div className="mb-6 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
      <div className="flex items-center space-x-2">
        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
        </div>
        <span className="font-bold text-white uppercase tracking-wider text-[11px]">
          KOLKATA ARTERIAL TRANSIT CORRIDORS:
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CORRIDORS.map((c, i) => (
          <div
            key={i}
            className={`px-3 py-1.5 rounded-xl bg-slate-900/90 border ${c.color} flex items-center space-x-2`}
          >
            <span className="font-semibold text-slate-200">{c.name}</span>
            <span className="text-[10px] opacity-70">|</span>
            <span className="font-bold">{c.speed} km/h</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300">
              {c.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
