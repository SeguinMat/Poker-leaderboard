'use client';

import { useState, useEffect, useRef } from 'react';

const DURATION = 10 * 60; // 10 minutes in seconds

export default function HeadsUpTimer() {
  const [seconds, setSeconds] = useState(DURATION);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => setSeconds((s) => s - 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, seconds]);

  const pct = (seconds / DURATION) * 100;
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  const expired = seconds === 0;

  return (
    <div
      className="rounded-xl p-5 border"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: expired ? '#ef4444' : 'var(--accent-gold)',
      }}
    >
      <div className="text-sm font-medium mb-3" style={{ color: 'var(--muted)' }}>
        ⚔️ Heads-Up Timer
      </div>

      {expired ? (
        <div className="text-center py-2">
          <div className="text-2xl font-bold text-red-400">⏰ Timer expiré</div>
          <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Classement par chip count !
          </div>
        </div>
      ) : (
        <>
          <div className="text-4xl font-mono font-bold text-center mb-4" style={{ color: 'var(--accent-gold)' }}>
            {mins}:{secs}
          </div>
          <div className="rounded-full h-2 mb-4 overflow-hidden" style={{ backgroundColor: 'var(--surface2)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: pct > 30 ? 'var(--accent-gold)' : '#ef4444',
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRunning(!running)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
            >
              {running ? '⏸ Pause' : '▶ Reprendre'}
            </button>
            <button
              onClick={() => { setSeconds(DURATION); setRunning(true); }}
              className="px-3 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--surface2)', color: 'var(--muted)' }}
            >
              ↺
            </button>
          </div>
        </>
      )}
    </div>
  );
}
