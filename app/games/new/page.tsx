'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Player } from '@/lib/types';
import { getPointsForPosition } from '@/lib/scoring';
import HeadsUpTimer from '@/components/HeadsUpTimer';
import ScorePreview from '@/components/ScorePreview';

function PlayerAvatar({ player, size = 28 }: { player: { name: string; avatar?: string | null }; size?: number }) {
  if (player.avatar) return <img src={player.avatar} alt={player.name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  return (
    <div className="rounded-full flex items-center justify-center font-medium flex-shrink-0" style={{ width: size, height: size, background: '#1f2937', color: '#9ca3af', fontSize: size * 0.38 }}>
      {player.name[0]?.toUpperCase()}
    </div>
  );
}

export default function NewGamePage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [headsUpTimer, setHeadsUpTimer] = useState(false);
  const [chipCounts, setChipCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { supabase.from('players').select('*').order('name').then(({ data }) => setPlayers(data ?? [])); }, []);

  const presentPlayers = players.filter((p) => present.has(p.id));

  function togglePresent(id: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); setPositions((p) => { const n = { ...p }; delete n[id]; return n; }); }
      else next.add(id);
      return next;
    });
  }

  function setPosition(playerId: string, pos: number) {
    if (pos < 1 || pos > presentPlayers.length) return;
    setPositions((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(next)) { if (v === pos && k !== playerId) delete next[k]; }
      next[playerId] = pos;
      return next;
    });
  }

  const previewEntries = presentPlayers.filter((p) => positions[p.id]).map((p) => ({ playerName: p.name, position: positions[p.id] }));

  function validate(): string {
    if (presentPlayers.length < 2) return 'Minimum 2 joueurs présents.';
    const posSet = new Set<number>();
    for (const p of presentPlayers) {
      if (!positions[p.id]) return `Position manquante pour ${p.name}.`;
      if (posSet.has(positions[p.id])) return 'Positions dupliquées.';
      posSet.add(positions[p.id]);
    }
    if (headsUpTimer) {
      const last2 = presentPlayers.filter((p) => positions[p.id] >= presentPlayers.length - 1);
      for (const p of last2) { if (!chipCounts[p.id] || isNaN(Number(chipCounts[p.id]))) return `Chip count manquant pour ${p.name}.`; }
      const counts = last2.map((p) => Number(chipCounts[p.id]));
      if (counts[0] === counts[1]) return 'Les chip counts doivent être différents.';
    }
    return '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(''); setSaving(true);
    const { data: game, error: gameErr } = await supabase.from('games').insert({ played_at: date, notes: notes || null, heads_up_timer_used: headsUpTimer }).select().single();
    if (gameErr || !game) { setError('Erreur lors de la création de la partie.'); setSaving(false); return; }
    const allResults = players.map((p) => {
      if (!present.has(p.id)) return { game_id: game.id, player_id: p.id, position: null, absent: true, points_earned: 0, chip_count: null };
      const pos = positions[p.id];
      return { game_id: game.id, player_id: p.id, position: pos, absent: false, points_earned: getPointsForPosition(pos), chip_count: headsUpTimer && chipCounts[p.id] ? Number(chipCounts[p.id]) : null };
    });
    const { error: resErr } = await supabase.from('game_results').insert(allResults);
    if (resErr) { setError('Erreur lors de l\'enregistrement des résultats.'); setSaving(false); return; }
    router.push('/');
  }

  const inputStyle = { background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none' };
  const sectionStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 };
  const labelStyle = { fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: 12, display: 'block' };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <Link href="/" style={{ color: 'var(--muted)' }} className="hover:opacity-80"><ArrowLeft size={18} /></Link>
          <span className="font-semibold" style={{ color: 'var(--accent-gold)' }}>Nouvelle partie</span>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={sectionStyle}>
            <label style={labelStyle}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>Joueurs présents ({presentPlayers.length})</label>
            {players.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>Aucun joueur. <Link href="/players" style={{ color: 'var(--accent-gold)' }}>Ajouter des joueurs</Link></p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {players.map((p) => (
                  <button key={p.id} type="button" onClick={() => togglePresent(p.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1px solid ${present.has(p.id) ? 'var(--accent-green)' : 'var(--border)'}`, background: present.has(p.id) ? '#2d6a4f30' : 'var(--surface2)', cursor: 'pointer', textAlign: 'left' }}>
                    <PlayerAvatar player={p} size={26} />
                    <span style={{ fontSize: 14, color: 'var(--text)' }}>{present.has(p.id) ? '✓ ' : ''}{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {presentPlayers.length >= 2 && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Positions</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {presentPlayers.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px' }}>
                    <PlayerAvatar player={p} size={26} />
                    <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{p.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button type="button" onClick={() => setPosition(p.id, (positions[p.id] ?? 0) - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}><ChevronUp size={15} /></button>
                      <span style={{ width: 28, textAlign: 'center', fontWeight: 600, color: 'var(--accent-gold)', fontSize: 15 }}>{positions[p.id] ?? '—'}</span>
                      <button type="button" onClick={() => setPosition(p.id, (positions[p.id] ?? 0) + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}><ChevronDown size={15} /></button>
                    </div>
                    <select value={positions[p.id] ?? ''} onChange={(e) => e.target.value && setPosition(p.id, Number(e.target.value))} style={{ background: 'var(--surface)', color: 'var(--text)', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}>
                      <option value="">—</option>
                      {Array.from({ length: presentPlayers.length }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}e</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {presentPlayers.length >= 2 && (
            <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>Heads-up timer utilisé ?</span>
              <button type="button" onClick={() => setHeadsUpTimer(!headsUpTimer)} style={{ background: headsUpTimer ? 'var(--accent-gold)' : 'var(--surface2)', color: headsUpTimer ? '#0d1117' : 'var(--muted)', border: 'none', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                {headsUpTimer ? 'Oui' : 'Non'}
              </button>
            </div>
          )}

          {headsUpTimer && presentPlayers.length >= 2 && <HeadsUpTimer />}

          {headsUpTimer && presentPlayers.length >= 2 && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Chip counts (2 derniers)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {presentPlayers.filter((p) => positions[p.id] && positions[p.id] >= presentPlayers.length - 1).map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 100, fontSize: 14, color: 'var(--text)' }}>{p.name}</span>
                    <input type="number" min={0} placeholder="Chips" value={chipCounts[p.id] ?? ''} onChange={(e) => setChipCounts((prev) => ({ ...prev, [p.id]: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {previewEntries.length > 0 && <ScorePreview entries={previewEntries} />}

          <div style={sectionStyle}>
            <label style={labelStyle}>Note (optionnelle)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Commentaire…" style={{ ...inputStyle, resize: 'none' }} />
          </div>

          {error && <p style={{ fontSize: 13, color: '#f87171' }}>{error}</p>}

          <button type="submit" disabled={saving} style={{ background: 'var(--accent-gold)', color: '#0d1117', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Enregistrement…' : 'Enregistrer la partie'}
          </button>
        </form>
      </div>
    </div>
  );
}
