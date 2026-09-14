import React from 'react';
import { AlertCircle, Clock, ShieldCheck, CheckCircle2, Bus, Waves, TrendingUp } from 'lucide-react';

export default function OverviewMetrics({ events = [], stats = null }) {
  const total = stats?.total_events ?? events.length;
  
  const unreviewed = stats?.by_status?.NEW ?? events.filter(e => (e.status || 'NEW') === 'NEW').length;
  const underReview = stats?.by_status?.UNDER_REVIEW ?? events.filter(e => e.status === 'UNDER_REVIEW').length;
  const actioned = stats?.by_status?.ACTIONED ?? events.filter(e => e.status === 'ACTIONED').length;
  
  const busesSet = new Set(
    events.map(e => e.bus_id).filter(b => b && b !== 'CITIZEN_PORTAL' && b !== 'UNKNOWN')
  );
  const activeBuses = stats?.buses_reporting?.length ?? (busesSet.size || 6);

  const waterloggedEvents = events.filter(e => e.event_type === 'WATERLOGGED' || e.ultrasonic);
  const aboveBumperCount = waterloggedEvents.filter(e => {
    const us = e.ultrasonic || e.waterlogged_details || {};
    return us.above_bumper || (Number(us.water_depth_cm || 0) >= 35.0);
  }).length;

  const actionRate = total > 0 ? Math.round((actioned / total) * 100) : 0;

  const cards = [
    {
      id: 'total',
      label: 'TOTAL ROAD HAZARDS',
      val: total,
      sub: 'All Edge & Citizen reports',
      icon: <AlertCircle className="w-4 h-4 text-cyan-400" />,
      glow: 'from-cyan-500/15 to-transparent',
      borderColor: 'border-cyan-500/30',
      textColor: 'text-white'
    },
    {
      id: 'new',
      label: 'UNREVIEWED / NEW',
      val: unreviewed,
      sub: 'Immediate triage pending',
      icon: <Clock className="w-4 h-4 text-amber-400" />,
      glow: 'from-amber-500/15 to-transparent',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-300'
    },
    {
      id: 'review',
      label: 'UNDER PROCESS',
      val: underReview,
      sub: 'Field investigation active',
      icon: <TrendingUp className="w-4 h-4 text-sky-400" />,
      glow: 'from-sky-500/15 to-transparent',
      borderColor: 'border-sky-500/30',
      textColor: 'text-sky-300'
    },
    {
      id: 'actioned',
      label: 'ACTIONED / RESOLVED',
      val: actioned,
      sub: `${actionRate}% resolution rate`,
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      glow: 'from-emerald-500/15 to-transparent',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-400'
    },
    {
      id: 'buses',
      label: 'ACTIVE FLEET BUSES',
      val: activeBuses,
      sub: 'Live edge telemetry stream',
      icon: <Bus className="w-4 h-4 text-indigo-400" />,
      glow: 'from-indigo-500/15 to-transparent',
      borderColor: 'border-indigo-500/30',
      textColor: 'text-indigo-300'
    },
    {
      id: 'waterlogged',
      label: 'WATERLOGGED / FLOOD',
      val: waterloggedEvents.length,
      sub: `${aboveBumperCount} exceed 35cm bumper limit`,
      icon: <Waves className="w-4 h-4 text-blue-400" />,
      glow: 'from-blue-500/15 to-transparent',
      borderColor: 'border-blue-500/30',
      textColor: 'text-blue-300'
    }
  ];

  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6" aria-label="Overview Metrics">
      {cards.map((c) => (
        <div
          key={c.id}
          className={`relative overflow-hidden rounded-2xl p-4 bg-gradient-to-b ${c.glow} bg-slate-900/75 backdrop-blur-md border ${c.borderColor} shadow-lg transition-all hover:scale-[1.02]`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
              {c.label}
            </span>
            <div className="p-1 rounded-lg bg-slate-800/80">
              {c.icon}
            </div>
          </div>
          <div className="flex items-baseline space-x-1 my-1">
            <strong className={`font-['Orbitron'] text-2xl lg:text-3xl font-black ${c.textColor}`}>
              {c.val}
            </strong>
          </div>
          <p className="text-[11px] font-mono text-slate-400 truncate mt-1">
            {c.sub}
          </p>
        </div>
      ))}
    </section>
  );
}
