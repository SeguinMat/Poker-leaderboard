'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, PlusCircle, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Player, GameResult } from '@/lib/types';

interface PlayerWithStats extends Player {
  games_played: number;
  wins: number;
  average: number;
}

function PlayerAvatar({ player, size = 36 }: { player: { name: string; avatar?: string | null }; size?: number }) {
  if (player.avatar) return <img src={player.avatar} alt={player.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.38, flexShrink: 0 }}>
      {player.name[0]?.toUpperCase()}
    </div>
  );
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [newName, setNewName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadPlayers(); }, []);

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
      s.gp++; s.pts += Number(r.points_earned);
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true); setError('');
    let avatarUrl: string | null = null;
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop();
      const path = `${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, avatarFile);
      if (uploadErr) { setError('Erreur upload image.'); setAdding(false); return; }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      avatarUrl = data.publicUrl;
    }
    const { error: err } = await supabase.from('players').insert({ name, avatar: avatarUrl });
    if (err) {
      setError(err.message.includes('unique') ? 'Ce nom existe déjà.' : 'Erreur lors de l\'ajout.');
    } else {
      setNewName(''); setAvatarFile(null); setAvatarPreview(null);
      await loadPlayers();
    }
    setAdding(false);
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Topbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" className="btn-ghost" style={{ padding: '6px 10px' }}><ArrowLeft size={16} /></Link>
          <span style={{ fontWeight: 700, color: 'var(--accent-gold)', fontSize: 15 }}>Joueurs</span>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Add player form */}
        <form onSubmit={addPlayer}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Ajouter un joueur</div>

            {/* Avatar + name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ width: 60, height: 60, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: 'var(--surface2)', border: '2px dashed var(--border-hover)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-gold)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
              >
                {avatarPreview
                  ? <img src={avatarPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <>
                      <Camera size={18} style={{ color: 'var(--muted)' }} />
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>Photo</span>
                    </>
                }
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Prénom ou pseudo…"
                className="input"
                style={{ flex: 1 }}
              />
            </div>

            {error && <p style={{ fontSize: 12, color: '#f87171', margin: '-8px 0' }}>{error}</p>}

            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="btn-primary"
              style={{ alignSelf: 'flex-end', opacity: adding || !newName.trim() ? 0.5 : 1 }}
            >
              <PlusCircle size={15} />
              {adding ? 'Ajout en cours…' : 'Ajouter le joueur'}
            </button>
          </div>
        </form>

        {/* Players list */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            {players.length} joueur{players.length !== 1 ? 's' : ''}
          </div>

          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--bg)' }}>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                <div className="skeleton" style={{ width: 120, height: 14 }} />
              </div>
            ))
          ) : players.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
              Aucun joueur pour l'instant.
            </div>
          ) : (
            players.map((p, i) => (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="row-link"
                style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--bg)', gap: 14 }}
              >
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, width: 20, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                <PlayerAvatar player={p} size={38} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{p.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.wins} 🏆</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.games_played} parties</span>
                  <span className="badge badge-gold" style={{ fontSize: 12, fontWeight: 600 }}>{p.average.toFixed(2)}</span>
                </div>
              </Link>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
