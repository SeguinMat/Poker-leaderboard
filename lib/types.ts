export interface Player {
  id: string;
  name: string;
  avatar: string;
  created_at: string;
}

export interface Game {
  id: string;
  played_at: string;
  notes: string | null;
  heads_up_timer_used: boolean;
}

export interface GameResult {
  id: string;
  game_id: string;
  player_id: string;
  position: number | null;
  absent: boolean;
  chip_count: number | null;
  points_earned: number;
  created_at: string;
}

export interface PlayerStats {
  player: Player;
  games_played: number;
  total_points: number;
  average: number;
  best_position: number | null;
  wins: number;
  podiums: number;
  current_streak: number;
}

export interface GameWithResults extends Game {
  game_results: (GameResult & { players: Player })[];
}
