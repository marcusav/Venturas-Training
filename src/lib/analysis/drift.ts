import type { Streams } from "./types";
import { gapFactor } from "./gap";

export interface HalfStats {
  durationS: number;
  distanceM: number;
  /** Velocidade média ajustada ao desnível (m/s). */
  gapSpeed: number;
  avgHr: number;
}

export interface DriftResult {
  firstHalf: HalfStats;
  secondHalf: HalfStats;
  /** Variação da FC média da 2ª metade sobre a 1ª (%). */
  hrChangePct: number;
  /** Variação do pace ajustado (positivo = mais lento na 2ª metade) (%). */
  paceChangePct: number;
  /** Desacoplamento Pa:FC (%): queda da razão velocidade/FC da 1ª para a 2ª metade. */
  decouplingPct: number;
  /** FC subiu >5% mantendo pace (±3%), critério do protocolo para treinos Z2. */
  hrDriftFlag: boolean;
  /** Desacoplamento >5%, sinal clássico de base aeróbica insuficiente ou fadiga. */
  decouplingFlag: boolean;
}

interface Opts {
  /** Segundos iniciais ignorados (aquecimento / estabilização da FC). */
  warmupS?: number;
  /** Velocidade mínima para considerar a amostra "em movimento" (m/s). */
  minSpeed?: number;
}

/**
 * Compara a 1ª e a 2ª metade (por tempo em movimento) do treino, depois do aquecimento.
 * Retorna null quando não há FC ou dados suficientes (menos de 20 min úteis).
 */
export function computeDrift(s: Streams, opts: Opts = {}): DriftResult | null {
  const warmupS = opts.warmupS ?? 600;
  const minSpeed = opts.minSpeed ?? 1.0;
  const { time, distance, heartrate } = s;
  if (!heartrate || time.length < 10) return null;

  // Amostras úteis: depois do aquecimento, em movimento e com FC válida.
  type Sample = { dt: number; dd: number; hr: number; grade: number };
  const samples: Sample[] = [];
  for (let i = 1; i < time.length; i++) {
    if (time[i] < warmupS) continue;
    const dt = time[i] - time[i - 1];
    const dd = distance[i] - distance[i - 1];
    if (dt <= 0 || dt > 30) continue; // pausas longas não contam
    const v = s.velocity?.[i] ?? dd / dt;
    if (v < minSpeed) continue;
    if (s.moving && s.moving[i] === false) continue;
    const hr = heartrate[i];
    if (!hr || hr < 60) continue;
    samples.push({ dt, dd, hr, grade: s.grade?.[i] ?? 0 });
  }
  const total = samples.reduce((a, x) => a + x.dt, 0);
  if (total < 20 * 60) return null;

  const halves: Sample[][] = [[], []];
  let acc = 0;
  for (const x of samples) {
    halves[acc < total / 2 ? 0 : 1].push(x);
    acc += x.dt;
  }

  const stats = (arr: Sample[]): HalfStats => {
    let dur = 0, dist = 0, gapDist = 0, hrSum = 0;
    for (const x of arr) {
      dur += x.dt;
      dist += x.dd;
      gapDist += x.dd * gapFactor(x.grade);
      hrSum += x.hr * x.dt;
    }
    return { durationS: dur, distanceM: dist, gapSpeed: gapDist / dur, avgHr: hrSum / dur };
  };

  const a = stats(halves[0]);
  const b = stats(halves[1]);
  const hrChangePct = (b.avgHr / a.avgHr - 1) * 100;
  const paceChangePct = (a.gapSpeed / b.gapSpeed - 1) * 100;
  const efA = a.gapSpeed / a.avgHr;
  const efB = b.gapSpeed / b.avgHr;
  const decouplingPct = (efA / efB - 1) * 100;

  return {
    firstHalf: a,
    secondHalf: b,
    hrChangePct,
    paceChangePct,
    decouplingPct,
    hrDriftFlag: hrChangePct > 5 && Math.abs(paceChangePct) <= 3,
    decouplingFlag: decouplingPct > 5,
  };
}
