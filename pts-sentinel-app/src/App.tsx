/* ─── PTS SENTINEL — Root App ────────────────────────────────────────────*/

import { useState, useCallback, useEffect } from 'react';
import SetupScreen from './screens/SetupScreen';
import DashboardScreen from './screens/DashboardScreen';
import { beaconService, type BeaconLog } from './services/beaconService';

type AppState = 'setup' | 'active';

export default function App() {
  const [screen, setScreen] = useState<AppState>(() =>
    localStorage.getItem('pts_imei') ? 'active' : 'setup'
  );

  const [imei, setImei] = useState(localStorage.getItem('pts_imei') || '');
  const [intervalMs, setIntervalMs] = useState(30000);
  const [logs, setLogs] = useState<BeaconLog[]>([]);
  const [pingCount, setPingCount] = useState(0);
  const [isActive, setIsActive] = useState(false);

  // Unified log update handler
  const handleLogUpdate = useCallback((log: BeaconLog) => {
    setLogs(prev => {
      // Find and replace the same log ID (e.g. update 'pending' to 'sent')
      const index = prev.findIndex(l => l.id === log.id);
      let updated;
      if (index !== -1) {
        updated = [...prev];
        updated[index] = log;
      } else {
        updated = [...prev, log];
      }

      // Update successful ping counter
      if (log.status === 'sent') {
        // Only increment if we just transitioned to 'sent'
        const oldLog = prev.find(l => l.id === log.id);
        if (!oldLog || oldLog.status !== 'sent') {
          setPingCount(c => c + 1);
        }
      }

      return updated.slice(-100); // Keep last 100 logs
    });
  }, []);

  const startBeacon = useCallback((deviceImei: string, _token: string, ms: number) => {
    setImei(deviceImei);
    setIntervalMs(ms);
    setScreen('active');

    // Slight delay so UI transitions smoothly
    setTimeout(() => {
      beaconService.start(deviceImei, ms, handleLogUpdate, setIsActive);
    }, 500);
  }, [handleLogUpdate]);

  const stopBeacon = useCallback(() => {
    beaconService.stop();
  }, []);

  const restartBeacon = useCallback(() => {
    beaconService.start(imei, intervalMs, handleLogUpdate, setIsActive);
  }, [imei, intervalMs, handleLogUpdate]);

  const resetToSetup = useCallback(() => {
    beaconService.stop();
    setScreen('setup');
    setLogs([]);
    setPingCount(0);
  }, []);

  // Resilience: Auto-resume on app reload if setup was done
  useEffect(() => {
    const savedImei = localStorage.getItem('pts_imei');
    if (savedImei && screen === 'active' && !isActive) {
      beaconService.start(savedImei, intervalMs, handleLogUpdate, setIsActive);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--col-bg)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Tactical UI Scanline Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(rgba(0,0,0,0) 0, rgba(0,0,0,0) 1px, rgba(0,240,255,0.02) 1px, rgba(0,240,255,0.02) 2px)',
        backgroundSize: '100% 2px',
        zIndex: 99,
      }} />

      {/* Main Tactical Screen */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {screen === 'setup' ? (
          <SetupScreen onActivate={startBeacon} />
        ) : (
          <DashboardScreen
            imei={imei}
            intervalMs={intervalMs}
            logs={logs}
            pingCount={pingCount}
            isActive={isActive}
            onStop={stopBeacon}
            onRestart={restartBeacon}
          />
        )}
      </div>

      {/* Primary HUD Navigation Hub */}
      {screen === 'active' && (
        <nav style={{
          display: 'flex',
          background: 'rgba(10, 18, 32, 0.95)',
          borderTop: '1px solid var(--col-border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
          <NavBtn icon="📡" label="COMMAND" active />
          <NavBtn icon="👤" label="ID PASS" onClick={() => alert("Verification system online via Echelon Registry.")} />
          <NavBtn icon="⚙️" label="CONFIG" onClick={resetToSetup} />
        </nav>
      )}
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 0 16px',
        background: active ? 'rgba(0, 240, 255, 0.05)' : 'none',
        border: 'none',
        borderTop: active ? '2px solid var(--col-primary)' : '2px solid transparent',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        opacity: active ? 1 : 0.4,
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: active ? 'var(--col-primary)' : 'var(--col-muted)',
        letterSpacing: '0.2em',
        fontWeight: 600,
        textTransform: 'uppercase'
      }}>
        {label}
      </span>
    </button>
  );
}
