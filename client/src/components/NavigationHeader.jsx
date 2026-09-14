import React, { useState, useEffect } from 'react';
import { Shield, Radio, Volume2, VolumeX, Activity, Sparkles, Navigation, Layers, Lock, Unlock, Server, Wifi, Check, RefreshCw } from 'lucide-react';
import { isAudioMuted, toggleAudioMute, playRadarBeep, playSuccessChime } from '../utils/audioFx';
import { getApiBase, setApiBase, checkBackendHealth, RENDER_CLOUD_BASE } from '../utils/api';

export default function NavigationHeader({ activeMode, setActiveMode, isAdminAuthenticated, onLockAdmin, stats, integrityValid, currentTime }) {
  const [muted, setMuted] = useState(isAudioMuted());
  const [backendStatus, setBackendStatus] = useState({ ok: true, latency: 15 });
  const [showBackendModal, setShowBackendModal] = useState(false);
  const [activeBase, setActiveBase] = useState(getApiBase());
  const [isPinging, setIsPinging] = useState(false);

  // Periodic Backend Ping
  const pingBackend = async () => {
    setIsPinging(true);
    const res = await checkBackendHealth();
    setBackendStatus(res);
    setIsPinging(false);
  };

  useEffect(() => {
    pingBackend();
    const interval = setInterval(pingBackend, 15000);
    return () => clearInterval(interval);
  }, [activeBase]);

  const handleMuteToggle = () => {
    const next = toggleAudioMute();
    setMuted(next);
    if (!next) playRadarBeep();
  };

  const handleModeSwitch = (mode) => {
    playRadarBeep();
    if (document.startViewTransition) {
      document.startViewTransition(() => setActiveMode(mode));
    } else {
      setActiveMode(mode);
    }
  };

  const handleSwitchBackend = (url) => {
    setApiBase(url);
    setActiveBase(url);
    setShowBackendModal(false);
    playSuccessChime();
    window.location.reload();
  };

  const isRenderCloud = activeBase.includes('onrender.com');

  return (
    <header className="sticky top-0 z-50 hologram-card border-b border-cyan-500/20 bg-[#060913]/90 backdrop-blur-xl px-4 lg:px-8 py-3 mb-6 font-mono">
      <div className="max-w-[1540px] mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Digital Twin Status */}
        <div className="flex items-center space-x-3.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 shadow-lg shadow-cyan-500/20">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-['Orbitron'] font-bold text-lg md:text-xl tracking-wider text-white">
                CITY<span className="text-cyan-400 text-glow-cyan">PULSE</span>
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                Urban Twin
              </span>
            </div>
            <p className="text-xs text-slate-400 tracking-tight">
              Urban Intelligence &amp; Ultrasonic Sonar Network (Mappls Powered)
            </p>
          </div>
        </div>

        {/* Dual Mode Switcher Segmented Pills */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900/90 border border-slate-800 shadow-inner">
          <button
            onClick={() => handleModeSwitch('command')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeMode === 'command'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Command Center</span>
          </button>
          <button
            onClick={() => handleModeSwitch('citizen')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeMode === 'citizen'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Citizen Studio</span>
          </button>
        </div>

        {/* Live Telemetry & Control Badges */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Backend Connection Status Pill (Clickable to switch or verify) */}
          <button
            onClick={() => setShowBackendModal(true)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border transition-all ${
              backendStatus.ok
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-rose-950/60 border-rose-500/50 text-rose-300 hover:bg-rose-900/50'
            }`}
            title="Click to manage backend connection target"
          >
            <Server className={`w-3 h-3 ${backendStatus.ok ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="font-bold">
              {backendStatus.ok ? (isRenderCloud ? 'Cloud API' : 'Backend') : 'Offline'}
            </span>
            <span className="text-[10px] opacity-75">
              {backendStatus.ok ? `${backendStatus.latency}ms` : 'Retry'}
            </span>
          </button>

          {/* Admin Auth Status Badge */}
          {isAdminAuthenticated ? (
            <div className="flex items-center space-x-1.5">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                <Unlock className="w-3 h-3 text-emerald-400" />
                <span>Admin: Unlocked</span>
              </span>
              <button
                onClick={onLockAdmin}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 transition-all"
                title="Lock Municipal Command Center"
              >
                🔒 Lock
              </button>
            </div>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Admin: Locked</span>
            </span>
          )}

          {/* Cryptographic Ledger Status */}
          <div
            className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full border ${
              integrityValid
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
            title="SHA-256 Cryptographic Evidence Ledger Status"
          >
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>Ledger {integrityValid ? 'Sealed ✓' : 'Fail'}</span>
          </div>

          {/* Sound FX Toggle */}
          <button
            onClick={handleMuteToggle}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
            title={muted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
          </button>

          {/* Clock */}
          <div className="hidden md:flex items-center px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-400 text-[11px]">
            <Activity className="w-3 h-3 text-cyan-400 mr-1.5 animate-pulse" />
            <span>{currentTime || 'LIVE IST'}</span>
          </div>
        </div>
      </div>

      {/* Backend Connection Selection Modal */}
      {showBackendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono">
          <div className="bg-slate-950 border border-cyan-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-['Orbitron'] font-bold text-sm text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>BACKEND CONNECTION TARGET</span>
              </h4>
              <button onClick={() => setShowBackendModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Select or switch the active API backend server connecting to the CITYPULSE Urban Intelligence Network:
            </p>

            <div className="space-y-2.5">
              {/* Option 1: Local / Auto */}
              <div
                onClick={() => handleSwitchBackend('/api/v1')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  !isRenderCloud
                    ? 'bg-cyan-950/50 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span>Local / Same-Origin Backend</span>
                    {!isRenderCloud && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Direct or Express proxy: <code>/api/v1</code>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">Default</span>
              </div>

              {/* Option 2: Live Render Cloud */}
              <div
                onClick={() => handleSwitchBackend(RENDER_CLOUD_BASE)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  isRenderCloud
                    ? 'bg-cyan-950/50 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span>Render Cloud Production Server</span>
                    {isRenderCloud && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <div className="text-[10px] text-cyan-300 mt-0.5 break-all">
                    citypulse-backend-i0kh.onrender.com
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-bold">Cloud</span>
              </div>
            </div>

            {/* Live Ping Status */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${backendStatus.ok ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span className="text-slate-300">
                  {backendStatus.ok ? `Connected (${backendStatus.latency}ms latency)` : 'Connection Error'}
                </span>
              </div>
              <button
                onClick={pingBackend}
                disabled={isPinging}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin' : ''}`} />
                <span>Test Ping</span>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowBackendModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
