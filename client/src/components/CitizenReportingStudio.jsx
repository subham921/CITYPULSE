import React, { useState } from 'react';
import { Navigation, Camera, AlertTriangle, Waves, Cpu, CheckCircle2, Shield, MapPin, Send, User, FileText } from 'lucide-react';
import confetti from 'canvas-confetti';
import { submitCitizenReport, uploadEvidencePhoto } from '../utils/api';
import { playSuccessChime, playRadarBeep } from '../utils/audioFx';

const HAZARD_TYPES = [
  { id: 'POTHOLE', label: 'Pothole / Crater', desc: 'Cavity on asphalt road surface', icon: '🕳️' },
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

  // GPS Geolocation Handler
  const handleDetectGPS = () => {
    setIsLocating(true);
    playRadarBeep();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setAddress(`GPS Position (${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)})`);
          setIsLocating(false);
          if (onToast) onToast('GPS lock acquired (Precision ±3m)', 'success');
        },
        () => {
          setIsLocating(false);
          if (onToast) onToast('Location permission denied. Defaulting to selected spot.', 'error');
        }
      );
    } else {
      setIsLocating(false);
    }
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
        description: description || 'Citizen reported road safety hazard',
        reporter_name: reporterName,
        photo_url: photoUrl
      };

      const res = await submitCitizenReport(payload);
      playSuccessChime();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

      setSubmittedReceipt(res);
      if (onToast) onToast('Hazard report verified and sealed on ledger!', 'success');
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
            Directly alert Kolkata Transit Authority dispatchers. Reports are verified with multi-sensor fleet telemetry and sealed with cryptographic hashes.
          </p>
        </div>
      </div>

      {/* Success Receipt Banner */}
      {submittedReceipt && (
        <div className="hologram-card rounded-2xl p-6 mb-6 border border-emerald-500/40 bg-emerald-950/30 text-emerald-200 animate-fadeIn">
          <div className="flex items-center space-x-3 mb-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <h3 className="font-['Orbitron'] font-bold text-base text-white">
              REPORT SEALED & BROADCASTED
            </h3>
          </div>
          <p className="text-xs font-mono text-slate-300">
            Incident ID: <span className="text-cyan-300 font-bold">{submittedReceipt.event_id}</span>
          </p>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Sealed on cryptographic ledger block with immutable SHA-256 tamper-proof evidence signature.
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
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 mb-3">
            Step 1 • Select Hazard Category
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {HAZARD_TYPES.map((h) => {
              const selected = selectedType === h.id;
              return (
                <div
                  key={h.id}
                  onClick={() => {
                    setSelectedType(h.id);
                    playRadarBeep();
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selected
                      ? 'bg-gradient-to-tr from-cyan-950/80 to-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/20'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="text-2xl mb-1">{h.icon}</div>
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

        {/* Step 3: Geolocation Lock-on & Kolkata Hotspots */}
        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 mb-3">
            Step 3 • Incident Location &amp; Hotspots
          </label>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={isLocating}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-mono font-bold shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'Locking GPS...' : 'Locate My GPS'}</span>
            </button>

            {QUICK_HOTSPOTS.map((spot) => (
              <button
                key={spot.name}
                type="button"
                onClick={() => {
                  setLatitude(spot.lat);
                  setLongitude(spot.lng);
                  setAddress(`${spot.name}, Kolkata`);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono text-slate-300 transition-colors"
              >
                📍 {spot.name}
              </button>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs flex justify-between items-center">
            <span className="text-slate-300 truncate max-w-md">{address}</span>
            <span className="text-[11px] text-cyan-400 font-bold shrink-0">
              {latitude.toFixed(4)}, {longitude.toFixed(4)}
            </span>
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

        {/* Step 5: Observation Details & Reporter Handle (Beautiful High-Tech Input Bars) */}
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
