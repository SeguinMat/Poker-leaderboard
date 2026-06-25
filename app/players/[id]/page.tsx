'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Check, X, Camera, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { Player, GameResult, Game } from '@/lib/types';

type ResultWithGame = GameResult & {
  games: Game;
  players: Player;
};

function Avatar({ player, size = 80 }: { player: { name: string; avatar?: string | null }; size?: number }) {
  if (player.avatar) {
    return (
      <img
        src={player.avatar}
        alt={player.name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: 'var(--accent-green)',
        color: 'white',
        fontSize: size * 0.4,
      }}
    >
      {player.name[0]?.toUpperCase()}
    </div>
  );
}

export default function PlayerProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [player, setPlayer] = useState<Player | null>(null);
  const [results, setResults] = useState<ResultWithGame[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, [id]);

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
    setEditName(player.name);
    setAvatarPreview(null);
    setAvatarFile(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setAvatarFile(null);
    setAvatarPreview(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function deletePlayer() {
    setDeleting(true);
    await supabase.from('players').delete().eq('id', id);
    router.push('/players');
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
    setEditing(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    setSaving(false);
  }

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>Chargement…</div>;
  if (!player) return <div className="p-8 text-center text-red-400">Joueur introuvable.</div>;

  const played = results.filter((r) => !r.absent);
  const total_points = played.reduce((sum, r) => sum + Number(r.points_earned), 0);
  const average = played.length > 0 ? total_points / played.length : 0;
  const wins = played.filter((r) => r.position === 1).length;
  const podiums = played.filter((r) => r.position && r.position <= 3).length;

  let streak = 0;
  for (const r of [...played].reverse()) {
    if (r.position === 1) streak++;
    else break;
  }

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
      </div>

      {/* Profile header */}
      <div className="rounded-xl p-6 mb-6 flex items-center gap-5" style={{ backgroundColor: 'var(--surface)' }}>
        {editing ? (
          <>
            {/* Avatar edit */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative flex-shrink-0 rounded-full overflow-hidden hover:opacity-80 transition-opacity"
              style={{ width: 80, height: 80 }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="relative">
                  <Avatar player={player} size={80} />
                  <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <Camera size={20} style={{ color: 'white' }} />
                  </div>
                </div>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

            <div className="flex-1 flex flex-col gap-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-lg px-4 py-2 text-lg font-bold"
                style={{ backgroundColor: 'var(--surface2)', color: 'var(--text)', border: 'none' }}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={saving || !editName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent-gold)', color: '#0f1117' }}
                >
                  <Check size={14} />
                  {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--surface2)', color: 'var(--muted)' }}
                >
                  <X size={14} />
                  Annuler
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <Avatar player={player} size={80} />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--accent-gold)' }}>
                  {player.name}
                </h1>
                {streak >= 2 && <span style={{ color: 'var(--accent-gold)' }}>{streak}🔥</span>}
              </div>
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 mt-2 text-sm transition-opacity hover:opacity-80"
                style={{ color: 'var(--muted)' }}
              >
                <Pencil size={13} />
                Modifier le profil
              </button>
            </div>
          </>
        )}
      </div>

      {/* Delete */}
      {!editing && (
        <div className="mb-6">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-sm text-red-400 hover:opacity-80 transition-opacity"
            >
              <Trash2 size={14} /> Supprimer le joueur
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={deletePlayer}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:opacity-80 disabled:opacity-50"
              >
                {deleting ? 'Suppression…' : 'Confirmer'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-sm" style={{ color: 'var(--muted)' }}>
                Annuler
              </button>
            </div>
          )}
        </div>
      )}

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
