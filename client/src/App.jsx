import React, { useState, useEffect } from 'react';
import NavigationHeader from './components/NavigationHeader';
import AdminSecurityGateway from './components/AdminSecurityGateway';
import OverviewMetrics from './components/OverviewMetrics';
import CorridorTrafficBar from './components/CorridorTrafficBar';
import AcousticSonarHUD from './components/AcousticSonarHUD';
import InteractiveGISMap from './components/InteractiveGISMap';
import IncidentRegisterTable from './components/IncidentRegisterTable';
import AnalyticsPanel from './components/AnalyticsPanel';
import CitizenReportingStudio from './components/CitizenReportingStudio';
import { fetchEvents, fetchStats, fetchIntegrity, verifyAdminSession } from './utils/api';
import { playRadarBeep } from './utils/audioFx';
import './styles/creative.css';

export default function App() {
  const [activeMode, setActiveMode] = useState('command'); // 'command' | 'citizen'
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [integrityValid, setIntegrityValid] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Show Toast
  const showToast = (msg, type = 'info') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }) + ' IST');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check existing admin session on mount
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      verifyAdminSession(token).then((res) => {
        if (res && res.valid) {
          setIsAdminAuthenticated(true);
        } else {
          localStorage.removeItem('admin_token');
          setIsAdminAuthenticated(false);
        }
      });
    }
  }, []);

  // Lock Admin Portal
  const handleLockAdmin = () => {
    playRadarBeep();
    localStorage.removeItem('admin_token');
    setIsAdminAuthenticated(false);
    showToast('Administrator session locked', 'info');
  };

  // Poll Data
  const reloadData = async () => {
    try {
      const evs = await fetchEvents(100);
      if (Array.isArray(evs) && evs.length > 0) {
        setEvents(evs);
      }
      
      const st = await fetchStats();
      if (st) setStats(st);

      const integ = await fetchIntegrity();
      if (integ) setIntegrityValid(integ.valid);
    } catch (e) {
      console.warn('[Data Poll Warning]', e.message);
    }
  };

  useEffect(() => {
    reloadData();
    const timer = setInterval(reloadData, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="cyber-grid-bg min-h-screen text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm p-4 rounded-xl backdrop-blur-xl border shadow-2xl font-mono text-xs transition-all animate-bounce bg-slate-950/95 border-cyan-500/50 text-cyan-200">
          <div className="flex items-center space-x-2">
            <span className="text-cyan-400">●</span>
            <span>{toastMessage.msg}</span>
          </div>
        </div>
      )}

      {/* Top Navigation Header */}
      <NavigationHeader
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        isAdminAuthenticated={isAdminAuthenticated}
        onLockAdmin={handleLockAdmin}
        stats={stats}
        integrityValid={integrityValid}
        currentTime={currentTime}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-[1540px] w-full mx-auto px-4 lg:px-8 pb-12">
        {activeMode === 'command' ? (
          /* Command Center Mode */
          !isAdminAuthenticated ? (
            /* Locked State: Municipal Authority Authentication Gateway */
            <AdminSecurityGateway
              onAuthenticated={(token) => {
                setIsAdminAuthenticated(true);
                reloadData();
              }}
              onSwitchToCitizen={() => setActiveMode('citizen')}
              onToast={showToast}
            />
          ) : (
            /* Unlocked State: Full Command Center Suite */
            <div>
              {/* 1. Overview Metrics Row */}
              <OverviewMetrics events={events} stats={stats} />

              {/* 2. Corridor Traffic Network Bar */}
              <CorridorTrafficBar />

              {/* 3. Ultrasonic Sonar Live Telemetry HUD */}
              <AcousticSonarHUD
                onIncidentGenerated={reloadData}
                onToast={showToast}
              />

              {/* 4. Mappls (MapmyIndia) GIS Safety Map */}
              <InteractiveGISMap
                events={events}
                onSelectEvent={(ev) => showToast(`Focused: ${ev.event_type} (${ev.address || ev.event_id?.slice(0, 8)})`)}
              />

              {/* 5. Incident Register & Signal Analytics Split Panel */}
              <div className="grid grid-cols-1 xl:grid-cols-[2.5fr_1fr] gap-6 items-start">
                <IncidentRegisterTable
                  events={events}
                  onStatusUpdated={reloadData}
                  onSelectEvent={(ev) => showToast(`Selected ${ev.event_type}`)}
                  onToast={showToast}
                />
                <AnalyticsPanel
                  events={events}
                  integrityValid={integrityValid}
                />
              </div>

              {/* 6. Active Municipal Session Footer Card */}
              <div className="mt-8 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">🛡️</span>
                  <div>
                    <span className="font-bold text-white block">Municipal Authority Session Active</span>
                    <span className="text-slate-400 text-[11px]">Role: Transport Authority &amp; Incident Dispatcher · Kolkata Transit Network</span>
                  </div>
                </div>
                <button
                  onClick={handleLockAdmin}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition-all"
                >
                  🔒 Lock Command Center
                </button>
              </div>
            </div>
          )
        ) : (
          /* Citizen Hazard Reporting Studio */
          <CitizenReportingStudio
            onReportSubmitted={() => {
              reloadData();
              showToast('Incident report verified and sealed on blockchain ledger!', 'success');
            }}
            onToast={showToast}
          />
        )}
      </main>
    </div>
  );
}
