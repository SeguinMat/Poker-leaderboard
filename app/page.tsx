'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Users, PlusCircle, TrendingUp, Star, Flame } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PlayerStats, GameWithResults } from '@/lib/types';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const RANK_COLOR: Record<number, string> = {
  1: 'var(--top1)',
  2: 'var(--top2)',
  3: 'var(--top3)',
};

export default function HomePage() {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [recentGames, setRecentGames] = useState<GameWithResults[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [playersRes, resultsRes, gamesRes] = await Promise.all([
      supabase.from('players').select('*').order('created_at'),
      supabase.from('game_results').select('*, players(*)').order('created_at'),
      supabase
        .from('games')
        .select('*, game_results(*, players(*))')
        .order('played_at', { ascending: false })
        .limit(10),
    ]);

    const players = playersRes.data ?? [];
    const results = resultsRes.data ?? [];
    const games = (gamesRes.data ?? []) as GameWithResults[];

    // Build per-player stats
    const statsMap = new Map<string, PlayerStats>();
    for (const p of players) {
      statsMap.set(p.id, {
        player: p,
        games_played: 0,
        total_points: 0,
        average: 0,
        best_position: null,
        wins: 0,
        podiums: 0,
        current_streak: 0,
      });
    }

    for (const r of results) {
      if (r.absent) continue;
      const s = statsMap.get(r.player_id);
      if (!s) continue;
      s.games_played++;
      s.total_points += Number(r.points_earned);
      if (r.position === 1) s.wins++;
      if (r.position && r.position <= 3) s.podiums++;
      if (r.position && (s.best_position === null || r.position < s.best_position)) {
        s.best_position = r.position;
      }
    }

    // Compute streaks (consecutive wins)
    const orderedGames = [...games].reverse();
    for (const [pid, s] of statsMap) {
      let streak = 0;
      for (const g of [...orderedGames].reverse()) {
        const res = g.game_results?.find((r) => r.player_id === pid && !r.absent);
        if (!res) break;
        if (res.position === 1) streak++;
        else break;
      }
      s.current_streak = streak;
    }

    const computed = [...statsMap.values()].map((s) => ({
      ...s,
      average: s.games_played > 0 ? s.total_points / s.games_played : 0,
    }));

    computed.sort((a, b) => b.average - a.average || b.games_played - a.games_played);
    setStats(computed);
    setRecentGames(games);
    setLoading(false);
  }

  const displayed = stats;

  const totalGames = recentGames.length > 0
    ? (recentGames[0] ? stats.reduce((acc, s) => Math.max(acc, 0), 0) : 0)
    : 0;

  const mostRegular = stats.reduce<PlayerStats | null>(
    (best, s) => (!best || s.games_played > best.games_played ? s : best),
    null
  );
  const bestStreak = stats.reduce<PlayerStats | null>(
    (best, s) => (!best || s.current_streak > (best?.current_streak ?? 0) ? s : best),
    null
  );

  // total games count from games table
  const [gameCount, setGameCount] = useState(0);
  useEffect(() => {
    supabase.from('games').select('id', { count: 'exact', head: true }).then(({ count }) => {
      setGameCount(count ?? 0);
    });
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--accent-gold)' }}>
          Poker Lunch 🃏
        </h1>
        <div className="flex gap-3">
          <Link
            href="/games/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--accent-gold)', color: '#0f1117' }}
          >
            <PlusCircle size={16} />
            Nouvelle partie
          </Link>
          <Link
            href="/players"
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm border transition-opacity hover:opacity-80"
            style={{ borderColor: 'var(--muted)', color: 'var(--text)' }}
          >
            <Users size={16} />
            Joueurs
          </Link>
        </div>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={<Trophy size={20} />} label="Parties jouées" value={String(gameCount)} />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Joueur le + régulier"
          value={mostRegular ? `${mostRegular.player.name} (${mostRegular.games_played})` : '—'}
        />
        <StatCard
          icon={<Flame size={20} />}
          label="Meilleure série"
          value={
            bestStreak && bestStreak.current_streak > 0
              ? `${bestStreak.player.name} (${bestStreak.current_streak}🔥)`
              : '—'
          }
        />
      </div>

      {/* Leaderboard */}
      <div className="rounded-xl overflow-hidden mb-8" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--surface2)' }}>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star size={18} style={{ color: 'var(--accent-gold)' }} /> Classement
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>Chargement…</div>
        ) : displayed.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>
            Aucun joueur pour l'instant.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                  <th className="text-left px-6 py-3">Rang</th>
                  <th className="text-left px-4 py-3">Joueur</th>
                  <th className="text-right px-4 py-3">Parties</th>
                  <th className="text-right px-4 py-3">Total pts</th>
                  <th className="text-right px-4 py-3">Moyenne</th>
                  <th className="text-right px-6 py-3">Meilleur</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((s, i) => {
                  const rank = i + 1;
                  const isTop3 = rank <= 3;
                  return (
                    <tr
                      key={s.player.id}
                      className="border-t transition-colors hover:opacity-90"
                      style={{
                        borderColor: 'var(--surface2)',
                        backgroundColor: isTop3 ? `${RANK_COLOR[rank]}10` : undefined,
                      }}
                    >
                      <td className="px-6 py-4 font-bold text-lg" style={{ color: isTop3 ? RANK_COLOR[rank] : 'var(--muted)' }}>
                        {MEDAL[rank] ?? rank}
                      </td>
                      <td className="px-4 py-4">
                        <Link href={`/players/${s.player.id}`} className="flex items-center gap-2 font-medium hover:underline">
                          {s.player.avatar ? (
                            <img src={s.player.avatar} alt={s.player.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}>
                              {s.player.name[0]?.toUpperCase()}
                            </div>
                          )}
                          {s.player.name}
                        </Link>
                        {s.current_streak >= 2 && (
                          <span className="ml-2 text-xs" style={{ color: 'var(--accent-gold)' }}>
                            {s.current_streak}🔥
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right" style={{ color: 'var(--muted)' }}>{s.games_played}</td>
                      <td className="px-4 py-4 text-right">{s.total_points.toFixed(1)}</td>
                      <td className="px-4 py-4 text-right font-semibold" style={{ color: 'var(--accent-gold)' }}>
                        {s.average.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right" style={{ color: 'var(--muted)' }}>
                        {s.best_position ? `${s.best_position}e` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent games */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--surface2)' }}>
          <h2 className="text-lg font-semibold">Dernières parties</h2>
        </div>
        {recentGames.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>
            Aucune partie enregistrée.{' '}
            <Link href="/games/new" className="underline" style={{ color: 'var(--accent-gold)' }}>
              Créer la première
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--surface2)' }}>
            {recentGames.map((g) => {
              const sorted = [...(g.game_results ?? [])].filter((r) => !r.absent).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
              return (
                <Link
                  key={g.id}
                  href={`/games/${g.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:opacity-80 transition-opacity"
                >
                  <div>
                    <div className="font-medium">
                      {new Date(g.played_at).toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
                      {sorted.slice(0, 3).map((r, i) => (
                        <span key={r.id}>
                          {i > 0 && ' › '}
                          {r.players?.name}
                        </span>
                      ))}
                      {sorted.length > 3 && <span> +{sorted.length - 3}</span>}
                    </div>
                  </div>
                  <div className="text-sm flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                    {g.heads_up_timer_used && <span title="Timer heads-up">⏱️</span>}
                    <span>{sorted.length} joueurs</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--surface)' }}>
      <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--accent-gold)' }}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{label}</span>
      </div>
      <div className="text-xl font-bold truncate">{value}</div>
    </div>
  );
}
