import React, { useState, useEffect } from 'react';
import NavigationHeader from './components/NavigationHeader';
import OverviewMetrics from './components/OverviewMetrics';
import CorridorTrafficBar from './components/CorridorTrafficBar';
import AcousticSonarHUD from './components/AcousticSonarHUD';
import InteractiveGISMap from './components/InteractiveGISMap';
import IncidentRegisterTable from './components/IncidentRegisterTable';
import AnalyticsPanel from './components/AnalyticsPanel';
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
        stats={stats}
        integrityValid={integrityValid}
        currentTime={currentTime}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-[1540px] w-full mx-auto px-4 lg:px-8 pb-12">
        {activeMode === 'command' ? (
          <div>
            {/* 1. Overview Metrics Row (All 5 Cards + Waterlogged Sonar) */}
            <OverviewMetrics events={events} stats={stats} />

            {/* 2. Corridor Traffic Network Bar */}
            <CorridorTrafficBar />

            {/* 3. Ultrasonic Sonar Live Telemetry HUD */}
            <AcousticSonarHUD
              onIncidentGenerated={reloadData}
              onToast={showToast}
            />

            {/* 4. Kolkata Metropolitan GIS Vector Twin Map */}
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
          </div>
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
