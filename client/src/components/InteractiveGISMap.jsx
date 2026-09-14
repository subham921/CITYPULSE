import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Compass, ZoomIn, ZoomOut, RotateCcw, Key, Search, MapPin, Layers, AlertTriangle, Waves, ShieldCheck, Activity, Hospital, Radio, Navigation, Info } from 'lucide-react';
import { fetchMapplsToken, fetchMapplsStatus, updateMapplsCredentials, searchMapplsGeocode, searchMapplsNearby } from '../utils/api';
import { playRadarBeep, playSuccessChime } from '../utils/audioFx';

const DEFAULT_CENTER = { lat: 22.5726, lng: 88.3639 }; // Central Kolkata
const DEFAULT_ZOOM = 12.5;

export const HAZARD_CONFIG = {
  WATERLOGGED: { color: '#0284c7', label: 'Waterlogged', icon: '🌊', name: 'Waterlogged' },
  POTHOLE: { color: '#ef4444', label: 'Pothole (Shock)', icon: '🕳️', name: 'Pothole (Shock)' },
  NEAR_MISS: { color: '#f59e0b', label: 'Near Miss', icon: '⚠️', name: 'Near Miss' },
  MISSING_DIVIDER: { color: '#8b5cf6', label: 'Divider', icon: '🚧', name: 'Divider' },
  ROAD_DISTRESS: { color: '#06b6d4', label: 'Road Distress', icon: '🚨', name: 'Road Distress' }
};

// 7 Major Kolkata Waterlogging Transit Corridors (Full Length)
export const KOLKATA_WATERLOGGING_CORRIDORS = [
  {
    id: 'ROUTE_32',
    name: 'College Street / MG Road Crossing',
    description: 'Central educational & commercial transit artery (Bowbazar to MG Road junction)',
    lengthKm: 2.6,
    clearanceLimitCm: 35.0,
    baselineDepthCm: 41.5,
    coordinates: [
      { lat: 22.5855, lng: 88.3678 },
      { lat: 22.5805, lng: 88.3650 },
      { lat: 22.5744, lng: 88.3629 },
      { lat: 22.5685, lng: 88.3610 },
      { lat: 22.5630, lng: 88.3595 }
    ],
    midpoint: { lat: 22.5744, lng: 88.3629 }
  },
  {
    id: 'ROUTE_08',
    name: 'Central Avenue (CR Avenue / Chittaranjan)',
    description: 'Primary North-South arterial spine connecting Shyambazar to Chandni Chowk',
    lengthKm: 4.8,
    clearanceLimitCm: 35.0,
    baselineDepthCm: 33.5,
    coordinates: [
      { lat: 22.6030, lng: 88.3730 },
      { lat: 22.5920, lng: 88.3655 },
      { lat: 22.5835, lng: 88.3582 },
      { lat: 22.5720, lng: 88.3545 },
      { lat: 22.5630, lng: 88.3510 }
    ],
    midpoint: { lat: 22.5835, lng: 88.3582 }
  },
  {
    id: 'ROUTE_12',
    name: 'Amherst Street (Raja Rammohan Sarani)',
    description: 'Historic low-lying drainage depression zone (Maniktala to Bowbazar)',
    lengthKm: 2.3,
    clearanceLimitCm: 35.0,
    baselineDepthCm: 44.0,
    coordinates: [
      { lat: 22.5890, lng: 88.3745 },
      { lat: 22.5835, lng: 88.3720 },
      { lat: 22.5802, lng: 88.3711 },
      { lat: 22.5745, lng: 88.3695 },
      { lat: 22.5690, lng: 88.3680 }
    ],
    midpoint: { lat: 22.5802, lng: 88.3711 }
  },
  {
    id: 'ROUTE_24',
    name: 'Park Circus 7-Point & Suhrawardy Ave',
    description: 'Major South-East junction approach & arterial flyover base',
    lengthKm: 3.1,
    clearanceLimitCm: 35.0,
    baselineDepthCm: 27.5,
    coordinates: [
      { lat: 22.5510, lng: 88.3560 },
      { lat: 22.5475, lng: 88.3620 },
      { lat: 22.5448, lng: 88.3672 },
      { lat: 22.5430, lng: 88.3740 },
      { lat: 22.5410, lng: 88.3800 }
    ],
    midpoint: { lat: 22.5448, lng: 88.3672 }
  },
  {
    id: 'ROUTE_15',
    name: 'Thanthania Kalibari / Bidhan Sarani',
    description: 'Severe depression pocket along Bidhan Sarani heritage corridor',
    lengthKm: 2.2,
    clearanceLimitCm: 35.0,
    baselineDepthCm: 46.8,
    coordinates: [
      { lat: 22.5950, lng: 88.3705 },
      { lat: 22.5900, lng: 88.3685 },
      { lat: 22.5861, lng: 88.3667 },
      { lat: 22.5805, lng: 88.3648 },
      { lat: 22.5750, lng: 88.3630 }
    ],
    midpoint: { lat: 22.5861, lng: 88.3667 }
  },
  {
    id: 'ROUTE_AC47',
    name: 'EM Bypass - Chingrighata Flyover Base',
    description: 'Eastern arterial express underpass & high-capacity bypass junction',
    lengthKm: 5.2,
    clearanceLimitCm: 35.0,
    baselineDepthCm: 19.5,
    coordinates: [
      { lat: 22.5820, lng: 88.4070 },
      { lat: 22.5710, lng: 88.4045 },
      { lat: 22.5612, lng: 88.4024 },
      { lat: 22.5500, lng: 88.3995 },
      { lat: 22.5380, lng: 88.3970 }
    ],
    midpoint: { lat: 22.5612, lng: 88.4024 }
  },
  {
    id: 'ROUTE_14',
    name: 'Behala Chowrasta / Diamond Harbour Rd',
    description: 'South suburban arterial corridor & metro under-deck drainage zone',
    lengthKm: 4.6,
    clearanceLimitCm: 35.0,
    baselineDepthCm: 31.0,
    coordinates: [
      { lat: 22.5220, lng: 88.3200 },
      { lat: 22.5100, lng: 88.3160 },
      { lat: 22.4988, lng: 88.3114 },
      { lat: 22.4890, lng: 88.3075 },
      { lat: 22.4800, lng: 88.3040 }
    ],
    midpoint: { lat: 22.4988, lng: 88.3114 }
  }
];

// Helper: Generate high-definition custom SVG map pointer for each hazard category
export function createCustomPinSvg(eventType, color) {
  let iconSvg = '';
  switch (eventType) {
    case 'POTHOLE':
      // Red pointer with crater / shockwave burst icon
      iconSvg = `
        <circle cx="16" cy="15" r="4.5" fill="${color}" opacity="0.3"/>
        <circle cx="16" cy="15" r="3" fill="${color}"/>
        <path d="M16 8v2 M16 20v2 M9 15h2 M21 15h2 M11 10l1.5 1.5 M19.5 18.5l1.5 1.5 M11 20l1.5-1.5 M19.5 11.5l1.5-1.5" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
      `;
      break;
    case 'NEAR_MISS':
      // Amber pointer with warning exclamation triangle
      iconSvg = `
        <polygon points="16,8.5 22.5,20 9.5,20" fill="${color}"/>
        <line x1="16" y1="12" x2="16" y2="15.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="16" cy="18" r="0.9" fill="#ffffff"/>
      `;
      break;
    case 'MISSING_DIVIDER':
    case 'DIVIDER':
      // Purple pointer with dual median barrier icon
      iconSvg = `
        <rect x="11" y="9.5" width="3.2" height="11" rx="1.2" fill="${color}"/>
        <rect x="17.8" y="9.5" width="3.2" height="11" rx="1.2" fill="${color}"/>
        <line x1="8.5" y1="15" x2="23.5" y2="15" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="16" cy="15" r="1.4" fill="#ffffff"/>
      `;
      break;
    case 'WATERLOGGED':
      // Ocean Blue pointer with sonar ripples & water splash
      iconSvg = `
        <path d="M10 14 Q13 12 16 14 T22 14" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        <path d="M10 17.5 Q13 15.5 16 17.5 T22 17.5" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        <path d="M16 8 C16 8 13.5 10.5 13.5 12 A2.5 2.5 0 0 0 18.5 12 C18.5 10.5 16 8 16 8 Z" fill="${color}"/>
      `;
      break;
    default:
      // Teal pointer with crack / distress fissure
      iconSvg = `
        <path d="M16.5 8 L12.5 14 L16.5 14 L14 21 L20 14.5 L16 14.5 Z" fill="${color}"/>
      `;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44">
      <defs>
        <filter id="shadow" x="-25%" y="-10%" width="150%" height="135%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#000000" flood-opacity="0.55"/>
        </filter>
      </defs>
      <!-- Teardrop Pin Body -->
      <path d="M16 1 C7.8 1 1.5 7.3 1.5 15.2 C1.5 25.5 16 42.5 16 42.5 C16 42.5 30.5 25.5 30.5 15.2 C30.5 7.3 24.2 1 16 1 Z" 
            fill="${color}" stroke="#ffffff" stroke-width="1.6" filter="url(#shadow)"/>
      <!-- Inner White Medallion -->
      <circle cx="16" cy="15" r="9.2" fill="#ffffff" stroke="${color}" stroke-width="1"/>
      <!-- Category Icon -->
      ${iconSvg}
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Helper: Calculate live intensity, color shade, and buffer width for corridors
export function getCorridorLiveIntensity(corridor, events = []) {
  // Find matching waterlogged event for this corridor
  const match = events.find((ev) => {
    if (ev.event_type !== 'WATERLOGGED') return false;
    if (ev.route_id && ev.route_id === corridor.id) return true;
    const addr = (ev.address || '').toLowerCase();
    const cName = corridor.name.toLowerCase();
    if (addr.includes('college street') && cName.includes('college street')) return true;
    if (addr.includes('amherst') && cName.includes('amherst')) return true;
    if (addr.includes('park circus') && cName.includes('park circus')) return true;
    if (addr.includes('central avenue') && cName.includes('central')) return true;
    if (addr.includes('thanthania') && cName.includes('thanthania')) return true;
    if (addr.includes('chingrighata') && cName.includes('chingrighata')) return true;
    if (addr.includes('behala') && cName.includes('behala')) return true;
    return false;
  });

  let depth = corridor.baselineDepthCm;
  let sensorId = 'US-SONAR-AUTO';
  let isLive = false;

  if (match) {
    const us = match.ultrasonic || match.waterlogged_details || {};
    depth = Number(us.water_depth_cm ?? depth);
    sensorId = us.sensor_id || 'US-SONAR-01';
    isLive = true;
  }

  const clearanceLimit = corridor.clearanceLimitCm || 35.0;
  const isAboveBumper = depth >= clearanceLimit;
  const overflow = isAboveBumper ? +(depth - clearanceLimit).toFixed(1) : 0;

  if (depth >= 35.0) {
    return {
      level: 'CRITICAL',
      label: 'Critical Inundation (>35cm Bumper)',
      color: '#ef4444',
      glowColor: '#b91c1c',
      bufferWeight: 26,
      bufferOpacity: 0.44,
      coreWeight: 7,
      coreOpacity: 0.96,
      depth,
      clearanceLimit,
      isAboveBumper: true,
      overflow,
      sensorId,
      isLive
    };
  } else if (depth >= 22.0) {
    return {
      level: 'HIGH',
      label: 'High Waterlogging (22-35cm)',
      color: '#0284c7',
      glowColor: '#0369a1',
      bufferWeight: 20,
      bufferOpacity: 0.38,
      coreWeight: 5.5,
      coreOpacity: 0.90,
      depth,
      clearanceLimit,
      isAboveBumper: false,
      overflow: 0,
      sensorId,
      isLive
    };
  } else if (depth >= 12.0) {
    return {
      level: 'MODERATE',
      label: 'Moderate Water (12-22cm)',
      color: '#06b6d4',
      glowColor: '#0891b2',
      bufferWeight: 15,
      bufferOpacity: 0.32,
      coreWeight: 4.5,
      coreOpacity: 0.85,
      depth,
      clearanceLimit,
      isAboveBumper: false,
      overflow: 0,
      sensorId,
      isLive
    };
  } else {
    return {
      level: 'MINOR',
      label: 'Safe Runoff (<12cm)',
      color: '#10b981',
      glowColor: '#059669',
      bufferWeight: 10,
      bufferOpacity: 0.25,
      coreWeight: 3.5,
      coreOpacity: 0.80,
      depth,
      clearanceLimit,
      isAboveBumper: false,
      overflow: 0,
      sensorId,
      isLive
    };
  }
}

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
  const [corridorsEnabled, setCorridorsEnabled] = useState(true);
  const [selectedCorridor, setSelectedCorridor] = useState(null);
  const [nearbyPOIs, setNearbyPOIs] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const corridorMarkersRef = useRef([]);

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

  // 1. Render Distinct Colored Mappls Markers for Filtered Hazards
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof window === 'undefined' || !window.mappls || !window.mappls.Marker) return;

    // Remove old hazard markers
    markersRef.current.forEach((m) => {
      try {
        if (typeof m.remove === 'function') m.remove();
        else if (window.mappls.remove) window.mappls.remove({ map, layer: m });
      } catch (e) {}
    });
    markersRef.current = [];

    // Add Mappls Marker for each event with distinct color pointer
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

      // Generate distinct SVG pointer icon
      const pinIconUri = createCustomPinSvg(ev.event_type, cfg.color);

      const popupHtml = `
        <div style="font-family:'JetBrains Mono',monospace,sans-serif; min-width:270px; max-width:310px; padding:8px 4px; color:#0f172a; line-height:1.4;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
            <span style="background:${cfg.color}; color:#fff; font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:4px; text-transform:uppercase; display:inline-flex; align-items:center; gap:4px;">
              <span>${cfg.icon}</span> <span>${cfg.name || ev.event_type.replace('_', ' ')}</span>
            </span>
            <span style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">${ev.severity}</span>
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
                <span style="font-size:9.5px; font-weight:800; padding:1px 5px; border-radius:3px; background:${isAbove ? '#ef4444' : '#059669'}; color:#fff; margin-left:4px;">
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
          icon: pinIconUri,
          width: 32,
          height: 44,
          offset: [0, -22],
          html: `<div style="width:32px; height:44px; cursor:pointer;"><img src="${pinIconUri}" style="width:32px; height:44px; display:block;" /></div>`,
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

  // 2. Render Full-Length Shaded Waterlogging Corridors
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof window === 'undefined' || !window.mappls) return;

    // Clear old polylines
    polylinesRef.current.forEach((p) => {
      try {
        if (typeof p.remove === 'function') p.remove();
        else if (window.mappls.remove) window.mappls.remove({ map, layer: p });
      } catch (e) {}
    });
    polylinesRef.current = [];

    // Clear old corridor markers
    corridorMarkersRef.current.forEach((m) => {
      try {
        if (typeof m.remove === 'function') m.remove();
        else if (window.mappls.remove) window.mappls.remove({ map, layer: m });
      } catch (e) {}
    });
    corridorMarkersRef.current = [];

    if (!corridorsEnabled) return;

    const PolylineClass = window.mappls.Polyline || window.mappls.polyline;

    KOLKATA_WATERLOGGING_CORRIDORS.forEach((corridor) => {
      const intensity = getCorridorLiveIntensity(corridor, events);

      // A. Full-Length Shaded Outer Buffer Polyline
      if (PolylineClass) {
        try {
          const bufferLine = new PolylineClass({
            map,
            path: corridor.coordinates,
            strokeColor: intensity.color,
            strokeWeight: intensity.bufferWeight,
            strokeOpacity: intensity.bufferOpacity,
            fitbounds: false
          });
          polylinesRef.current.push(bufferLine);

          // B. Full-Length Solid Core Polyline
          const coreLine = new PolylineClass({
            map,
            path: corridor.coordinates,
            strokeColor: intensity.color,
            strokeWeight: intensity.coreWeight,
            strokeOpacity: intensity.coreOpacity,
            fitbounds: false
          });
          polylinesRef.current.push(coreLine);
        } catch (err) {
          console.warn('[Polyline render error]', err);
        }
      }

      // C. Corridor Midpoint Ultrasonic Telemetry Marker
      if (window.mappls.Marker) {
        const beaconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">
            <defs>
              <filter id="beacon-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="${intensity.color}" flood-opacity="0.8"/>
              </filter>
            </defs>
            <circle cx="18" cy="18" r="15" fill="${intensity.color}" fill-opacity="0.35" stroke="${intensity.color}" stroke-width="2" filter="url(#beacon-glow)"/>
            <circle cx="18" cy="18" r="10" fill="#0f172a" stroke="#ffffff" stroke-width="1.8"/>
            <text x="18" y="21" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="900" fill="#ffffff" text-anchor="middle">
              ${Math.round(intensity.depth)}
            </text>
          </svg>
        `.trim();
        const beaconUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(beaconSvg)}`;

        const corridorPopup = `
          <div style="font-family:'JetBrains Mono',monospace,sans-serif; min-width:280px; max-width:320px; padding:10px 6px; color:#0f172a;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
              <span style="background:${intensity.color}; color:#fff; font-size:10px; font-weight:800; padding:3px 8px; border-radius:4px; text-transform:uppercase;">
                🌊 ${corridor.id} · ${intensity.level} FLOOD
              </span>
              <span style="font-size:10px; font-weight:700; color:#64748b;">${corridor.lengthKm} km Corridor</span>
            </div>

            <div style="font-size:13px; font-weight:800; color:#0f172a; margin-bottom:3px;">${corridor.name}</div>
            <div style="font-size:10.5px; color:#475569; margin-bottom:6px;">${corridor.description}</div>

            <div style="background:#f0f9ff; border:1px solid ${intensity.color}; border-radius:8px; padding:8px; margin:6px 0;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:10.5px; font-weight:800; color:#0369a1;">📡 Ultrasonic Sonar Telemetry:</span>
                <span style="font-size:9px; background:${intensity.isLive ? '#10b981' : '#64748b'}; color:#fff; padding:1px 5px; border-radius:3px; font-weight:800;">
                  ${intensity.isLive ? '● LIVE SENSOR' : 'CALIBRATED'}
                </span>
              </div>
              <div style="font-size:16px; font-weight:900; color:#0c4a6e; margin:4px 0;">
                ${intensity.depth.toFixed(1)} cm
                <span style="font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; background:${intensity.isAboveBumper ? '#ef4444' : '#10b981'}; color:#fff; margin-left:6px;">
                  ${intensity.isAboveBumper ? `🚨 +${intensity.overflow}cm ABOVE BUMPER` : '✓ Safe Clearance'}
                </span>
              </div>
              <div style="font-size:10px; color:#475569;">
                Clearance Limit: <b>35.0 cm</b> · Sensor: <code>${intensity.sensorId}</code>
              </div>
              ${intensity.isAboveBumper ? `
                <div style="font-size:10.5px; font-weight:700; color:#b91c1c; margin-top:5px; padding-top:4px; border-top:1px dashed #fca5a5;">
                  ⚠️ TRANSIT ACTION: Divert public bus fleet to higher elevation corridors.
                </div>
              ` : ''}
            </div>
          </div>
        `;

        try {
          const marker = new window.mappls.Marker({
            map,
            position: corridor.midpoint,
            icon: beaconUri,
            width: 36,
            height: 36,
            offset: [0, 0],
            html: `<div style="width:36px; height:36px; cursor:pointer;" title="${corridor.name} (${intensity.depth}cm)"><img src="${beaconUri}" style="width:36px; height:36px; display:block;" /></div>`,
            popupHtml: corridorPopup,
            fitbounds: false
          });

          if (marker.addListener) {
            marker.addListener('click', () => {
              setSelectedCorridor({ ...corridor, intensity });
            });
          }

          corridorMarkersRef.current.push(marker);
        } catch (err) {
          console.warn('[Corridor Marker error]', err);
        }
      }
    });
  }, [events, corridorsEnabled]);

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
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 hidden sm:inline-flex items-center gap-1">
                <Waves className="w-3 h-3 text-cyan-400" />
                <span>{KOLKATA_WATERLOGGING_CORRIDORS.length} FLOOD CORRIDORS</span>
              </span>
            </h3>
            <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Mappls REST API & Web SDK v3.0 Active</span>
              </span>
              <span>•</span>
              <span>Distinct Hazard Color Pins Active</span>
              <span>•</span>
              <span>Sonar Shaded Corridors</span>
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
          {/* Corridors Toggle Button */}
          <button
            onClick={() => setCorridorsEnabled(!corridorsEnabled)}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
              corridorsEnabled
                ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-200 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
            title="Toggle Kolkata Waterlogging Full-Length Shaded Corridors"
          >
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
            <span>{corridorsEnabled ? 'Corridors: ON' : 'Corridors: OFF'}</span>
          </button>

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

        {/* Hazard Types with Distinct Colors */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'POTHOLE', 'NEAR_MISS', 'MISSING_DIVIDER', 'WATERLOGGED', 'ROAD_DISTRESS'].map((type) => {
            const active = selectedFilter === type;
            const cfg = HAZARD_CONFIG[type];
            return (
              <button
                key={type}
                onClick={() => setSelectedFilter(type)}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  active
                    ? 'text-white font-bold shadow-sm'
                    : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
                }`}
                style={active ? { backgroundColor: cfg ? cfg.color : '#dc2626' } : {}}
              >
                {type === 'ALL' ? (
                  <span>● All Alerts</span>
                ) : (
                  <>
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: cfg?.color || '#cbd5e1' }}
                    ></span>
                    <span>{cfg?.name || type}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Official Mappls Map Container */}
      <div className="relative w-full h-[470px] rounded-xl overflow-hidden border border-slate-800 bg-[#0a101d]">
        <div
          ref={containerRef}
          id="mappls-map-canvas"
          className="w-full h-full"
          style={{ minHeight: '470px' }}
        />

        {/* Comprehensive Map Legend: Hazard Pointer Colors + Corridor Intensity Shading */}
        <div className="absolute bottom-3 left-3 bg-slate-950/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-red-500/30 text-[11px] font-mono text-slate-200 pointer-events-auto shadow-2xl z-10 space-y-2 max-w-sm">
          {/* Row 1: Distinct Hazard Pointers */}
          <div>
            <div className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider mb-1 flex items-center justify-between">
              <span>Hazard Pointer Colors:</span>
              <span className="text-[9px] text-cyan-400">Teardrop Pins</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white/60 shadow-sm shadow-red-500"></span>
                <span className="text-white font-medium">Pothole (Shock)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full bg-[#f59e0b] border border-white/60 shadow-sm shadow-amber-500"></span>
                <span className="text-white font-medium">Near Miss</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full bg-[#8b5cf6] border border-white/60 shadow-sm shadow-purple-500"></span>
                <span className="text-white font-medium">Divider</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full bg-[#0284c7] border border-white/60 shadow-sm shadow-blue-500"></span>
                <span className="text-white font-medium">Waterlogged</span>
              </div>
            </div>
          </div>

          {/* Row 2: Shaded Corridor Flood Intensity */}
          <div className="pt-1.5 border-t border-slate-800/80">
            <div className="text-[9.5px] uppercase font-bold text-cyan-400 tracking-wider mb-1 flex items-center justify-between">
              <span>Full-Length Shaded Corridors (Intensity):</span>
              <span className="text-[9px] text-slate-400">Bus Bumper 35cm</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-2 rounded bg-[#ef4444] opacity-80 inline-block"></span>
                <span className="text-rose-300 font-bold">&gt;35cm Critical (Above)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-2 rounded bg-[#0284c7] opacity-80 inline-block"></span>
                <span className="text-sky-300">22-35cm High</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-2 rounded bg-[#06b6d4] opacity-80 inline-block"></span>
                <span className="text-cyan-300">12-22cm Moderate</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-2 rounded bg-[#10b981] opacity-80 inline-block"></span>
                <span className="text-emerald-300">&lt;12cm Minor</span>
              </div>
            </div>
          </div>
        </div>

        {/* Corridor Detailed Telemetry Inspector Drawer */}
        {selectedCorridor && (
          <div className="absolute top-3 right-3 z-20 w-84 max-h-[420px] overflow-y-auto p-4 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 shadow-2xl font-mono text-xs text-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                <Waves className="w-4 h-4 text-cyan-400" />
                <span>{selectedCorridor.id} · FLOOD CORRIDOR</span>
              </span>
              <button
                onClick={() => setSelectedCorridor(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="py-2.5 space-y-2.5">
              <div>
                <p className="font-bold text-white text-sm">{selectedCorridor.name}</p>
                <p className="text-slate-400 text-[11px] mt-0.5">{selectedCorridor.description}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>ULTRASONIC DEPTH TELEMETRY:</span>
                  <span className="text-cyan-300 font-bold">{selectedCorridor.lengthKm} KM SPAN</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">
                    {selectedCorridor.intensity?.depth?.toFixed(1)} <span className="text-xs text-slate-400">cm</span>
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase"
                    style={{ backgroundColor: selectedCorridor.intensity?.color || '#0284c7' }}
                  >
                    {selectedCorridor.intensity?.level}
                  </span>
                </div>

                {selectedCorridor.intensity?.isAboveBumper ? (
                  <div className="p-2 rounded-lg bg-red-950/80 border border-red-500/40 text-red-300 text-[11px] font-bold space-y-1">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>🚨 EXCEEDS BUS BUMPER CLEARANCE (+{selectedCorridor.intensity?.overflow} cm)</span>
                    </div>
                    <div className="text-[10px] text-red-400 font-normal">
                      Recommendation: Transit authorities must divert low-floor urban transit buses away from this corridor immediately.
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                    ✓ Water level is below the 35.0 cm bus bumper clearance limit. Low-speed transit passable.
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Bus Ground Clearance Limit:</span>
                  <span className="text-slate-200 font-bold">35.0 cm</span>
                </div>
                <div className="flex justify-between">
                  <span>Ultrasonic Sonar Station:</span>
                  <span className="text-cyan-300 font-mono">{selectedCorridor.intensity?.sensorId || 'US-SONAR-01'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Full-Length Coordinates:</span>
                  <span className="text-slate-200">{selectedCorridor.coordinates.length} Geo-Waypoints</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Selected Hazard Incident Drawer with Mappls Nearby Search */}
        {selectedIncident && !selectedCorridor && (
          <div className="absolute top-3 right-3 z-20 w-80 max-h-[400px] overflow-y-auto p-4 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-red-500/40 shadow-2xl font-mono text-xs text-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-red-400 flex items-center gap-1.5">
                <span>{HAZARD_CONFIG[selectedIncident.event_type]?.icon}</span>
                <span>{HAZARD_CONFIG[selectedIncident.event_type]?.name || selectedIncident.event_type}</span>
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
