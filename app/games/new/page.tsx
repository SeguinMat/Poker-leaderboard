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

  useEffect(() => {
    supabase.from('players').select('*').order('name').then(({ data }) => {
      setPlayers(data ?? []);
    });
  }, []);

  const presentPlayers = players.filter((p) => present.has(p.id));
  const usedPositions = new Set(Object.values(positions));

  function togglePresent(id: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setPositions((p) => { const n = { ...p }; delete n[id]; return n; });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function setPosition(playerId: string, pos: number) {
    if (pos < 1 || pos > presentPlayers.length) return;
    setPositions((prev) => {
      const next = { ...prev };
      // clear any other player who had this position
      for (const [k, v] of Object.entries(next)) {
        if (v === pos && k !== playerId) delete next[k];
      }
      next[playerId] = pos;
      return next;
    });
  }

  const previewEntries = presentPlayers
    .filter((p) => positions[p.id])
    .map((p) => ({ playerName: p.name, position: positions[p.id] }));

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
      for (const p of last2) {
        if (!chipCounts[p.id] || isNaN(Number(chipCounts[p.id]))) return `Chip count manquant pour ${p.name}.`;
      }
      const counts = last2.map((p) => Number(chipCounts[p.id]));
      if (counts[0] === counts[1]) return 'Les chip counts doivent être différents.';
    }
    return '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);

    // Insert game
    const { data: game, error: gameErr } = await supabase
      .from('games')
      .insert({ played_at: date, notes: notes || null, heads_up_timer_used: headsUpTimer })
      .select()
      .single();

    if (gameErr || !game) { setError('Erreur lors de la création de la partie.'); setSaving(false); return; }

    // Build results
    const allResults = players.map((p) => {
      if (!present.has(p.id)) {
        return { game_id: game.id, player_id: p.id, position: null, absent: true, points_earned: 0, chip_count: null };
      }
      const pos = positions[p.id];
      const points = getPointsForPosition(pos);
      const chip = headsUpTimer && chipCounts[p.id] ? Number(chipCounts[p.id]) : null;
      return { game_id: game.id, player_id: p.id, position: pos, absent: false, points_earned: points, chip_count: chip };
    });

    const { error: resErr } = await supabase.from('game_results').insert(allResults);
    if (resErr) { setError('Erreur lors de l\'enregistrement des résultats.'); setSaving(false); return; }

    router.push('/');
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" style={{ color: 'var(--muted)' }} className="hover:opacity-80 transition-opacity">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--accent-gold)' }}>Nouvelle partie</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg px-4 py-3 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--surface2)' }}
          />
        </div>

        {/* Player selection */}
        <div>
          <label className="block text-sm font-medium mb-3" style={{ color: 'var(--muted)' }}>
            Joueurs présents ({presentPlayers.length})
          </label>
          {players.length === 0 ? (
            <p style={{ color: 'var(--muted)' }} className="text-sm">
              Aucun joueur.{' '}
              <Link href="/players" className="underline" style={{ color: 'var(--accent-gold)' }}>Ajouter des joueurs</Link>
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePresent(p.id)}
                  className="py-2 px-3 rounded-lg text-sm font-medium text-left transition-all"
                  style={{
                    backgroundColor: present.has(p.id) ? 'var(--accent-green)' : 'var(--surface)',
                    color: present.has(p.id) ? 'white' : 'var(--text)',
                    border: `1px solid ${present.has(p.id) ? 'var(--accent-green)' : 'var(--surface2)'}`,
                  }}
                >
                  {present.has(p.id) ? '✓ ' : ''}{p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Positions */}
        {presentPlayers.length >= 2 && (
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: 'var(--muted)' }}>
              Positions (1 = 1er, …)
            </label>
            <div className="space-y-2">
              {presentPlayers.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--surface)' }}>
                  <span className="flex-1 font-medium">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPosition(p.id, (positions[p.id] ?? 0) - 1)}
                      className="p-1 rounded hover:opacity-80"
                      style={{ color: 'var(--muted)' }}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <span className="w-8 text-center font-bold" style={{ color: 'var(--accent-gold)' }}>
                      {positions[p.id] ?? '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPosition(p.id, (positions[p.id] ?? 0) + 1)}
                      className="p-1 rounded hover:opacity-80"
                      style={{ color: 'var(--muted)' }}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                  <select
                    value={positions[p.id] ?? ''}
                    onChange={(e) => e.target.value && setPosition(p.id, Number(e.target.value))}
                    className="rounded px-2 py-1 text-sm"
                    style={{ backgroundColor: 'var(--surface2)', color: 'var(--text)', border: 'none' }}
                  >
                    <option value="">—</option>
                    {Array.from({ length: presentPlayers.length }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}e</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Heads-up timer toggle */}
        {presentPlayers.length >= 2 && (
          <div className="flex items-center justify-between rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--surface)' }}>
            <span className="text-sm font-medium">Heads-up timer utilisé ?</span>
            <button
              type="button"
              onClick={() => setHeadsUpTimer(!headsUpTimer)}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
              style={{
                backgroundColor: headsUpTimer ? 'var(--accent-gold)' : 'var(--surface2)',
                color: headsUpTimer ? '#0f1117' : 'var(--muted)',
              }}
            >
              {headsUpTimer ? 'Oui' : 'Non'}
            </button>
          </div>
        )}

        {/* Heads-up timer component */}
        {headsUpTimer && presentPlayers.length >= 2 && (
          <HeadsUpTimer />
        )}

        {/* Chip counts for last 2 players if timer used */}
        {headsUpTimer && presentPlayers.length >= 2 && (
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: 'var(--muted)' }}>
              Chip counts (2 derniers joueurs)
            </label>
            <div className="space-y-2">
              {presentPlayers
                .filter((p) => positions[p.id] && positions[p.id] >= presentPlayers.length - 1)
                .map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="w-32 text-sm font-medium">{p.name}</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="Chips"
                      value={chipCounts[p.id] ?? ''}
                      onChange={(e) => setChipCounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="flex-1 rounded-lg px-4 py-2 text-sm"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--surface2)' }}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Score preview */}
        {previewEntries.length > 0 && <ScorePreview entries={previewEntries} />}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>Note (optionnelle)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Commentaire sur la partie…"
            className="w-full rounded-lg px-4 py-3 text-sm resize-none"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--surface2)' }}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-gold)', color: '#0f1117' }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer la partie'}
        </button>
      </form>
    </div>
  );
}
