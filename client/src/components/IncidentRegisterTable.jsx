import React, { useState } from 'react';
import { Shield, Search, ChevronRight, CheckCircle2, Clock, Eye, AlertCircle, Waves, Cpu } from 'lucide-react';
import { updateEventStatus } from '../utils/api';
import { playSuccessChime, playRadarBeep } from '../utils/audioFx';

export default function IncidentRegisterTable({ events, onStatusUpdated, onToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const filteredEvents = events.filter((ev) => {
    if (severityFilter !== 'ALL' && ev.severity !== severityFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const addr = (ev.address || '').toLowerCase();
    const id = (ev.event_id || '').toLowerCase();
    const type = (ev.event_type || '').toLowerCase();
    return addr.includes(term) || id.includes(term) || type.includes(term);
  });

  const handleAction = async (eventId, newStatus) => {
    setUpdatingId(eventId);
    playRadarBeep();
    try {
      await updateEventStatus(eventId, newStatus, 'TRANSPORT_AUTHORITY', 'Updated via React Command Center');
      playSuccessChime();
      if (onToast) onToast(`Incident status transitioned to ${newStatus}`, 'success');
      if (onStatusUpdated) onStatusUpdated();
    } catch (e) {
      if (onToast) onToast(`Status transition failed: ${e.message}`, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const renderTelemetryColumn = (ev) => {
    // 1. Waterlogged / Ultrasonic Sonar
    if (ev.event_type === 'WATERLOGGED' || ev.ultrasonic || ev.waterlogged_details) {
      const us = ev.ultrasonic || ev.waterlogged_details || {};
      const depth = Number(us.water_depth_cm || 0);
      const limit = Number(us.bumper_clearance_cm || 35.0);
      const isAbove = us.above_bumper || depth >= limit;
      const overflow = isAbove ? +(depth - limit).toFixed(1) : 0;

      return (
        <div className="flex flex-col space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-cyan-300 font-bold flex items-center gap-1">
              <Waves className="w-3 h-3 text-cyan-400" />
              {depth.toFixed(1)} cm depth
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isAbove ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-teal-950 text-teal-400 border border-teal-800'
            }`}>
              {isAbove ? `🚨 +${overflow}cm Over Bumper` : '✓ Below Bumper'}
            </span>
          </div>
          {/* Mini gauge */}
          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full ${isAbove ? 'bg-rose-500' : 'bg-cyan-400'}`}
              style={{ width: `${Math.min(100, (depth / 60) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Transducer: {us.sensor_id || 'US-SONAR-01'}</span>
        </div>
      );
    }

    // 2. Pothole IMU shock
    if (ev.event_type === 'POTHOLE' || ev.pothole_details) {
      const imu = ev.imu || {};
      const shock = imu.acceleration_z || 1.0;
      return (
        <div className="flex flex-col text-[11px] font-mono space-y-0.5">
          <span className="text-amber-300 font-bold flex items-center gap-1">
            <Cpu className="w-3 h-3 text-amber-400" />
            Vertical Shock: {shock.toFixed(1)}G
          </span>
          <span className="text-slate-400 text-[10px]">
            Wheel Impact: {imu.shock_detected ? 'Confirmed' : 'Normal'}
          </span>
        </div>
      );
    }

    // Default
    return (
      <span className="text-xs font-mono text-slate-400">
        GPS Speed: {ev.gps?.speed_kmh || 0} km/h
      </span>
    );
  };

  return (
    <div className="hologram-card rounded-2xl p-5 mb-6 border border-cyan-500/20">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-800">
        <div>
          <h3 className="font-['Orbitron'] font-bold text-sm uppercase tracking-wide text-white">
            INCIDENT AUDIT REGISTER ({filteredEvents.length} RECORDS)
          </h3>
          <p className="text-xs font-mono text-slate-400">
            Real-time Edge Telemetry, Ultrasonic Sonar Ingestion & Workflow Actions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search location or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900/90 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Severity Dropdown */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Severities</option>
            <option value="SEVERE">Severe</option>
            <option value="MODERATE">Moderate</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <th className="py-3 px-3">Hazard Type</th>
              <th className="py-3 px-3">Severity</th>
              <th className="py-3 px-3">Location / Geocode</th>
              <th className="py-3 px-3">Telemetry / Sonar Readout</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3 text-right">Workflow Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredEvents.map((ev) => {
              const isExpanded = expandedId === ev.event_id;
              const isUpdating = updatingId === ev.event_id;
              return (
                <React.Fragment key={ev.event_id || Math.random()}>
                  <tr className="hover:bg-slate-900/40 transition-colors">
                    {/* Type */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white tracking-wide">
                          {ev.event_type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">{ev.bus_id || 'EDGE_NODE'}</span>
                    </td>

                    {/* Severity */}
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        ev.severity === 'SEVERE'
                          ? 'bg-rose-950/70 text-rose-400 border border-rose-800'
                          : ev.severity === 'MODERATE'
                          ? 'bg-amber-950/70 text-amber-400 border border-amber-800'
                          : 'bg-emerald-950/70 text-emerald-400 border border-emerald-800'
                      }`}>
                        {ev.severity || 'MODERATE'}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-3 max-w-[220px]">
                      <p className="truncate text-slate-300" title={ev.address}>
                        {ev.address || `${ev.latitude?.toFixed(4)}, ${ev.longitude?.toFixed(4)}`}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Sensor Telemetry / Ultrasonic Readout */}
                    <td className="py-3.5 px-3 min-w-[200px]">
                      {renderTelemetryColumn(ev)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        ev.status === 'ACTIONED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : ev.status === 'UNDER_REVIEW'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      }`}>
                        {ev.status || 'NEW'}
                      </span>
                    </td>

                    {/* Actions & Details Toggle */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {ev.status !== 'ACTIONED' && (
                          <button
                            disabled={isUpdating}
                            onClick={() => handleAction(ev.event_id, 'ACTIONED')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm transition-all"
                          >
                            Action
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : ev.event_id)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Inspect Telemetric & Blockchain Audit Ledger"
                        >
                          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90 text-cyan-400' : ''}`} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Telemetry Drawer */}
                  {isExpanded && (
                    <tr className="bg-slate-950/70 border-b border-slate-800">
                      <td colSpan={6} className="p-4 space-y-3 font-mono text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="text-cyan-400 font-bold block mb-1">Blockchain SHA-256 Ledger:</span>
                            <p className="text-[10px] break-all text-slate-300">
                              Block Hash: {ev.evidence_hash || 'GENESIS'}
                            </p>
                            <p className="text-[10px] break-all text-slate-500 mt-1">
                              Parent Hash: {ev.previous_evidence_hash || 'GENESIS'}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="text-cyan-400 font-bold block mb-1">AI Vision & Fusion:</span>
                            <p className="text-slate-300">Optical Confidence: {((ev.vision?.confidence || 0.94) * 100).toFixed(0)}%</p>
                            <p className="text-slate-300">IMU / Vision Sync: {ev.fusion?.time_match ? 'Matched' : 'Unconfirmed'}</p>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="text-cyan-400 font-bold block mb-1">Full Coordinates:</span>
                            <p className="text-slate-300">Lat: {ev.location?.latitude || ev.latitude}</p>
                            <p className="text-slate-300">Lng: {ev.location?.longitude || ev.longitude}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
