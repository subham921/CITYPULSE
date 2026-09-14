import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Compass, ZoomIn, ZoomOut, RotateCcw, Eye, Layers, Filter, MapPin, X, AlertTriangle, Waves } from 'lucide-react';

const DEFAULT_CENTER = { lat: 22.5726, lng: 88.3639 }; // Central Kolkata
const DEFAULT_ZOOM = 12.8;

const HAZARD_TYPES = {
  WATERLOGGED: { color: '#0284c7', label: 'Waterlogged', icon: '🌊', bg: 'bg-sky-500' },
  POTHOLE: { color: '#ef4444', label: 'Pothole', icon: '🕳️', bg: 'bg-red-500' },
  NEAR_MISS: { color: '#f59e0b', label: 'Near Miss', icon: '⚠️', bg: 'bg-amber-500' },
  MISSING_DIVIDER: { color: '#8b5cf6', label: 'Divider', icon: '🚧', bg: 'bg-purple-500' },
  ROAD_DISTRESS: { color: '#06b6d4', label: 'Distress', icon: '🚨', bg: 'bg-cyan-500' }
};

export default function InteractiveGISMap({ events = [], onSelectEvent }) {
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL'); // 'ALL' | 'BUS' | 'CITIZEN'
  const [activePopup, setActivePopup] = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Map viewport state
  const viewportRef = useRef({
    centerLat: DEFAULT_CENTER.lat,
    centerLng: DEFAULT_CENTER.lng,
    zoom: DEFAULT_ZOOM,
    isDragging: false,
    startX: 0,
    startY: 0,
    initLat: DEFAULT_CENTER.lat,
    initLng: DEFAULT_CENTER.lng,
    pulsePhase: 0
  });

  const filteredEvents = events.filter((ev) => {
    if (selectedFilter !== 'ALL' && ev.event_type !== selectedFilter) return false;
    if (sourceFilter === 'CITIZEN') {
      return ev.bus_id === 'CITIZEN_PORTAL' || Boolean(ev.citizen_details);
    }
    if (sourceFilter === 'BUS') {
      return ev.bus_id !== 'CITIZEN_PORTAL' && !ev.citizen_details;
    }
    return true;
  });

  // Equirectangular projection
  const project = useCallback((lat, lng, width, height) => {
    const { centerLat, centerLng, zoom } = viewportRef.current;
    const scale = (Math.pow(2, zoom) * 256) / 360;
    const rad = (centerLat * Math.PI) / 180;
    const x = width / 2 + (lng - centerLng) * scale * Math.cos(rad);
    const y = height / 2 - (lat - centerLat) * scale;
    return { x, y };
  }, []);

  // Main canvas render routine
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    if (!w || !h) return;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // 1. Cyber Dark Background
    ctx.fillStyle = '#0a101d';
    ctx.fillRect(0, 0, w, h);

    // 2. Subtle Coordinate Grid
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const drawLineFeature = (points, color, width) => {
      if (points.length < 2) return;
      ctx.beginPath();
      const p0 = project(points[0][0], points[0][1], w, h);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < points.length; i++) {
        const pt = project(points[i][0], points[i][1], w, h);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    // 3. Hooghly River Geometry
    const river = [
      [22.66, 88.36], [22.63, 88.355], [22.605, 88.352], [22.585, 88.342],
      [22.565, 88.332], [22.545, 88.322], [22.525, 88.312], [22.49, 88.295]
    ];
    // River glow & body
    drawLineFeature(river, 'rgba(14, 165, 233, 0.15)', 26);
    drawLineFeature(river, '#0c2e4a', 20);
    drawLineFeature(river, '#0369a1', 4);

    // 4. Major Kolkata Arterial Network
    // EM Bypass
    drawLineFeature([[22.605, 88.405], [22.575, 88.398], [22.545, 88.397], [22.515, 88.395], [22.475, 88.388]], '#1e293b', 8);
    drawLineFeature([[22.605, 88.405], [22.575, 88.398], [22.545, 88.397], [22.515, 88.395], [22.475, 88.388]], '#334155', 4);
    // Maa Flyover
    drawLineFeature([[22.545, 88.397], [22.543, 88.368], [22.538, 88.345]], '#0284c7', 3);
    // Central Avenue (CR Avenue)
    drawLineFeature([[22.605, 88.375], [22.585, 88.368], [22.565, 88.352], [22.543, 88.350]], '#475569', 5);
    // Strand Road
    drawLineFeature([[22.595, 88.352], [22.585, 88.342], [22.570, 88.344], [22.552, 88.332]], '#334155', 4);
    // VIP Road
    drawLineFeature([[22.605, 88.405], [22.635, 88.428], [22.640, 88.442]], '#334155', 5);
    // Sector V Connector
    drawLineFeature([[22.575, 88.398], [22.573, 88.433], [22.585, 88.455]], '#334155', 4);

    // 5. Major Bridges across Hooghly River
    // Vidyasagar Setu (2nd Hooghly Bridge)
    drawLineFeature([[22.555, 88.322], [22.552, 88.332], [22.550, 88.342]], '#38bdf8', 5);
    // Howrah Bridge (Rabindra Setu)
    drawLineFeature([[22.585, 88.342], [22.585, 88.350]], '#38bdf8', 5);

    // 6. District Landmark Labels
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    const drawLandmark = (text, lat, lng) => {
      const pt = project(lat, lng, w, h);
      ctx.fillText(text, pt.x, pt.y);
    };
    drawLandmark('Howrah', 22.588, 88.335);
    drawLandmark('BBD Bagh / Esplanade', 22.571, 88.348);
    drawLandmark('Salt Lake Sector V', 22.575, 88.435);
    drawLandmark('EM Bypass Corridor', 22.560, 88.402);
    drawLandmark('Park Circus 7-Point', 22.542, 88.365);
    drawLandmark('Science City', 22.538, 88.399);

    // 7. Render Pulsing Hazard Event Markers
    const pulse = Math.sin(viewportRef.current.pulsePhase);

    filteredEvents.forEach((ev) => {
      const loc = ev.location || {};
      const lat = loc.latitude || ev.latitude;
      const lng = loc.longitude || ev.longitude;
      if (!lat || !lng) return;

      const pt = project(lat, lng, w, h);
      if (pt.x < -40 || pt.x > w + 40 || pt.y < -40 || pt.y > h + 40) return;

      const typeConfig = HAZARD_TYPES[ev.event_type] || HAZARD_TYPES.POTHOLE;
      const isSelected = activePopup && (activePopup.event_id === ev.event_id);
      const isSevere = ev.severity === 'CRITICAL' || ev.severity === 'SEVERE' || ev.event_type === 'WATERLOGGED';

      // Pulsing outer ripple
      const haloR = (isSevere ? 15 : 10) + (isSevere ? 6 : 3) * pulse;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, Math.max(4, haloR), 0, Math.PI * 2);
      ctx.fillStyle = typeConfig.color;
      ctx.globalAlpha = Math.max(0.1, 0.25 - 0.12 * pulse);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Pin circle
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 10 : 7.5, 0, Math.PI * 2);
      ctx.fillStyle = typeConfig.color;
      ctx.fill();
      ctx.lineWidth = isSelected ? 3 : 1.8;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Pin Symbol
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ev.event_type === 'WATERLOGGED' ? '~' : '!', pt.x, pt.y);

      // Label below pin
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.textBaseline = 'alphabetic';
      const label = ev.bus_id === 'CITIZEN_PORTAL' ? '👤 Citizen' : (ev.bus_id || 'Bus');
      ctx.fillText(label, pt.x, pt.y + 16);
    });

    ctx.restore();
  }, [filteredEvents, project, activePopup]);

  // Animation Loop
  useEffect(() => {
    let animId;
    const loop = () => {
      viewportRef.current.pulsePhase = (viewportRef.current.pulsePhase + 0.06) % (Math.PI * 2);
      renderCanvas();
      animId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animId);
  }, [renderCanvas]);

  // Resize canvas to match display size
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderCanvas();
  }, [renderCanvas]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Pan & Drag Controls
  const handleMouseDown = (e) => {
    const vp = viewportRef.current;
    vp.isDragging = true;
    vp.startX = e.clientX;
    vp.startY = e.clientY;
    vp.initLat = vp.centerLat;
    vp.initLng = vp.centerLng;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e) => {
    const vp = viewportRef.current;
    if (!vp.isDragging) return;
    const dx = e.clientX - vp.startX;
    const dy = e.clientY - vp.startY;
    const scale = (Math.pow(2, vp.zoom) * 256) / 360;
    const rad = (vp.initLat * Math.PI) / 180;
    vp.centerLng = vp.initLng - dx / (scale * Math.cos(rad));
    vp.centerLat = vp.initLat + dy / scale;
    renderCanvas();
  };

  const handleMouseUp = () => {
    const vp = viewportRef.current;
    if (vp.isDragging) {
      vp.isDragging = false;
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    }
  };

  // Zoom via wheel
  const handleWheel = (e) => {
    e.preventDefault();
    const vp = viewportRef.current;
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    vp.zoom = Math.max(10.5, Math.min(16.5, vp.zoom + delta));
    renderCanvas();
  };

  // Click on marker hit-test
  const handleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    // Search from latest to oldest
    for (let i = filteredEvents.length - 1; i >= 0; i--) {
      const ev = filteredEvents[i];
      const loc = ev.location || {};
      const lat = loc.latitude || ev.latitude;
      const lng = loc.longitude || ev.longitude;
      if (!lat || !lng) continue;

      const pt = project(lat, lng, w, h);
      const dist = Math.hypot(pt.x - mx, pt.y - my);
      if (dist <= 18) {
        setActivePopup(ev);
        setPopupPos({ x: Math.min(w - 280, Math.max(20, pt.x - 120)), y: Math.max(20, pt.y - 180) });
        if (onSelectEvent) onSelectEvent(ev);
        return;
      }
    }
    setActivePopup(null);
  };

  const zoomIn = () => {
    viewportRef.current.zoom = Math.min(16.5, viewportRef.current.zoom + 0.6);
    renderCanvas();
  };

  const zoomOut = () => {
    viewportRef.current.zoom = Math.max(10.5, viewportRef.current.zoom - 0.6);
    renderCanvas();
  };

  const recenter = () => {
    viewportRef.current.centerLat = DEFAULT_CENTER.lat;
    viewportRef.current.centerLng = DEFAULT_CENTER.lng;
    viewportRef.current.zoom = DEFAULT_ZOOM;
    renderCanvas();
  };

  return (
    <div className="hologram-card rounded-2xl p-4 mb-6 border border-cyan-500/20 relative">
      {/* Map Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
            <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '14s' }} />
          </div>
          <div>
            <h3 className="font-['Orbitron'] font-bold text-xs uppercase tracking-wide text-white flex items-center gap-2">
              <span>KOLKATA METROPOLITAN GIS VECTOR TWIN</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                {filteredEvents.length} HAZARDS ACTIVE
              </span>
            </h3>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Source Filter */}
          <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-0.5 text-xs font-mono">
            {['ALL', 'BUS', 'CITIZEN'].map((src) => (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={`px-2 py-1 rounded-lg transition-all ${
                  sourceFilter === src
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {src === 'ALL' ? 'All Sources' : src === 'BUS' ? '🚌 Fleet' : '👤 Citizen'}
              </button>
            ))}
          </div>

          {/* Hazard Type Chips */}
          <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
            {['ALL', 'WATERLOGGED', 'POTHOLE', 'NEAR_MISS', 'MISSING_DIVIDER'].map((type) => {
              const active = selectedFilter === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedFilter(type)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    active
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                      : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {type === 'ALL' ? '● All Hazards' : `${HAZARD_TYPES[type]?.icon || ''} ${HAZARD_TYPES[type]?.label || type}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Canvas Viewport Container */}
      <div
        ref={containerRef}
        className="relative w-full h-[420px] rounded-xl overflow-hidden border border-slate-800 bg-[#0a101d] select-none"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleClick}
          className="w-full h-full cursor-grab block"
        />

        {/* Map On-Screen Controls */}
        <div className="absolute top-3 right-3 flex flex-col space-y-1.5 z-10">
          <button
            onClick={zoomIn}
            className="w-8 h-8 rounded-lg bg-slate-950/90 hover:bg-slate-800 text-cyan-300 border border-slate-700/80 flex items-center justify-center font-bold text-sm shadow-lg transition-all"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={zoomOut}
            className="w-8 h-8 rounded-lg bg-slate-950/90 hover:bg-slate-800 text-cyan-300 border border-slate-700/80 flex items-center justify-center font-bold text-sm shadow-lg transition-all"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={recenter}
            className="w-8 h-8 rounded-lg bg-slate-950/90 hover:bg-slate-800 text-cyan-300 border border-slate-700/80 flex items-center justify-center text-xs shadow-lg transition-all"
            title="Center Kolkata Fleet"
          >
            ⌖
          </button>
        </div>

        {/* Geographic Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur-md px-3 py-2 rounded-xl border border-cyan-500/20 text-xs font-mono text-slate-300 pointer-events-none flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]"></span>
            <span>Waterlogged / Flood</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span>
            <span>Pothole / Crater</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></span>
            <span>Near-Miss Accident</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]"></span>
            <span>Missing Divider</span>
          </div>
        </div>

        {/* Active Incident Detail Card Popup */}
        {activePopup && (
          <div
            className="absolute z-20 w-72 p-4 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-cyan-400/50 shadow-2xl text-xs font-mono text-slate-200 animate-in fade-in"
            style={{ left: `${popupPos.x}px`, top: `${popupPos.y}px` }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase ${
                activePopup.event_type === 'WATERLOGGED' ? 'bg-sky-600' :
                activePopup.event_type === 'POTHOLE' ? 'bg-red-600' :
                activePopup.event_type === 'NEAR_MISS' ? 'bg-amber-600' : 'bg-purple-600'
              }`}>
                {activePopup.event_type}
              </span>
              <button
                onClick={() => setActivePopup(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-2 space-y-1.5">
              <p className="font-semibold text-white truncate">{activePopup.address || 'Kolkata Transit Corridor'}</p>
              
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Source:</span>
                <span className="font-bold text-slate-200">
                  {activePopup.bus_id === 'CITIZEN_PORTAL' ? `👤 Citizen (${activePopup.citizen_details?.reporter_name || 'Public'})` : `Bus ${activePopup.bus_id}`}
                </span>
              </div>

              {/* Ultrasonic Depth details */}
              {(activePopup.event_type === 'WATERLOGGED' || activePopup.ultrasonic) && (
                <div className="p-2 rounded-lg bg-sky-950/40 border border-sky-500/30 text-sky-200">
                  <div className="flex justify-between font-bold">
                    <span>Sonar Depth:</span>
                    <span>{Number(activePopup.ultrasonic?.water_depth_cm || 38.5).toFixed(1)} cm</span>
                  </div>
                  <div className="text-[10px] text-sky-300 mt-0.5">
                    {Number(activePopup.ultrasonic?.water_depth_cm || 38.5) >= 35.0 ? '🚨 Above 35cm Bus Bumper Limit' : '✓ Below Bumper'}
                  </div>
                </div>
              )}

              {/* Evidence photo if present */}
              {(activePopup.evidence?.thumbnail_url || activePopup.citizen_details?.photo_url) && (
                <div className="mt-2 rounded-lg overflow-hidden border border-slate-800 h-28 bg-slate-900">
                  <img
                    src={activePopup.evidence?.thumbnail_url || activePopup.citizen_details?.photo_url}
                    alt="Evidence"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                  />
                </div>
              )}

              <div className="pt-2 flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-800">
                <span>Status: <b className="text-cyan-300">{activePopup.status || 'NEW'}</b></span>
                <span>Severity: <b className="text-rose-400">{activePopup.severity}</b></span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
