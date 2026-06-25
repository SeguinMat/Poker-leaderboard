const POINTS: Record<number, number> = {
  1: 10,
  2: 6,
  3: 4,
  4: 2,
};

export function getPointsForPosition(position: number): number {
  return POINTS[position] ?? 1;
}

export function getPlayerAverage(totalPoints: number, gamesPlayed: number): number {
  if (gamesPlayed === 0) return 0;
  return totalPoints / gamesPlayed;
}
