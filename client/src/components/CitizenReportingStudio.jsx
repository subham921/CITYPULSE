import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigation, Camera, AlertTriangle, Waves, Cpu, CheckCircle2, Shield, MapPin, Send, User, FileText, Search, RotateCcw, Crosshair } from 'lucide-react';
import confetti from 'canvas-confetti';
import { submitCitizenReport, uploadEvidencePhoto, fetchMapplsToken, searchMapplsGeocode, reverseGeocodeMappls } from '../utils/api';
import { playSuccessChime, playRadarBeep } from '../utils/audioFx';
import { createCustomPinSvg, HAZARD_CONFIG } from './InteractiveGISMap';

const HAZARD_TYPES = [
  { id: 'POTHOLE', label: 'Pothole (Shock)', desc: 'Cavity on asphalt road surface', icon: '🕳️' },
  { id: 'WATERLOGGED', label: 'Waterlogged / Flood', desc: 'Submerged street, high flood risk', icon: '🌊' },
  { id: 'NEAR_MISS', label: 'Near Miss / Danger', desc: 'Blind curve, pedestrian risk', icon: '⚠️' },
  { id: 'MISSING_DIVIDER', label: 'Missing Divider', desc: 'Broken median / missing guard rail', icon: '🚧' },
  { id: 'ROAD_DISTRESS', label: 'Road Distress', desc: 'Uneven pavement, asphalt fissures', icon: '🚨' }
];

const QUICK_HOTSPOTS = [
  { name: 'College Street / MG Rd', lat: 22.5744, lng: 88.3629 },
  { name: 'Park Street', lat: 22.5535, lng: 88.3524 },
  { name: 'EM Bypass (Chingrighata)', lat: 22.5612, lng: 88.4024 },
  { name: 'Salt Lake Sector V', lat: 22.5735, lng: 88.4331 },
  { name: 'Howrah Bridge Approach', lat: 22.5850, lng: 88.3468 },
  { name: 'Behala Chowrasta', lat: 22.4988, lng: 88.3114 }
];

const PRESET_OBSERVATIONS = [
  '+ Deep crater on bus lane',
  '+ Water level submerged >35cm',
  '+ Severe vehicle bumper scrape',
  '+ Water accumulated after rain',
  '+ Divider gap causing wrong-way traffic'
];

export default function CitizenReportingStudio({ onReportSubmitted, onToast }) {
  const [selectedType, setSelectedType] = useState('WATERLOGGED');
  const [severity, setSeverity] = useState('SEVERE');
  const [latitude, setLatitude] = useState(22.5744);
  const [longitude, setLongitude] = useState(88.3629);
  const [address, setAddress] = useState('College Street / MG Road Crossing, Kolkata');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('Civic Contributor');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState(null);

  // Map state
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [locationLocked, setLocationLocked] = useState(true);

  // Initialize Mappls Map for Citizen Location Picker
  const initCitizenMap = useCallback(() => {
    if (!mapContainerRef.current) return;
    if (typeof window === 'undefined' || !window.mappls || !window.mappls.Map) return;

    try {
      mapContainerRef.current.innerHTML = '';
      const map = new window.mappls.Map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 14,
        zoomControl: true,
        traffic: false,
        hybrid: false,
        geolocation: false
      });

      mapInstanceRef.current = map;
      setMapLoaded(true);

      // Add click listener on map to let citizen click to confirm exact location
      if (map.addListener) {
        map.addListener('click', async (e) => {
          const lat = e.lngLat?.lat || e.latlng?.lat || (e.lat && typeof e.lat === 'number' ? e.lat : null);
          const lng = e.lngLat?.lng || e.latlng?.lng || (e.lng && typeof e.lng === 'number' ? e.lng : null);
          if (!lat || !lng) return;

          setLatitude(lat);
          setLongitude(lng);
          setLocationLocked(true);
          playRadarBeep();

          // Reverse geocode to get street name
          try {
            const rev = await reverseGeocodeMappls(lat, lng);
            if (rev && rev.formatted) {
              setAddress(rev.formatted);
            } else {
              setAddress(`Pinned Spot (${lat.toFixed(5)}, ${lng.toFixed(5)}), Kolkata`);
            }
          } catch (err) {
            setAddress(`Pinned Spot (${lat.toFixed(5)}, ${lng.toFixed(5)}), Kolkata`);
          }

          if (onToast) onToast(`📍 Location pinned at ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'info');
        });
      }
    } catch (err) {
      console.warn('[Citizen Map Init Error]', err);
    }
  }, [latitude, longitude, onToast]);

  // Load Mappls SDK if not already loaded
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.mappls && window.mappls.Map) {
      initCitizenMap();
      return;
    }

    fetchMapplsToken().then((tok) => {
      const token = tok?.token || 'vfprupvufqvkbaarmpgonnlgzzgnnkzetirt';
      const scriptId = 'mappls-sdk-script';
      let script = document.getElementById(scriptId);
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(token)}`;
        script.async = true;
        script.onload = () => initCitizenMap();
        document.head.appendChild(script);
      } else {
        initCitizenMap();
      }
    });
  }, [initCitizenMap]);

  // Update Pin on Map whenever coordinates or hazard type changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof window === 'undefined' || !window.mappls || !window.mappls.Marker) return;

    // Remove old pin
    if (markerRef.current) {
      try {
        if (typeof markerRef.current.remove === 'function') markerRef.current.remove();
        else if (window.mappls.remove) window.mappls.remove({ map, layer: markerRef.current });
      } catch (e) {}
      markerRef.current = null;
    }

    const cfg = HAZARD_CONFIG[selectedType] || HAZARD_CONFIG.POTHOLE;
    const pinUri = createCustomPinSvg(selectedType, cfg.color);

    const popupHtml = `
      <div style="font-family:'JetBrains Mono',monospace,sans-serif; min-width:220px; padding:6px 2px; color:#0f172a;">
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
          <span style="background:${cfg.color}; color:#fff; font-size:10px; font-weight:800; padding:2px 7px; border-radius:3px;">
            ${cfg.icon} ${cfg.label}
          </span>
          <span style="font-size:9.5px; font-weight:700; color:#059669;">✓ CONFIRMED</span>
        </div>
        <div style="font-size:12px; font-weight:700; color:#0f172a; margin-bottom:2px;">${address}</div>
        <div style="font-size:10px; color:#64748b;">Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}</div>
        <div style="font-size:9.5px; color:#0284c7; margin-top:4px; font-weight:600;">💡 Click anywhere on map to reposition</div>
      </div>
    `;

    try {
      const marker = new window.mappls.Marker({
        map,
        position: { lat: latitude, lng: longitude },
        icon: pinUri,
        width: 34,
        height: 46,
        offset: [0, -23],
        html: `<div style="width:34px; height:46px; cursor:pointer;" title="${address}"><img src="${pinUri}" style="width:34px; height:46px; display:block;" /></div>`,
        popupHtml,
        fitbounds: false
      });

      markerRef.current = marker;
    } catch (err) {
      console.warn('[Citizen Marker Error]', err);
    }
  }, [latitude, longitude, selectedType, address]);

  // Center map on coordinates helper
  const centerMapOn = (lat, lng, zoom = 14.5) => {
    const map = mapInstanceRef.current;
    if (map) {
      if (typeof map.setCenter === 'function') {
        map.setCenter({ lat, lng });
        if (typeof map.setZoom === 'function') map.setZoom(zoom);
      } else if (typeof map.panTo === 'function') {
        map.panTo([lat, lng]);
      }
    }
  };

  // GPS Geolocation Handler
  const handleDetectGPS = () => {
    setIsLocating(true);
    playRadarBeep();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLatitude(lat);
          setLongitude(lng);
          setLocationLocked(true);
          centerMapOn(lat, lng, 15);

          try {
            const rev = await reverseGeocodeMappls(lat, lng);
            if (rev && rev.formatted) {
              setAddress(rev.formatted);
            } else {
              setAddress(`GPS Position (${lat.toFixed(5)}, ${lng.toFixed(5)}), Kolkata`);
            }
          } catch (e) {
            setAddress(`GPS Position (${lat.toFixed(5)}, ${lng.toFixed(5)}), Kolkata`);
          }

          setIsLocating(false);
          playSuccessChime();
          if (onToast) onToast('GPS lock confirmed! Map centered on your location', 'success');
        },
        () => {
          setIsLocating(false);
          if (onToast) onToast('Location permission denied. Please click on the map directly.', 'error');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setIsLocating(false);
    }
  };

  // Mappls Geocode Landmark Search
  const handleMapSearch = async (e) => {
    e.preventDefault();
    if (!mapSearchQuery.trim()) return;
    setIsSearchingMap(true);
    playRadarBeep();
    try {
      const res = await searchMapplsGeocode(mapSearchQuery.trim());
      if (res && res.latitude && res.longitude) {
        setLatitude(res.latitude);
        setLongitude(res.longitude);
        setAddress(res.formatted_address || `${mapSearchQuery.trim()}, Kolkata`);
        setLocationLocked(true);
        centerMapOn(res.latitude, res.longitude, 15);
        playSuccessChime();
        if (onToast) onToast(`Located: ${res.formatted_address || mapSearchQuery}`, 'success');
      } else {
        if (onToast) onToast('No exact landmark match found. Click the map to pinpoint.', 'info');
      }
    } catch (err) {
      if (onToast) onToast(`Geocode search: ${err.message}`, 'error');
    } finally {
      setIsSearchingMap(false);
    }
  };

  // Hotspot Click
  const handleSelectHotspot = (spot) => {
    setLatitude(spot.lat);
    setLongitude(spot.lng);
    setAddress(`${spot.name}, Kolkata`);
    setLocationLocked(true);
    centerMapOn(spot.lat, spot.lng, 14.5);
    playRadarBeep();
  };

  // Photo Upload Handler
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      setPhotoPreview(base64);
      try {
        const res = await uploadEvidencePhoto(base64);
        if (res && res.photo_url) setPhotoUrl(res.photo_url);
      } catch (err) {}
    };
    reader.readAsDataURL(file);
  };

  // Submit Report Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        event_type: selectedType,
        latitude,
        longitude,
        severity,
        description: description || `${selectedType.replace('_', ' ')} confirmed at ${address}`,
        reporter_name: reporterName,
        photo_url: photoUrl
      };

      const res = await submitCitizenReport(payload);
      playSuccessChime();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

      setSubmittedReceipt(res);
      if (onToast) onToast('Hazard report verified, plotted on GIS, and sealed on ledger!', 'success');
      if (onReportSubmitted) onReportSubmitted();
    } catch (err) {
      if (onToast) onToast(`Submission error: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mb-10">
      {/* Hero Banner */}
      <div className="hologram-card rounded-2xl p-6 mb-6 border border-cyan-500/20 text-center relative overflow-hidden">
        <div className="relative z-10">
          <span className="px-3 py-1 rounded-full text-xs font-mono bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 uppercase tracking-widest inline-block mb-2">
            ● Citizen Crowdsourced Safety Network
          </span>
          <h2 className="font-['Orbitron'] font-black text-2xl lg:text-3xl text-white tracking-wide mb-2">
            REPORT ROAD HAZARDS & FLOOD SPOTS
          </h2>
          <p className="text-xs font-mono text-slate-300 max-w-xl mx-auto">
            Directly alert Kolkata Transit Authority dispatchers. Confirm your incident spot with interactive Mappls GIS, GPS, and cryptographic verification.
          </p>
        </div>
      </div>

      {/* Success Receipt Banner */}
      {submittedReceipt && (
        <div className="hologram-card rounded-2xl p-6 mb-6 border border-emerald-500/40 bg-emerald-950/30 text-emerald-200 animate-fadeIn">
          <div className="flex items-center space-x-3 mb-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <h3 className="font-['Orbitron'] font-bold text-base text-white">
              REPORT SEALED &amp; BROADCASTED TO FLEET
            </h3>
          </div>
          <p className="text-xs font-mono text-slate-300">
            Incident ID: <span className="text-cyan-300 font-bold">{submittedReceipt.event_id}</span>
          </p>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Plotted on municipal GIS command map and sealed on cryptographic ledger block with immutable SHA-256 tamper-proof signature.
          </p>
          <button
            onClick={() => setSubmittedReceipt(null)}
            className="mt-3 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-mono font-bold hover:bg-emerald-500 transition-all"
          >
            Submit Another Report
          </button>
        </div>
      )}

      {/* Main Reporting Form */}
      <form onSubmit={handleSubmit} className="hologram-card rounded-2xl p-6 border border-cyan-500/25 space-y-6">
        {/* Step 1: Select Hazard Category */}
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 mb-3 flex items-center justify-between">
            <span>Step 1 • Select Hazard Category</span>
            <span className="text-[10px] text-slate-400">Custom Pointer Follows Category</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {HAZARD_TYPES.map((h) => {
              const selected = selectedType === h.id;
              const cfg = HAZARD_CONFIG[h.id];
              return (
                <div
                  key={h.id}
                  onClick={() => {
                    setSelectedType(h.id);
                    playRadarBeep();
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selected
                      ? 'border-cyan-400 shadow-lg shadow-cyan-500/20'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                  style={selected ? { backgroundColor: `${cfg?.color || '#0284c7'}22` } : {}}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-2xl">{h.icon}</span>
                    <span
                      className="w-3 h-3 rounded-full border border-white/70 inline-block shadow-sm"
                      style={{ backgroundColor: cfg?.color || '#cbd5e1' }}
                    ></span>
                  </div>
                  <h4 className="font-bold text-sm text-white">{h.label}</h4>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">{h.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Severity Selector */}
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 mb-3">
            Step 2 • Hazard Severity
          </label>
          <div className="grid grid-cols-3 gap-3 font-mono text-xs">
            {['LOW', 'MODERATE', 'SEVERE'].map((sev) => {
              const active = severity === sev;
              return (
                <button
                  type="button"
                  key={sev}
                  onClick={() => setSeverity(sev)}
                  className={`py-2.5 rounded-xl font-bold border transition-all ${
                    active
                      ? sev === 'SEVERE'
                        ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-500/30'
                        : sev === 'MODERATE'
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {sev}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Interactive Location Confirmation Map & Geolocation */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span>Step 3 • Confirm Incident Location on Interactive Map</span>
            </label>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Click Map to Pin Exact Spot</span>
            </span>
          </div>

          {/* Quick Action Toolbar: GPS Button + Mappls Landmark Search */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={isLocating}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-mono font-bold shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
              title="Detect your real-time GPS position"
            >
              <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'Locking GPS...' : 'Locate My GPS'}</span>
            </button>

            {/* Mappls Landmark / Street Search Bar */}
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Mappls Search: e.g. Gariahat, Sealdah, Shyambazar..."
                  value={mapSearchQuery}
                  onChange={(e) => setMapSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleMapSearch(e);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-8 pr-16 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleMapSearch}
                  disabled={isSearchingMap}
                  className="absolute right-1.5 top-1.5 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-[10px] font-bold transition-all disabled:opacity-50"
                >
                  {isSearchingMap ? '...' : 'Find'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Popular Kolkata Hotspots */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-[10px] font-mono text-slate-400 self-center mr-1">Hotspots:</span>
            {QUICK_HOTSPOTS.map((spot) => (
              <button
                key={spot.name}
                type="button"
                onClick={() => handleSelectHotspot(spot)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-[11px] font-mono text-slate-300 transition-colors"
              >
                📍 {spot.name}
              </button>
            ))}
          </div>

          {/* Interactive Mappls Citizen Confirmation Map */}
          <div className="relative w-full h-[320px] rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#0a101d] shadow-xl">
            <div
              ref={mapContainerRef}
              id="citizen-location-picker-map"
              className="w-full h-full"
              style={{ minHeight: '320px' }}
            />

            {/* Map Center Crosshair Helper */}
            <div className="absolute top-2.5 left-2.5 bg-slate-950/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/70 text-[10px] font-mono text-slate-300 pointer-events-none flex items-center gap-1.5 z-10">
              <Crosshair className="w-3 h-3 text-cyan-400" />
              <span>Click map to reposition pin</span>
            </div>

            {/* Pointer Color Indicator */}
            <div className="absolute top-2.5 right-2.5 bg-slate-950/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/70 text-[10px] font-mono text-slate-300 pointer-events-none flex items-center gap-1.5 z-10">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: HAZARD_CONFIG[selectedType]?.color || '#0284c7' }}
              ></span>
              <span className="text-white font-bold">{HAZARD_CONFIG[selectedType]?.label} Pointer</span>
            </div>
          </div>

          {/* Verified Location Confirmation Box */}
          <div className="mt-2.5 p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/30 font-mono text-xs flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wide">
                  Confirmed Reporting Spot:
                </div>
                <div className="text-slate-100 font-bold text-xs truncate max-w-lg">
                  {address}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase text-slate-400 font-bold">GIS Coordinates:</div>
              <div className="text-cyan-300 font-bold text-xs">
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Photo Dropzone */}
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 mb-2">
            Step 4 • Photo Evidence (Optional)
          </label>
          <div className="relative border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-2xl p-5 text-center bg-slate-950/40 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {photoPreview ? (
              <div className="flex flex-col items-center">
                <img src={photoPreview} alt="Preview" className="h-32 rounded-xl object-cover border border-cyan-500/40 mb-2" />
                <span className="text-xs font-mono text-emerald-400">✓ Evidence Photo Loaded</span>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-1">
                <Camera className="w-8 h-8 text-slate-500" />
                <span className="text-xs font-mono text-slate-300">Click or Drag photo evidence here</span>
                <span className="text-[10px] font-mono text-slate-500">Supports PNG, JPG, WebP</span>
              </div>
            )}
          </div>
        </div>

        {/* Step 5: Observation Details & Reporter Handle */}
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 mb-2">
            Step 5 • Observation Details &amp; Reporter Name
          </label>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESET_OBSERVATIONS.map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() => setDescription((prev) => (prev ? `${prev}, ${pill}` : pill))}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Description Textarea */}
          <div className="relative mb-3">
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the hazard impact (e.g. 40cm water submerged street outside market, bumper scrape risk)..."
              className="w-full rounded-xl bg-slate-900/90 border border-slate-700/80 p-3.5 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 transition-all shadow-inner"
            />
          </div>

          {/* Reporter Name Input with Icon */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-4 h-4 text-cyan-400" />
            </div>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="Your full name or Citizen handle"
              className="w-full rounded-xl bg-slate-900/90 border border-slate-700/80 pl-10 pr-4 py-2.5 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-['Orbitron'] font-bold tracking-wider text-sm shadow-lg shadow-cyan-500/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <Send className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
          <span>{isSubmitting ? 'Broadcasting to Fleet...' : 'TRANSMIT HAZARD REPORT'}</span>
        </button>
      </form>
    </div>
  );
}
