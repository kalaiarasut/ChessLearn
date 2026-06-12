/**
 * Glicko-2 Rating System implementation
 * We use the standard 1500 scale for display.
 */

const TAU = 0.5; // System constant (0.3 to 1.2)

export interface PlayerRating {
  rating: number; // e.g. 1500
  rd: number;     // e.g. 350
  vol: number;    // e.g. 0.06
}

// Internal scale mapping
function toGlicko2(p: PlayerRating) {
  return {
    r: (p.rating - 1500) / 173.7178,
    rd: p.rd / 173.7178,
    vol: p.vol
  };
}

function toOriginal(g2: { r: number, rd: number, vol: number }): PlayerRating {
  return {
    rating: (g2.r * 173.7178) + 1500,
    rd: g2.rd * 173.7178,
    vol: g2.vol
  };
}

// Calculate the new rating for a player given their opponent and outcome (1 win, 0.5 draw, 0 loss)
export function calculateNewRating(player: PlayerRating, opponent: PlayerRating, score: number): PlayerRating {
  const p1 = toGlicko2(player);
  const p2 = toGlicko2(opponent);

  const v = computeV(p1, [p2]);
  const delta = computeDelta(p1, [p2], [score], v);
  const volPrime = computeVolatility(p1, v, delta);
  
  const rdStar = Math.sqrt(p1.rd * p1.rd + volPrime * volPrime);
  
  const newRd = 1 / Math.sqrt(1 / (rdStar * rdStar) + 1 / v);
  const newR = p1.r + (newRd * newRd) * g(p2.rd) * (score - E(p1.r, p2.r, p2.rd));

  return toOriginal({ r: newR, rd: newRd, vol: volPrime });
}

function g(rd: number) {
  return 1 / Math.sqrt(1 + 3 * rd * rd / (Math.PI * Math.PI));
}

function E(r: number, r_j: number, rd_j: number) {
  return 1 / (1 + Math.exp(-g(rd_j) * (r - r_j)));
}

function computeV(p: {r: number, rd: number}, opponents: {r: number, rd: number}[]) {
  let v = 0;
  for (let op of opponents) {
    const e = E(p.r, op.r, op.rd);
    v += g(op.rd) * g(op.rd) * e * (1 - e);
  }
  return 1 / v;
}

function computeDelta(p: {r: number, rd: number}, opponents: {r: number, rd: number}[], scores: number[], v: number) {
  let sum = 0;
  for (let i = 0; i < opponents.length; i++) {
    const op = opponents[i];
    sum += g(op.rd) * (scores[i] - E(p.r, op.r, op.rd));
  }
  return v * sum;
}

function computeVolatility(p: {r: number, rd: number, vol: number}, v: number, delta: number) {
  const a = Math.log(p.vol * p.vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d2 = delta * delta;
    const a2 = p.rd * p.rd + v + ex;
    return (ex * (d2 - a2)) / (2 * a2 * a2) - (x - a) / (TAU * TAU);
  };

  const epsilon = 0.000001;
  let A = a;
  let B = 0;
  
  if (delta * delta > p.rd * p.rd + v) {
    B = Math.log(delta * delta - p.rd * p.rd - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > epsilon) {
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C);
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}
