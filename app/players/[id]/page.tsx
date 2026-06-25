'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Check, X, Camera, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { Player, GameResult, Game } from '@/lib/types';

type ResultWithGame = GameResult & { games: Game; players: Player };

function PlayerAvatar({ player, size = 80 }: { player: { name: string; avatar?: string | null }; size?: number }) {
  if (player.avatar) return <img src={player.avatar} alt={player.name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  return (
    <div className="rounded-full flex items-center justify-center font-medium flex-shrink-0" style={{ width: size, height: size, background: 'var(--surface2)', color: 'var(--text-secondary)', fontSize: size * 0.38 }}>
      {player.name[0]?.toUpperCase()}
    </div>
  );
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function PlayerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [player, setPlayer] = useState<Player | null>(null);
  const [results, setResults] = useState<ResultWithGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    const [pRes, rRes] = await Promise.all([
      supabase.from('players').select('*').eq('id', id).single(),
      supabase.from('game_results').select('*, games(*), players(*)').eq('player_id', id).order('created_at'),
    ]);
    setPlayer(pRes.data as Player);
    setResults((rRes.data ?? []) as ResultWithGame[]);
    setLoading(false);
  }

  function startEdit() {
    if (!player) return;
    setEditName(player.name); setAvatarPreview(null); setAvatarFile(null); setEditing(true);
  }

  function cancelEdit() { setEditing(false); setAvatarFile(null); setAvatarPreview(null); }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file));
  }

  async function saveEdit() {
    if (!player || !editName.trim()) return;
    setSaving(true);
    let avatarUrl = player.avatar;
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop();
      const path = `${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, avatarFile);
      if (!uploadErr) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = data.publicUrl;
      }
    }
    await supabase.from('players').update({ name: editName.trim(), avatar: avatarUrl }).eq('id', id);
    await loadData();
    setEditing(false); setAvatarFile(null); setAvatarPreview(null); setSaving(false);
  }

  async function deletePlayer() {
    setDeleting(true);
    await supabase.from('players').delete().eq('id', id);
    router.push('/players');
  }

  if (loading) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px' }} style={{ height: 52, display: 'flex', alignItems: 'center' }}>
          <Link href="/players" className="btn-ghost" style={{ padding: '6px 10px' }}><ArrowLeft size={16} /></Link>
        </div>
      </div>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px' }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 100, borderRadius: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />)}
        </div>
      </div>
    </div>
  );

  if (!player) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>Joueur introuvable.</div>;

  const played = results.filter((r) => !r.absent);
  const total_points = played.reduce((sum, r) => sum + Number(r.points_earned), 0);
  const average = played.length > 0 ? total_points / played.length : 0;
  const wins = played.filter((r) => r.position === 1).length;
  const podiums = played.filter((r) => r.position && r.position <= 3).length;
  let streak = 0;
  for (const r of [...played].reverse()) { if (r.position === 1) streak++; else break; }

  const chartData: { date: string; average: number }[] = [];
  let cumPts = 0;
  played.forEach((r, i) => {
    cumPts += Number(r.points_earned);
    chartData.push({ date: new Date(r.games?.played_at ?? r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), average: cumPts / (i + 1) });
  });

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Topbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px' }} style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/players" className="btn-ghost" style={{ padding: '6px 10px' }}><ArrowLeft size={16} /></Link>
          <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{player.name}</span>
          {streak >= 2 && <span style={{ fontSize: 13, color: 'var(--accent-gold)' }}>{streak}🔥</span>}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px' }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Profile card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px' }}>
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '2px dashed var(--border-hover)', background: 'var(--surface2)', cursor: 'pointer', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ position: 'relative' }}>
                      <PlayerAvatar player={player} size={72} />
                      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Camera size={18} style={{ color: 'white' }} />
                      </div>
                    </div>
                }
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="input" autoFocus />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEdit} disabled={saving || !editName.trim()} className="btn-primary" style={{ opacity: saving || !editName.trim() ? 0.5 : 1 }}>
                    <Check size={14} />{saving ? 'Sauvegarde…' : 'Sauvegarder'}
                  </button>
                  <button onClick={cancelEdit} className="btn-ghost"><X size={14} />Annuler</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <PlayerAvatar player={player} size={64} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{player.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{played.length} parties jouées</div>
              </div>
              <button onClick={startEdit} className="btn-ghost" style={{ padding: '7px 12px' }}>
                <Pencil size={13} />Modifier
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Parties', value: played.length },
            { label: 'Victoires', value: wins },
            { label: 'Podiums', value: podiums },
            { label: 'Moyenne', value: average.toFixed(2) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-gold)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        {chartData.length >= 2 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 14 }}>Évolution de la moyenne</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface2)', border: 'none', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'var(--muted)' }} formatter={(v) => [Number(v).toFixed(2), 'Moyenne']} />
                <Line type="monotone" dataKey="average" stroke="#f0c040" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#f0c040' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* History */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            Historique
          </div>
          {results.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>Aucune partie.</div>
          ) : (
            [...results].reverse().map((r) => (
              <Link key={r.id} href={`/games/${r.game_id}`} className="row-link"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid var(--bg)' }}
              >
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                    {new Date(r.games?.played_at ?? r.created_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  {r.absent && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Absent</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {!r.absent && r.position && <span style={{ fontSize: 18 }}>{MEDAL[r.position] ?? `${r.position}e`}</span>}
                  {!r.absent && <span className="badge badge-gold">+{r.points_earned} pts</span>}
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Delete */}
        {!editing && (
          <div>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="btn-danger">
                <Trash2 size={14} />Supprimer le joueur
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={deletePlayer} disabled={deleting} className="btn-danger" style={{ background: '#ef444420', borderColor: '#ef4444', opacity: deleting ? 0.5 : 1 }}>
                  {deleting ? 'Suppression…' : 'Confirmer'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="btn-ghost">Annuler</button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
