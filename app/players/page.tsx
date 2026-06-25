'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Player, GameResult } from '@/lib/types';

interface PlayerWithStats extends Player {
  games_played: number;
  wins: number;
  average: number;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    setLoading(true);
    const [pRes, rRes] = await Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('game_results').select('player_id, position, absent, points_earned'),
    ]);
    const ps = pRes.data ?? [];
    const rs = (rRes.data ?? []) as Pick<GameResult, 'player_id' | 'position' | 'absent' | 'points_earned'>[];

    const statsMap = new Map<string, { gp: number; wins: number; pts: number }>();
    for (const p of ps) statsMap.set(p.id, { gp: 0, wins: 0, pts: 0 });
    for (const r of rs) {
      if (r.absent) continue;
      const s = statsMap.get(r.player_id);
      if (!s) continue;
      s.gp++;
      s.pts += Number(r.points_earned);
      if (r.position === 1) s.wins++;
    }

    const result: PlayerWithStats[] = ps.map((p) => {
      const s = statsMap.get(p.id) ?? { gp: 0, wins: 0, pts: 0 };
      return { ...p, games_played: s.gp, wins: s.wins, average: s.gp > 0 ? s.pts / s.gp : 0 };
    });
    result.sort((a, b) => b.average - a.average);
    setPlayers(result);
    setLoading(false);
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError('');
    const { error: err } = await supabase.from('players').insert({ name });
    if (err) {
      setError(err.message.includes('unique') ? 'Ce nom existe déjà.' : 'Erreur lors de l\'ajout.');
    } else {
      setNewName('');
      await loadPlayers();
    }
    setAdding(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" style={{ color: 'var(--muted)' }} className="hover:opacity-80">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--accent-gold)' }}>Joueurs</h1>
      </div>

      {/* Add player form */}
      <form onSubmit={addPlayer} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Prénom ou pseudo…"
          className="flex-1 rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--surface2)' }}
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-gold)', color: '#0f1117' }}
        >
          <PlusCircle size={16} />
          Ajouter
        </button>
      </form>
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {/* Players list */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface)' }}>
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>Chargement…</div>
        ) : players.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>Aucun joueur pour l'instant.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--surface2)' }}>
            {players.map((p, i) => (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="flex items-center justify-between px-5 py-4 hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold w-8" style={{ color: 'var(--muted)' }}>{i + 1}</span>
                  <span className="font-medium">{p.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--muted)' }}>
                  <span>{p.wins} 🏆</span>
                  <span>{p.games_played} parties</span>
                  <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{p.average.toFixed(2)} moy</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
