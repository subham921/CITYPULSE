import React, { useState, useEffect } from 'react';
import NavigationHeader from './components/NavigationHeader';
import AcousticSonarHUD from './components/AcousticSonarHUD';
import InteractiveGISMap from './components/InteractiveGISMap';
import IncidentRegisterTable from './components/IncidentRegisterTable';
import CitizenReportingStudio from './components/CitizenReportingStudio';
import { fetchEvents, fetchStats, fetchIntegrity } from './utils/api';
import './styles/creative.css';

export default function App() {
  const [activeMode, setActiveMode] = useState('command'); // 'command' | 'citizen'
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

  // Poll Data
  const reloadData = async () => {
    try {
      const evs = await fetchEvents(100);
      if (Array.isArray(evs)) setEvents(evs);
      
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
    const timer = setInterval(reloadData, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="cyber-grid-bg min-h-screen text-slate-100 flex flex-col">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm p-4 rounded-xl backdrop-blur-xl border shadow-2xl font-mono text-xs transition-all animate-bounce bg-slate-950/90 border-cyan-500/50 text-cyan-200">
          <div className="flex items-center space-x-2">
            <span>●</span>
            <span>{toastMessage.msg}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <NavigationHeader
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        stats={stats}
        integrityValid={integrityValid}
        currentTime={currentTime}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 pb-12">
        {activeMode === 'command' ? (
          <div>
            {/* Ultrasonic Sonar Live HUD */}
            <AcousticSonarHUD
              onIncidentGenerated={reloadData}
              onToast={showToast}
            />

            {/* GIS Map Panel */}
            <InteractiveGISMap
              events={events}
              onSelectEvent={(ev) => showToast(`Selected ${ev.event_type} (${ev.event_id})`)}
            />

            {/* Incident Register Table with Ultrasonic Telemetry Column */}
            <IncidentRegisterTable
              events={events}
              onStatusUpdated={reloadData}
              onToast={showToast}
            />
          </div>
        ) : (
          /* Citizen Studio */
          <CitizenReportingStudio
            onReportSubmitted={() => {
              reloadData();
              showToast('Incident submitted to live network!', 'success');
            }}
            onToast={showToast}
          />
        )}
      </main>
    </div>
  );
}
