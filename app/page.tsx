'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, TrendingUp, Flame, PlusCircle, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PlayerStats, GameWithResults } from '@/lib/types';

function PlayerAvatar({ player, size = 32 }: { player: { name: string; avatar?: string | null }; size?: number }) {
  if (player.avatar) {
    return <img src={player.avatar} alt={player.name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full flex items-center justify-center font-medium flex-shrink-0" style={{ width: size, height: size, background: 'var(--surface2)', color: 'var(--text-secondary)', fontSize: size * 0.38 }}>
      {player.name[0]?.toUpperCase()}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--bg)' }}>
      <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
      <div className="skeleton" style={{ width: 100, height: 14 }} />
      <div style={{ flex: 1 }} />
      <div className="skeleton" style={{ width: 50, height: 14 }} />
    </div>
  );
}

const RANK_COLOR = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' } as Record<number, string>;

export default function HomePage() {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [recentGames, setRecentGames] = useState<GameWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameCount, setGameCount] = useState(0);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [playersRes, resultsRes, gamesRes, countRes] = await Promise.all([
      supabase.from('players').select('*').order('created_at'),
      supabase.from('game_results').select('*, players(*)').order('created_at'),
      supabase.from('games').select('*, game_results(*, players(*))').order('played_at', { ascending: false }).limit(10),
      supabase.from('games').select('id', { count: 'exact', head: true }),
    ]);

    const players = playersRes.data ?? [];
    const results = resultsRes.data ?? [];
    const games = (gamesRes.data ?? []) as GameWithResults[];
    setGameCount(countRes.count ?? 0);

    const statsMap = new Map<string, PlayerStats>();
    for (const p of players) {
      statsMap.set(p.id, { player: p, games_played: 0, total_points: 0, average: 0, best_position: null, wins: 0, podiums: 0, current_streak: 0 });
    }
    for (const r of results) {
      if (r.absent) continue;
      const s = statsMap.get(r.player_id);
      if (!s) continue;
      s.games_played++;
      s.total_points += Number(r.points_earned);
      if (r.position === 1) s.wins++;
      if (r.position && r.position <= 3) s.podiums++;
      if (r.position && (s.best_position === null || r.position < s.best_position)) s.best_position = r.position;
    }

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

    const computed = [...statsMap.values()].map((s) => ({ ...s, average: s.games_played > 0 ? s.total_points / s.games_played : 0 }));
    computed.sort((a, b) => b.average - a.average || b.games_played - a.games_played);
    setStats(computed);
    setRecentGames(games);
    setLoading(false);
  }

  const top3 = stats.slice(0, 3);
  const rest = stats.slice(3);
  const mostRegular = stats.reduce<PlayerStats | null>((best, s) => (!best || s.games_played > best.games_played ? s : best), null);
  const bestStreak = stats.reduce<PlayerStats | null>((best, s) => (!best || s.current_streak > (best?.current_streak ?? 0) ? s : best), null);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Topbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: '-0.3px' }}>
            Poker Lunch <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 13 }}>🃏</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/players" className="btn-ghost"><Users size={14} />Joueurs</Link>
            <Link href="/games/new" className="btn-primary"><PlusCircle size={14} />Nouvelle partie</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { icon: <Trophy size={14} />, label: 'Parties jouées', value: String(gameCount), sub: 'au total' },
            { icon: <TrendingUp size={14} />, label: 'Le plus régulier', value: mostRegular?.player.name ?? '—', sub: mostRegular ? `${mostRegular.games_played} parties` : '—' },
            { icon: <Flame size={14} />, label: 'Meilleure série', value: bestStreak && bestStreak.current_streak > 0 ? bestStreak.player.name : '—', sub: bestStreak && bestStreak.current_streak > 0 ? `${bestStreak.current_streak} victoires 🔥` : '—' },
          ].map(({ icon, label, value, sub }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>
                {icon}{label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {!loading && stats.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--muted)' }}>
            Aucune partie encore.{' '}
            <Link href="/games/new" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>Créer la première</Link>
          </div>
        )}

        {!loading && stats.length > 0 && (
          <>
            {/* Podium */}
            {top3.length > 0 && (() => {
              const slots: ({ s: PlayerStats; rank: number } | null)[] = [
                top3[1] ? { s: top3[1], rank: 2 } : null,
                { s: top3[0], rank: 1 },
                top3[2] ? { s: top3[2], rank: 3 } : null,
              ];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 12, alignItems: 'end' }}>
                  {slots.map((slot, i) => {
                    if (!slot) return <div key={i} />;
                    const { s, rank } = slot;
                    const isFirst = rank === 1;
                    const c = RANK_COLOR[rank] ?? 'var(--muted)';
                    return (
                      <Link key={s.player.id} href={`/players/${s.player.id}`} className="card-link"
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', borderRadius: 14, padding: isFirst ? '28px 20px 22px' : '18px 14px 18px', background: 'var(--surface)', border: `1px solid ${isFirst ? c + '50' : 'var(--border)'}`, position: 'relative', gap: isFirst ? 10 : 7 }}
                      >
                        {isFirst && <div style={{ fontSize: 28, lineHeight: 1 }}>👑</div>}
                        <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: c + '18', color: c, border: `1px solid ${c}40`, letterSpacing: '0.8px' }}>#{rank}</div>
                        <PlayerAvatar player={s.player} size={isFirst ? 72 : 48} />
                        <div>
                          <div style={{ color: 'var(--text)', fontSize: isFirst ? 17 : 13, fontWeight: 600, marginBottom: 2 }}>{s.player.name}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 11 }}>{s.games_played} parties · {s.wins} 🏆</div>
                        </div>
                        <div style={{ fontSize: isFirst ? 28 : 19, fontWeight: 700, color: c, lineHeight: 1 }}>{s.average.toFixed(2)}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>moy / partie</div>
                        {s.current_streak >= 2 && <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 11, color: 'var(--accent-gold)' }}>{s.current_streak}🔥</div>}
                      </Link>
                    );
                  })}
                </div>
              );
            })()}

            {/* Rest of leaderboard */}
            {rest.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                  Classement complet
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 64px 64px 76px', padding: '8px 20px 6px', borderBottom: '1px solid var(--bg)' }}>
                  {['#', 'Joueur', 'Parties', 'Total', 'Moy'].map((h, i) => (
                    <span key={h} style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</span>
                  ))}
                </div>
                {rest.map((s, i) => (
                  <Link key={s.player.id} href={`/players/${s.player.id}`} className="row-link"
                    style={{ display: 'grid', gridTemplateColumns: '44px 1fr 64px 64px 76px', padding: '10px 20px', borderBottom: '1px solid var(--bg)', alignItems: 'center' }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{i + 4}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <PlayerAvatar player={s.player} size={26} />
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{s.player.name}</span>
                      {s.current_streak >= 2 && <span style={{ fontSize: 11, color: 'var(--accent-gold)' }}>{s.current_streak}🔥</span>}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{s.games_played}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{s.total_points.toFixed(0)}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-gold">{s.average.toFixed(2)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* Recent games */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            Dernières parties
          </div>
          {loading ? (
            [...Array(3)].map((_, i) => <SkeletonRow key={i} />)
          ) : recentGames.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)' }}>
              Aucune partie.{' '}
              <Link href="/games/new" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>Créer la première</Link>
            </div>
          ) : (
            recentGames.map((g) => {
              const sorted = [...(g.game_results ?? [])].filter((r) => !r.absent).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
              return (
                <Link key={g.id} href={`/games/${g.id}`} className="row-link"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid var(--bg)' }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                      {new Date(g.played_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {sorted.slice(0, 3).map((r, i) => <span key={r.id}>{i > 0 && <span style={{ opacity: 0.4, margin: '0 3px' }}>›</span>}{r.players?.name}</span>)}
                      {sorted.length > 3 && <span style={{ color: 'var(--muted)', marginLeft: 4 }}>+{sorted.length - 3}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {g.heads_up_timer_used && <span className="badge">⏱ timer</span>}
                    <span className="badge">{sorted.length} joueurs</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
