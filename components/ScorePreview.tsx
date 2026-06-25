import { getPointsForPosition } from '@/lib/scoring';

interface Entry {
  playerName: string;
  position: number;
}

export default function ScorePreview({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => a.position - b.position);

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface2)' }}>
      <div className="text-sm font-medium mb-3" style={{ color: 'var(--muted)' }}>
        Aperçu des points
      </div>
      <div className="space-y-2">
        {sorted.map((e) => (
          <div key={e.playerName} className="flex items-center justify-between">
            <span className="text-sm">
              {e.position}e — {e.playerName}
            </span>
            <span className="font-semibold text-sm" style={{ color: 'var(--accent-gold)' }}>
              +{getPointsForPosition(e.position)} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
