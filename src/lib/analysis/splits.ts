import type { Streams } from "./types";
import { gapFactor } from "./gap";

export interface Split {
  km: number; // 1, 2, 3... (o último pode ser parcial)
  distanceM: number;
  timeS: number;
  paceSecPerKm: number;
  gapSecPerKm: number;
  avgHr: number | null;
  elevGainM: number;
}

export type SplitPattern = "negativo" | "constante" | "positivo";

export interface SplitAnalysis {
  splits: Split[];
  pattern: SplitPattern;
  /** Diferença de pace ajustado da 2ª metade sobre a 1ª (%). Positivo = mais lento no fim. */
  halfDiffPct: number;
  /** Coeficiente de variação do pace ajustado entre os km completos (%). */
  cvPct: number;
  /** 1º km (após o aquecimento) >5% mais rápido que a média, e 2ª metade mais lenta. */
  fastStart: boolean;
}

/** Quebra a atividade em parciais de 1 km. */
export function kmSplits(s: Streams): Split[] {
  const out: Split[] = [];
  let startIdx = 0;
  let nextMark = 1000;
  const n = s.time.length;
  const close = (endIdx: number, km: number) => {
    let hrSum = 0, hrT = 0, gapT = 0, gain = 0;
    for (let i = startIdx + 1; i <= endIdx; i++) {
      const dt = s.time[i] - s.time[i - 1];
      const dd = s.distance[i] - s.distance[i - 1];
      if (s.heartrate?.[i]) {
        hrSum += s.heartrate[i] * dt;
        hrT += dt;
      }
      // tempo "no plano" equivalente: distância ajustada / velocidade real
      const f = gapFactor(s.grade?.[i] ?? 0);
      if (dd > 0) gapT += dt / f;
      if (s.altitude) {
        const da = s.altitude[i] - s.altitude[i - 1];
        if (da > 0) gain += da;
      }
    }
    const distanceM = s.distance[endIdx] - s.distance[startIdx];
    const timeS = s.time[endIdx] - s.time[startIdx];
    out.push({
      km,
      distanceM,
      timeS,
      paceSecPerKm: (timeS / distanceM) * 1000,
      gapSecPerKm: ((gapT || timeS) / distanceM) * 1000,
      avgHr: hrT ? hrSum / hrT : null,
      elevGainM: gain,
    });
    startIdx = endIdx;
  };
  for (let i = 1; i < n; i++) {
    if (s.distance[i] >= nextMark) {
      close(i, out.length + 1);
      nextMark += 1000;
    }
  }
  const tail = s.distance[n - 1] - s.distance[startIdx];
  if (tail >= 200) close(n - 1, out.length + 1);
  return out;
}

export function analyzeSplits(s: Streams): SplitAnalysis | null {
  const splits = kmSplits(s);
  const full = splits.filter((x) => x.distanceM >= 950);
  if (full.length < 3) return null;

  // Ignora o 1º km (aquecimento) quando há km suficientes.
  const body = full.length >= 5 ? full.slice(1) : full;
  const half = Math.floor(body.length / 2);
  const avg = (xs: Split[]) => xs.reduce((a, x) => a + x.gapSecPerKm, 0) / xs.length;
  const first = avg(body.slice(0, half));
  const second = avg(body.slice(body.length - half));
  const halfDiffPct = (second / first - 1) * 100;

  const mean = avg(body);
  const sd = Math.sqrt(body.reduce((a, x) => a + (x.gapSecPerKm - mean) ** 2, 0) / body.length);
  const pattern: SplitPattern =
    halfDiffPct < -2 ? "negativo" : halfDiffPct > 2 ? "positivo" : "constante";

  return {
    splits,
    pattern,
    halfDiffPct,
    cvPct: (sd / mean) * 100,
    fastStart: body[0].gapSecPerKm < mean * 0.95 && halfDiffPct > 2,
  };
}
