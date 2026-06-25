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
    supabase.from('games').select('*, game_results(*, players(*))').eq('id', id).single()
      .then(({ data }: { data: unknown }) => { setGame(data as GameWithResults); setLoading(false); });
  }, [id]);

  async function deleteGame() {
    setDeleting(true);
    await supabase.from('games').delete().eq('id', id);
    router.push('/');
  }

  if (loading) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" className="btn-ghost" style={{ padding: '6px 10px' }}><ArrowLeft size={16} /></Link>
        </div>
      </div>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />)}
      </div>
    </div>
  );

  if (!game) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>Partie introuvable.</div>;

  const played = [...(game.game_results ?? [])].filter((r) => !r.absent).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const absent = (game.game_results ?? []).filter((r) => r.absent);
  const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" className="btn-ghost" style={{ padding: '6px 10px' }}><ArrowLeft size={16} /></Link>
          <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>
            {new Date(game.played_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {game.heads_up_timer_used && (
          <div className="badge" style={{ alignSelf: 'flex-start', padding: '5px 12px' }}>⏱ Timer heads-up utilisé</div>
        )}

        {game.notes && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Note</div>
            <p style={{ color: 'var(--text)', fontSize: 14 }}>{game.notes}</p>
          </div>
        )}

        {/* Results */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            Résultats · {played.length} joueurs
          </div>
          {played.map((r) => (
            <Link key={r.id} href={`/players/${r.player_id}`} className="row-link"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--bg)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22, width: 32 }}>{MEDAL[r.position ?? 99] ?? `${r.position}`}</span>
                <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{r.players?.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {r.chip_count != null && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{r.chip_count} chips</span>}
                <span className="badge badge-gold">+{r.points_earned} pts</span>
              </div>
            </Link>
          ))}
        </div>

        {absent.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            Absents : {absent.map((r) => r.players?.name).join(', ')}
          </div>
        )}

        {/* Delete */}
        <div style={{ paddingTop: 8 }}>
          {!confirm ? (
            <button onClick={() => setConfirm(true)} className="btn-danger">
              <Trash2 size={14} /> Supprimer cette partie
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={deleteGame} disabled={deleting} className="btn-danger" style={{ background: '#ef444420', borderColor: '#ef4444', opacity: deleting ? 0.5 : 1 }}>
                {deleting ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
              <button onClick={() => setConfirm(false)} className="btn-ghost">Annuler</button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
