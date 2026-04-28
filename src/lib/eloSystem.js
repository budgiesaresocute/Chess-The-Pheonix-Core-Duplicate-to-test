// simplified Glicko-2 style rating system

const DEFAULT_RATING = 400;
const K = 32;

export function getRating(player) {
  return player?.rating ?? DEFAULT_RATING;
}

export function updateElo(playerA, playerB, result) {
  // result:
  // 1 = A win
  // 0 = A loss
  // 0.5 = draw

  const Ra = getRating(playerA);
  const Rb = getRating(playerB);

  const Ea = 1 / (1 + Math.pow(10, (Rb - Ra) / 400));

  const newRa = Ra + K * (result - Ea);

  return {
    ...playerA,
    rating: Math.round(newRa)
  };
}
