'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GameWithResults } from '@/lib/types';

export default function GameDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [game, setGame] = useState<GameWithResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    supabase
      .from('games')
      .select('*, game_results(*, players(*))')
      .eq('id', id)
      .single()
      .then(({ data }: { data: unknown }) => {
        setGame(data as GameWithResults);
        setLoading(false);
      });
  }, [id]);

  async function deleteGame() {
    setDeleting(true);
    await supabase.from('games').delete().eq('id', id);
    router.push('/');
  }

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>Chargement…</div>;
  if (!game) return <div className="p-8 text-center text-red-400">Partie introuvable.</div>;

  const played = [...(game.game_results ?? [])].filter((r) => !r.absent).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const absent = (game.game_results ?? []).filter((r) => r.absent);

  const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" style={{ color: 'var(--muted)' }} className="hover:opacity-80">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--accent-gold)' }}>
          {new Date(game.played_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h1>
      </div>

      {game.heads_up_timer_used && (
        <div className="mb-4 text-sm px-3 py-2 rounded-lg inline-flex items-center gap-2" style={{ backgroundColor: 'var(--surface)', color: 'var(--muted)' }}>
          ⏱️ Timer heads-up utilisé
        </div>
      )}

      {game.notes && (
        <div className="mb-6 rounded-xl px-5 py-4" style={{ backgroundColor: 'var(--surface)' }}>
          <div className="text-sm mb-1" style={{ color: 'var(--muted)' }}>Note</div>
          <p>{game.notes}</p>
        </div>
      )}

      {/* Results */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="px-5 py-4 border-b text-sm font-medium" style={{ borderColor: 'var(--surface2)', color: 'var(--muted)' }}>
          Résultats ({played.length} joueurs)
        </div>
        {played.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between px-5 py-3 border-t"
            style={{ borderColor: 'var(--surface2)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{MEDAL[r.position ?? 99] ?? `${r.position}e`}</span>
              <Link href={`/players/${r.player_id}`} className="font-medium hover:underline">
                {r.players?.name}
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {r.chip_count != null && (
                <span className="text-sm" style={{ color: 'var(--muted)' }}>{r.chip_count} chips</span>
              )}
              <span className="font-semibold" style={{ color: 'var(--accent-gold)' }}>+{r.points_earned} pts</span>
            </div>
          </div>
        ))}
      </div>

      {absent.length > 0 && (
        <div className="rounded-xl px-5 py-4 mb-6 text-sm" style={{ backgroundColor: 'var(--surface)', color: 'var(--muted)' }}>
          Absents : {absent.map((r) => r.players?.name).join(', ')}
        </div>
      )}

      {/* Delete */}
      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="flex items-center gap-2 text-sm text-red-400 hover:opacity-80 transition-opacity"
        >
          <Trash2 size={16} /> Supprimer cette partie
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={deleteGame}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:opacity-80 disabled:opacity-50"
          >
            {deleting ? 'Suppression…' : 'Confirmer la suppression'}
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="text-sm"
            style={{ color: 'var(--muted)' }}
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
