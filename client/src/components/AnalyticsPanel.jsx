import React from 'react';
import { BarChart3, ShieldCheck, Activity, Layers, AlertCircle, Waves } from 'lucide-react';

export default function AnalyticsPanel({ events = [], integrityValid = true }) {
  // Count by types
  const typeCounts = {
    POTHOLE: 0,
    WATERLOGGED: 0,
    NEAR_MISS: 0,
    MISSING_DIVIDER: 0,
    ROAD_DISTRESS: 0
  };

  let total = events.length;
  events.forEach((e) => {
    const t = e.event_type || 'POTHOLE';
    if (typeCounts[t] !== undefined) typeCounts[t]++;
    else typeCounts[t] = 1;
  });

  // Calculate percentages
  const typesList = [
    { key: 'POTHOLE', label: 'Pothole Cavities', icon: '🕳️', color: 'bg-red-500', count: typeCounts.POTHOLE },
    { key: 'WATERLOGGED', label: 'Ultrasonic Flood / Water', icon: '🌊', color: 'bg-sky-500', count: typeCounts.WATERLOGGED },
    { key: 'NEAR_MISS', label: 'Near-Miss Incidents', icon: '⚠️', color: 'bg-amber-500', count: typeCounts.NEAR_MISS },
    { key: 'MISSING_DIVIDER', label: 'Missing Dividers', icon: '🚧', color: 'bg-purple-500', count: typeCounts.MISSING_DIVIDER },
    { key: 'ROAD_DISTRESS', label: 'Road Distress', icon: '🚨', color: 'bg-cyan-500', count: typeCounts.ROAD_DISTRESS }
  ];

  // Severity counts
  const severeCount = events.filter(e => e.severity === 'SEVERE' || e.severity === 'CRITICAL').length;
  const modCount = events.filter(e => e.severity === 'MODERATE').length;
  const lowCount = total - severeCount - modCount;

  return (
    <div className="hologram-card rounded-2xl p-5 border border-cyan-500/20 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="font-['Orbitron'] font-bold text-xs uppercase tracking-wide text-white">
              SIGNAL ANALYTICS & BREAKDOWN
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {total} SIGNALS MONITORED
          </span>
        </div>

        {/* Hazard Distribution Progress Bars */}
        <div className="space-y-3.5 mb-6">
          {typesList.map((item) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            return (
              <div key={item.key} className="font-mono text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-300 flex items-center gap-1.5 text-[11px]">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  <span className="font-bold text-slate-200">
                    {item.count} <span className="text-[10px] text-slate-500">({pct}%)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden border border-slate-700/50">
                  <div
                    className={`h-full ${item.color} transition-all duration-500 rounded-full`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Severity Distribution Pills */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 mb-4 font-mono text-xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-2">
            SEVERITY RATIO
          </span>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/50">
              <span className="text-[10px] text-rose-400 block font-bold">SEVERE</span>
              <strong className="text-base text-white">{severeCount}</strong>
            </div>
            <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/50">
              <span className="text-[10px] text-amber-400 block font-bold">MODERATE</span>
              <strong className="text-base text-white">{modCount}</strong>
            </div>
            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50">
              <span className="text-[10px] text-emerald-400 block font-bold">LOW</span>
              <strong className="text-base text-white">{Math.max(0, lowCount)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Cryptographic Ledger Seal Status */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between font-mono text-xs">
        <div className="flex items-center space-x-2">
          <ShieldCheck className={`w-4 h-4 ${integrityValid ? 'text-emerald-400' : 'text-rose-400'}`} />
          <span className="text-slate-300 text-[11px]">SHA-256 Ledger Audit:</span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          integrityValid ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
        }`}>
          {integrityValid ? 'VALIDATED ✓' : 'CORRUPTED ⚠️'}
        </span>
      </div>
    </div>
  );
}
