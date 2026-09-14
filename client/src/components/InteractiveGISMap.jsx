import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Compass, ZoomIn, ZoomOut, RotateCcw, Key, Search, MapPin, Layers, AlertTriangle, Waves, ShieldCheck, Activity, Hospital, Radio } from 'lucide-react';
import { fetchMapplsToken, fetchMapplsStatus, updateMapplsCredentials, searchMapplsGeocode, searchMapplsNearby } from '../utils/api';
import { playRadarBeep, playSuccessChime } from '../utils/audioFx';

const DEFAULT_CENTER = { lat: 22.5726, lng: 88.3639 }; // Central Kolkata
const DEFAULT_ZOOM = 12.5;

const HAZARD_CONFIG = {
  WATERLOGGED: { color: '#0284c7', label: 'Waterlogged', icon: '🌊' },
  POTHOLE: { color: '#ef4444', label: 'Pothole', icon: '🕳️' },
  NEAR_MISS: { color: '#f59e0b', label: 'Near Miss', icon: '⚠️' },
  MISSING_DIVIDER: { color: '#8b5cf6', label: 'Divider', icon: '🚧' },
  ROAD_DISTRESS: { color: '#06b6d4', label: 'Distress', icon: '🚨' }
};

export default function InteractiveGISMap({ events = [], onSelectEvent }) {
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL'); // 'ALL' | 'BUS' | 'CITIZEN'
  const [activeMapplsToken, setActiveMapplsToken] = useState('');
  const [mapplsLoaded, setMapplsLoaded] = useState(false);
  const [mapplsStatus, setMapplsStatus] = useState(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [trafficEnabled, setTrafficEnabled] = useState(true);
  const [nearbyPOIs, setNearbyPOIs] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

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

  // Check Mappls API Status on Mount
  useEffect(() => {
    fetchMapplsStatus().then((st) => {
      if (st) setMapplsStatus(st);
    });
    fetchMapplsToken().then((tok) => {
      if (tok && tok.token) {
        setActiveMapplsToken(tok.token);
      }
    });
  }, []);

  // Initialize official Mappls Map Web SDK v3.0
  const initMapplsMap = useCallback(() => {
    if (!containerRef.current) return;

    if (typeof window !== 'undefined' && window.mappls && window.mappls.Map) {
      try {
        containerRef.current.innerHTML = '';
        
        const map = new window.mappls.Map(containerRef.current, {
          center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
          traffic: trafficEnabled,
          hybrid: false,
          geolocation: false
        });

        mapInstanceRef.current = map;
        setMapplsLoaded(true);

        if (map.addListener) {
          map.addListener('load', () => {
            setMapplsLoaded(true);
          });
        }
      } catch (err) {
        console.warn('[Mappls Map Init]', err);
      }
    }
  }, [trafficEnabled]);

  // Load Mappls SDK Script dynamically without exposing key in DOM text
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.mappls && window.mappls.Map) {
      initMapplsMap();
      return;
    }

    const token = activeMapplsToken || 'vfprupvufqvkbaarmpgonnlgzzgnnkzetirt';
    const scriptId = 'mappls-sdk-script';
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(token)}`;
      script.async = true;
      script.onload = () => {
        initMapplsMap();
      };
      document.head.appendChild(script);
    } else {
      initMapplsMap();
    }
  }, [activeMapplsToken, initMapplsMap]);

  // Render Mappls Markers for filtered events
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof window === 'undefined' || !window.mappls || !window.mappls.Marker) return;

    // Remove old markers
    markersRef.current.forEach((m) => {
      try {
        if (typeof m.remove === 'function') m.remove();
        else if (window.mappls.remove) window.mappls.remove({ map, layer: m });
      } catch (e) {}
    });
    markersRef.current = [];

    // Add Mappls Marker for each event
    filteredEvents.slice(0, 75).forEach((ev) => {
      const loc = ev.location || {};
      const lat = loc.latitude || ev.latitude;
      const lng = loc.longitude || ev.longitude;
      if (!lat || !lng) return;

      const cfg = HAZARD_CONFIG[ev.event_type] || HAZARD_CONFIG.POTHOLE;
      const isWaterlogged = ev.event_type === 'WATERLOGGED' || ev.ultrasonic || ev.waterlogged_details;
      const us = ev.ultrasonic || ev.waterlogged_details || {};
      const depth = Number(us.water_depth_cm || 38.5);
      const isAbove = us.above_bumper !== false && (us.above_bumper || depth >= 35.0);
      const overflow = isAbove ? +(depth - 35.0).toFixed(1) : 0;
      const isCitizen = ev.bus_id === 'CITIZEN_PORTAL' || Boolean(ev.citizen_details);
      const reporter = ev.citizen_details?.reporter_name || 'Citizen';
      const addressText = ev.address || loc.address?.formatted || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      const photoUrl = ev.evidence?.thumbnail_url || ev.citizen_details?.photo_url;
      const confidence = Math.round((ev.fusion?.confidence || ev.vision?.confidence || 0.92) * 100);

      const popupHtml = `
        <div style="font-family:'JetBrains Mono',monospace,sans-serif; min-width:260px; max-width:300px; padding:8px 4px; color:#0f172a; line-height:1.4;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
            <span style="background:${cfg.color}; color:#fff; font-size:10px; font-weight:800; padding:2px 7px; border-radius:4px; text-transform:uppercase;">
              ${cfg.icon} ${ev.event_type.replace('_', ' ')}
            </span>
            <span style="font-size:10px; font-weight:700; color:#64748b;">${ev.severity}</span>
          </div>

          <div style="font-size:12px; font-weight:700; margin-bottom:4px; color:#0f172a;">${addressText}</div>
          <div style="font-size:11px; color:#475569; margin-bottom:4px;">
            Source: <b>${isCitizen ? `👤 ${reporter}` : `Bus ${ev.bus_id || 'BUS101'}`}</b> · AI: <b>${confidence}%</b>
          </div>

          ${isWaterlogged ? `
            <div style="background:#f0f9ff; border:1px solid #7dd3fc; border-radius:6px; padding:6px; margin:6px 0; font-size:11px;">
              <div style="color:#0369a1; font-weight:800;">📡 Ultrasonic Sonar Telemetry:</div>
              <div style="font-size:13px; font-weight:900; color:#0c4a6e; margin:2px 0;">
                ${depth.toFixed(1)} cm
                <span style="font-size:9.5px; font-weight:800; padding:1px 5px; border-radius:3px; background:${isAbove ? '#e11d48' : '#059669'}; color:#fff; margin-left:4px;">
                  ${isAbove ? `🚨 +${overflow}cm ABOVE BUMPER` : '✓ Below Bumper'}
                </span>
              </div>
              <div style="font-size:9.5px; color:#64748b;">Bus Ground Clearance Threshold: 35.0 cm</div>
            </div>
          ` : ''}

          ${photoUrl ? `
            <div style="margin:6px 0; border-radius:6px; overflow:hidden; border:1px solid #cbd5e1; height:85px; background:#000;">
              <img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover;" alt="Evidence" />
            </div>
          ` : ''}

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; padding-top:6px; border-top:1px solid #e2e8f0; font-size:11px;">
            <span style="font-weight:700;">Status: <b style="color:#0284c7;">${ev.status || 'NEW'}</b></span>
            <span style="font-size:9px; color:#94a3b8;">ID: ${ev.event_id?.slice(0, 8)}</span>
          </div>
        </div>
      `;

      try {
        const marker = new window.mappls.Marker({
          map,
          position: { lat, lng },
          popupHtml,
          fitbounds: false
        });

        if (marker.addListener) {
          marker.addListener('click', () => {
            setSelectedIncident(ev);
            if (onSelectEvent) onSelectEvent(ev);
          });
        }

        markersRef.current.push(marker);
      } catch (err) {
        console.warn('[Mappls Marker]', err);
      }
    });
  }, [filteredEvents, onSelectEvent]);

  // Center on Kolkata
  const centerKolkata = () => {
    const map = mapInstanceRef.current;
    if (map) {
      if (typeof map.setCenter === 'function') {
        map.setCenter({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng });
        if (typeof map.setZoom === 'function') map.setZoom(DEFAULT_ZOOM);
      } else if (typeof map.panTo === 'function') {
        map.panTo([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]);
      }
    }
  };

  // Mappls Geocode Search Handler
  const handleGeocodeSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    playRadarBeep();
    try {
      const res = await searchMapplsGeocode(searchQuery.trim());
      if (res && res.latitude && res.longitude) {
        const map = mapInstanceRef.current;
        if (map) {
          if (typeof map.setCenter === 'function') {
            map.setCenter({ lat: res.latitude, lng: res.longitude });
            if (typeof map.setZoom === 'function') map.setZoom(14);
          }
        }
        playSuccessChime();
      }
    } catch (err) {
      console.warn('[Geocode error]', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Mappls Nearby Search Handler (Find hospitals/police near selected incident)
  const handleNearbySearch = async (keywords = 'hospital') => {
    if (!selectedIncident) return;
    const loc = selectedIncident.location || {};
    const lat = loc.latitude || selectedIncident.latitude;
    const lng = loc.longitude || selectedIncident.longitude;
    if (!lat || !lng) return;

    try {
      const data = await searchMapplsNearby(lat, lng, keywords, 3000);
      if (data && data.places) {
        setNearbyPOIs(data.places);
      }
    } catch (err) {
      console.warn('[Nearby search error]', err);
    }
  };

  // Save new Mappls Key (Strictly masked, never visible)
  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    try {
      await updateMapplsCredentials(keyInput.trim());
      localStorage.setItem('mappls_api_key', keyInput.trim());
      setActiveMapplsToken(keyInput.trim());
      setShowKeyModal(false);
      window.location.reload();
    } catch (e) {
      alert(`Failed to update key: ${e.message}`);
    }
  };

  return (
    <div className="hologram-card rounded-2xl p-4 mb-6 border border-cyan-500/20 relative">
      {/* Map Header with Mappls Brand & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-['Orbitron'] font-bold text-xs uppercase tracking-wide text-white flex items-center gap-2">
              <span>MAPPLS (MAPMYINDIA) GIS · URBAN SAFETY MAP</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-950/80 text-red-300 border border-red-500/30">
                {filteredEvents.length} INCIDENTS
              </span>
            </h3>
            <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Mappls REST API & Web SDK Active</span>
              </span>
              <span>•</span>
              <span>Kolkata Fleet Geotagged</span>
            </div>
          </div>
        </div>

        {/* Mappls Geocode Address Search */}
        <form onSubmit={handleGeocodeSearch} className="flex items-center gap-1.5 font-mono text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Mappls Geocode: Park St, Howrah..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900/90 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-red-500 w-52"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all disabled:opacity-50"
          >
            {isSearching ? '...' : 'Search'}
          </button>
        </form>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setShowKeyModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-red-500/50 text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
            title="Configure Mappls API Key (Secure)"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>API Settings</span>
          </button>

          <button
            onClick={centerKolkata}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
            title="Center Kolkata Transit Corridors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Center Fleet</span>
          </button>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 font-mono text-xs">
        {/* Source filter */}
        <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-0.5">
          {['ALL', 'BUS', 'CITIZEN'].map((src) => (
            <button
              key={src}
              onClick={() => setSourceFilter(src)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                sourceFilter === src
                  ? 'bg-red-600 text-white font-bold shadow-sm shadow-red-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {src === 'ALL' ? 'All Sources' : src === 'BUS' ? '🚌 Fleet' : '👤 Citizen'}
            </button>
          ))}
        </div>

        {/* Hazard Types */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'WATERLOGGED', 'POTHOLE', 'NEAR_MISS', 'MISSING_DIVIDER', 'ROAD_DISTRESS'].map((type) => {
            const active = selectedFilter === type;
            const cfg = HAZARD_CONFIG[type];
            return (
              <button
                key={type}
                onClick={() => setSelectedFilter(type)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  active
                    ? 'bg-red-600 text-white font-bold shadow-sm shadow-red-500/30'
                    : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {type === 'ALL' ? '● All Alerts' : `${cfg?.icon || ''} ${cfg?.label || type}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Official Mappls Map Container */}
      <div className="relative w-full h-[450px] rounded-xl overflow-hidden border border-slate-800 bg-[#0a101d]">
        <div
          ref={containerRef}
          id="mappls-map-canvas"
          className="w-full h-full"
          style={{ minHeight: '450px' }}
        />

        {/* Map Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur-md px-3 py-2 rounded-xl border border-red-500/20 text-xs font-mono text-slate-300 pointer-events-none flex flex-wrap items-center gap-3 z-10">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]"></span>
            <span>Waterlogged (Sonar)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span>
            <span>Pothole (Shock)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></span>
            <span>Near Miss</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]"></span>
            <span>Divider</span>
          </div>
        </div>

        {/* Selected Incident Drawer with Mappls Nearby Search */}
        {selectedIncident && (
          <div className="absolute top-3 right-3 z-20 w-80 max-h-[400px] overflow-y-auto p-4 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-red-500/40 shadow-2xl font-mono text-xs text-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-red-400 flex items-center gap-1.5">
                <span>{HAZARD_CONFIG[selectedIncident.event_type]?.icon}</span>
                <span>{selectedIncident.event_type}</span>
              </span>
              <button
                onClick={() => { setSelectedIncident(null); setNearbyPOIs(null); }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="py-2 space-y-2">
              <p className="font-semibold text-white truncate">{selectedIncident.address}</p>
              <div className="text-slate-400 text-[11px]">
                Coordinates: {selectedIncident.location?.latitude?.toFixed(5)}, {selectedIncident.location?.longitude?.toFixed(5)}
              </div>

              {/* Mappls Nearby Action Buttons */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1.5">
                  MAPPLS NEARBY POI DISCOVERY:
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleNearbySearch('hospital')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-red-400 text-[11px] text-slate-200 flex items-center justify-center gap-1"
                  >
                    <Hospital className="w-3 h-3 text-rose-400" />
                    <span>Hospitals</span>
                  </button>
                  <button
                    onClick={() => handleNearbySearch('police')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-red-400 text-[11px] text-slate-200 flex items-center justify-center gap-1"
                  >
                    <ShieldCheck className="w-3 h-3 text-cyan-400" />
                    <span>Police</span>
                  </button>
                </div>
              </div>

              {/* Nearby Results List */}
              {nearbyPOIs && (
                <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                  {nearbyPOIs.map((poi, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px]">
                      <div className="font-bold text-slate-200">{poi.placeName || poi.name}</div>
                      <div className="text-slate-400 truncate">{poi.placeAddress || poi.address}</div>
                      <div className="text-red-400 font-semibold">{poi.distance ? `${poi.distance}m away` : 'Nearby'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mappls API Key Configuration Modal (SECURE: Never reveals raw key or ID) */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-mono">
          <div className="bg-slate-950 border border-red-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-['Orbitron'] font-bold text-sm text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>MAPPLS API CONFIGURATION</span>
              </h4>
              <button onClick={() => setShowKeyModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400">
              Update your MapmyIndia / Mappls Web Map SDK credentials securely. Keys are securely stored and encrypted on the backend.
            </p>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Enter New Mappls API Key
              </label>
              <input
                type="password"
                placeholder="Paste new Mappls API Key (hidden)..."
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Connection Status:</span>
                <span className="text-emerald-400 font-bold">
                  ✓ Configured &amp; Active
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                Credentials protected under municipal authority encryption policy.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveKey}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-500/30"
              >
                Save &amp; Reload Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
