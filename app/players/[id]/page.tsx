'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { Player, GameResult, Game } from '@/lib/types';

type ResultWithGame = GameResult & {
  games: Game;
  players: Player;
};

export default function PlayerProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [player, setPlayer] = useState<Player | null>(null);
  const [results, setResults] = useState<ResultWithGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('*').eq('id', id).single(),
      supabase
        .from('game_results')
        .select('*, games(*), players(*)')
        .eq('player_id', id)
        .order('created_at'),
    ]).then(([pRes, rRes]) => {
      setPlayer(pRes.data as Player);
      setResults((rRes.data ?? []) as ResultWithGame[]);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>Chargement…</div>;
  if (!player) return <div className="p-8 text-center text-red-400">Joueur introuvable.</div>;

  const played = results.filter((r) => !r.absent);
  const total_points = played.reduce((sum, r) => sum + Number(r.points_earned), 0);
  const average = played.length > 0 ? total_points / played.length : 0;
  const wins = played.filter((r) => r.position === 1).length;
  const podiums = played.filter((r) => r.position && r.position <= 3).length;

  // Streak
  let streak = 0;
  for (const r of [...played].reverse()) {
    if (r.position === 1) streak++;
    else break;
  }

  // Chart data: cumulative average over time
  const chartData: { date: string; average: number }[] = [];
  let cumPts = 0;
  played.forEach((r, i) => {
    cumPts += Number(r.points_earned);
    chartData.push({
      date: new Date(r.games?.played_at ?? r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      average: cumPts / (i + 1),
    });
  });

  const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/players" style={{ color: 'var(--muted)' }} className="hover:opacity-80">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--accent-gold)' }}>{player.name}</h1>
        {streak >= 2 && <span style={{ color: 'var(--accent-gold)' }}>{streak}🔥</span>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Parties', value: played.length },
          { label: 'Victoires', value: wins },
          { label: 'Podiums', value: podiums },
          { label: 'Moyenne', value: average.toFixed(2) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</div>
            <div className="text-xl font-bold" style={{ color: 'var(--accent-gold)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length >= 2 && (
        <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: 'var(--surface)' }}>
          <div className="text-sm font-medium mb-4" style={{ color: 'var(--muted)' }}>Évolution de la moyenne</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222840" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--surface2)', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: 'var(--muted)' }}
                formatter={(v) => [Number(v).toFixed(2), 'Moyenne']}
              />
              <Line type="monotone" dataKey="average" stroke="#f0c040" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="px-5 py-4 border-b text-sm font-medium" style={{ borderColor: 'var(--surface2)', color: 'var(--muted)' }}>
          Historique des parties
        </div>
        {results.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>Aucune partie.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--surface2)' }}>
            {[...results].reverse().map((r) => (
              <Link
                key={r.id}
                href={`/games/${r.game_id}`}
                className="flex items-center justify-between px-5 py-3 hover:opacity-80 transition-opacity"
              >
                <div>
                  <div className="font-medium">
                    {new Date(r.games?.played_at ?? r.created_at).toLocaleDateString('fr-FR', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                  </div>
                  {r.absent && <div className="text-xs" style={{ color: 'var(--muted)' }}>Absent</div>}
                </div>
                <div className="flex items-center gap-3">
                  {!r.absent && r.position && (
                    <span className="text-lg">{MEDAL[r.position] ?? `${r.position}e`}</span>
                  )}
                  {!r.absent && (
                    <span className="font-semibold" style={{ color: 'var(--accent-gold)' }}>
                      +{r.points_earned} pts
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
