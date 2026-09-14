import React, { useState } from 'react';
import { Shield, Key, Eye, EyeOff, Lock, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { loginAdmin } from '../utils/api';
import { playRadarBeep, playSuccessChime } from '../utils/audioFx';

export default function AdminSecurityGateway({ onAuthenticated, onSwitchToCitizen, onToast }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setIsLoading(true);
    setErrorMsg('');
    playRadarBeep();

    try {
      const res = await loginAdmin(password.trim());
      if (res && res.token) {
        localStorage.setItem('admin_token', res.token);
        playSuccessChime();
        if (onToast) onToast('Administrator authenticated! Command center unlocked.', 'success');
        if (onAuthenticated) onAuthenticated(res.token);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Access Denied: Incorrect administrative security key.');
      playRadarBeep();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="max-w-4xl mx-auto my-6 font-mono" aria-label="Admin Security & Authentication">
      {/* Title Bar */}
      <div className="flex flex-wrap items-center justify-between pb-4 mb-6 border-b border-slate-800">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-slate-400 mb-1 uppercase">
            ADMIN SECURITY GATEWAY &amp; ACCESS CONTROL
          </p>
          <h2 className="font-['Orbitron'] text-xl font-extrabold text-white">
            Municipal Authority Authentication
          </h2>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-950/80 border border-amber-600/50 text-amber-300">
          🔒 LOCKED / ACCESS RESTRICTED
        </span>
      </div>

      {/* Main Gateway Card Wrap */}
      <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-6 items-stretch">
        {/* Left: Login Form Card */}
        <div className="hologram-card rounded-2xl p-7 border border-cyan-500/25 bg-slate-950/90 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/20">
                🛡️
              </div>
              <div>
                <h3 className="font-['Orbitron'] font-bold text-base text-white">
                  Kolkata Municipal Command Center
                </h3>
                <span className="text-[11px] text-cyan-400">Restricted Dispatch Portal</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Access to live bus fleet multi-sensor telemetry, ultrasonic sonar water level telemetry, road distress logs, and emergency dispatch is restricted to authorized municipal transit personnel. Authenticate using your administrative security key to decrypt the console.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1.5">
                  ADMINISTRATIVE SECURITY KEY
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Key className="w-4 h-4 text-cyan-400" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter administrative security key (e.g. admin123)..."
                    className="w-full rounded-xl bg-slate-900/90 border border-slate-700/80 pl-10 pr-10 py-3 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 transition-all shadow-inner"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Banner */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600/60 text-rose-200 text-xs flex items-center space-x-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-['Orbitron'] font-bold text-xs tracking-wider shadow-lg shadow-cyan-500/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Lock className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Decrypting Console...' : '🔓 Authenticate & Unlock Command Center'}</span>
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <span className="text-xs text-slate-400">
              Civic Reporter?{' '}
              <button
                type="button"
                onClick={onSwitchToCitizen}
                className="text-cyan-400 font-bold hover:underline"
              >
                Go to Citizen Hazard Studio ↗
              </button>
            </span>
          </div>
        </div>

        {/* Right: Security & Architecture Specifications */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-full">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-md flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                AUTHORITY ROLE
              </span>
              <strong className="text-sm font-bold text-white block">
                Transit Incident Dispatcher
              </strong>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Depot Admin & Field Operations workflow triage privileges.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-md flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                ENCRYPTION PROTOCOL
              </span>
              <strong className="text-sm font-bold text-cyan-300 block">
                SHA-256 Handshake
              </strong>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Salted In-Memory Session Token with tamper protection.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-md flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                SECURE ENDPOINT
              </span>
              <strong className="text-sm font-bold text-emerald-400 block truncate">
                POST /api/v1/auth/admin-login
              </strong>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Protected Rate-Limited Gateway for Municipal transit desks.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-md flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                GIS DISPATCH SCOPE
              </span>
              <strong className="text-sm font-bold text-indigo-300 block">
                Kolkata Metro Fleet
              </strong>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Mappls (MapmyIndia) Web Map SDK v3.0 telemetry sync.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
