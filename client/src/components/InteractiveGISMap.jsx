import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Layers, ZoomIn, ZoomOut, Compass, Info, Check, Filter } from 'lucide-react';

const HAZARD_CONFIG = {
  WATERLOGGED: { color: '#0284c7', label: 'Waterlogged', icon: '🌊' },
  POTHOLE: { color: '#ef4444', label: 'Pothole', icon: '🕳️' },
  NEAR_MISS: { color: '#f59e0b', label: 'Near Miss', icon: '⚠️' },
  MISSING_DIVIDER: { color: '#8b5cf6', label: 'Divider', icon: '🚧' },
  ROAD_DISTRESS: { color: '#06b6d4', label: 'Road Distress', icon: '🚨' }
};

export default function InteractiveGISMap({ events, onSelectEvent }) {
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const mapContainerRef = useRef(null);
  const mapplsMapRef = useRef(null);
  const markersRef = useRef([]);

  const filteredEvents = events.filter((ev) => {
    if (selectedFilter === 'ALL') return true;
    return ev.event_type === selectedFilter;
  });

  // Initialize Mappls Web Map SDK or fallback
  useEffect(() => {
    if (typeof window !== 'undefined' && window.mappls && mapContainerRef.current) {
      try {
        if (!mapplsMapRef.current) {
          mapplsMapRef.current = new window.mappls.Map(mapContainerRef.current, {
            center: [22.5726, 88.3639],
            zoom: 12,
            zoomControl: false,
            hybrid: false
          });
        }
      } catch (e) {
        console.warn('[Mappls SDK Init fallback]', e);
      }
    }
  }, []);

  // Update Markers on Events change
  useEffect(() => {
    const map = mapplsMapRef.current;
    if (!map || typeof window === 'undefined' || !window.mappls) return;

    // Clear old markers
    markersRef.current.forEach((m) => {
      try { if (m && m.remove) m.remove(); } catch (e) {}
    });
    markersRef.current = [];

    // Add marker for each filtered event
    filteredEvents.slice(0, 50).forEach((ev) => {
      const loc = ev.location || {};
      const lat = loc.latitude || ev.latitude;
      const lng = loc.longitude || ev.longitude;
      if (!lat || !lng) return;

      try {
        const cfg = HAZARD_CONFIG[ev.event_type] || HAZARD_CONFIG.POTHOLE;
        const marker = new window.mappls.Marker({
          map: map,
          position: { lat, lng },
          icon: `https://apis.mapmyindia.com/map_v3/1.png`,
          popupHtml: `<div style="font-family:sans-serif;padding:6px;font-size:12px;"><strong>${cfg.icon} ${ev.event_type}</strong><br/>${ev.address || ''}<br/>Severity: ${ev.severity}</div>`
        });
        marker.addListener('click', () => {
          setSelectedIncident(ev);
          if (onSelectEvent) onSelectEvent(ev);
        });
        markersRef.current.push(marker);
      } catch (e) {}
    });
  }, [filteredEvents, onSelectEvent]);

  return (
    <div className="hologram-card rounded-2xl p-4 mb-6 border border-cyan-500/20 relative">
      {/* Map Header with Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
            <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '10s' }} />
          </div>
          <h3 className="font-['Orbitron'] font-bold text-xs uppercase tracking-wide text-white">
            KOLKATA METROPOLITAN GIS VECTOR TWIN ({filteredEvents.length} HAZARDS)
          </h3>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {['ALL', 'WATERLOGGED', 'POTHOLE', 'NEAR_MISS', 'MISSING_DIVIDER'].map((type) => {
            const active = selectedFilter === type;
            return (
              <button
                key={type}
                onClick={() => setSelectedFilter(type)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  active
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/40'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {type === 'ALL' ? '● All' : HAZARD_CONFIG[type]?.label || type}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-[380px] rounded-xl overflow-hidden bg-[#0a0f1d] border border-slate-800">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Vector Canvas GIS Overlay / Fallback Graphic */}
        <div className="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur-md px-3 py-2 rounded-xl border border-cyan-500/20 text-xs font-mono text-slate-300 pointer-events-none flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]"></span>
            <span>Waterlogged</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span>
            <span>Pothole</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></span>
            <span>Near Miss</span>
          </div>
        </div>

        {/* Active Marker Drill-Down Modal if clicked */}
        {selectedIncident && (
          <div className="absolute top-3 right-3 max-w-xs bg-slate-950/95 backdrop-blur-xl p-4 rounded-xl border border-cyan-400/40 shadow-2xl z-20 text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-cyan-300">
                {selectedIncident.event_type}
              </span>
              <button
                onClick={() => setSelectedIncident(null)}
                className="text-slate-400 hover:text-white px-1.5"
              >
                ✕
              </button>
            </div>
            <div className="pt-2 space-y-1.5 text-slate-300">
              <p className="line-clamp-2 text-slate-400">{selectedIncident.address}</p>
              <div className="flex justify-between">
                <span>Severity:</span>
                <span className="font-bold text-rose-400">{selectedIncident.severity}</span>
              </div>
              {selectedIncident.ultrasonic && (
                <div className="flex justify-between text-cyan-300">
                  <span>Water Depth:</span>
                  <span className="font-bold">{selectedIncident.ultrasonic.water_depth_cm} cm</span>
                </div>
              )}
              <div className="text-[10px] text-slate-500 truncate pt-1">
                ID: {selectedIncident.event_id}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
