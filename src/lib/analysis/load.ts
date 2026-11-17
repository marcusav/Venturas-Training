import type { ActivitySummary } from "./types";

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const DAY = 86_400_000;

export type LoadStatus = "destreino" | "ideal" | "atenção" | "risco";

export interface LoadResult {
  asOf: string;
  acuteKm: number; // últimos 7 dias
  chronicWeeklyKm: number; // média semanal dos últimos 28 dias
  acwr: number | null;
  status: LoadStatus | null;
  /** Semana atual (7 dias) vs os 7 dias anteriores (%). */
  weekOverWeekPct: number | null;
  /**
   * Aumento semanal acima de 15% levando a carga acima da média das 4 semanas:
   * zona de risco de lesão. Não dispara ao retomar volume depois de semanas fracas.
   */
  weeklyJumpFlag: boolean;
  weeks: { start: string; km: number; runs: number }[]; // últimas 6 semanas (seg-dom)
}

export function classifyAcwr(acwr: number): LoadStatus {
  if (acwr < 0.8) return "destreino";
  if (acwr <= 1.3) return "ideal";
  if (acwr <= 1.5) return "atenção";
  return "risco";
}

/** Segunda-feira 00:00 (UTC) da semana de uma data. */
function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // 0 = segunda
  return new Date(x.getTime() - dow * DAY);
}

/**
 * ACWR por volume (km) de corrida: carga aguda (7 dias) / média semanal crônica (28 dias).
 * Janelas móveis terminando em `asOf` (inclusive).
 */
export function computeLoad(activities: ActivitySummary[], asOf = new Date()): LoadResult {
  const runs = activities.filter((a) => RUN_TYPES.has(a.sportType));
  const end = asOf.getTime();
  const kmBetween = (fromMs: number, toMs: number) =>
    runs
      .filter((a) => {
        const t = new Date(a.startDate).getTime();
        return t > fromMs && t <= toMs;
      })
      .reduce((sum, a) => sum + a.distanceM / 1000, 0);

  const acuteKm = kmBetween(end - 7 * DAY, end);
  const prevKm = kmBetween(end - 14 * DAY, end - 7 * DAY);
  const chronicWeeklyKm = kmBetween(end - 28 * DAY, end) / 4;
  const acwr = chronicWeeklyKm > 0 ? acuteKm / chronicWeeklyKm : null;
  const weekOverWeekPct = prevKm > 0 ? (acuteKm / prevKm - 1) * 100 : null;

  const thisWeek = weekStart(asOf);
  const weeks = Array.from({ length: 6 }, (_, k) => {
    const start = new Date(thisWeek.getTime() - (5 - k) * 7 * DAY);
    const stop = start.getTime() + 7 * DAY;
    const inWeek = runs.filter((a) => {
      const t = new Date(a.startDate).getTime();
      return t >= start.getTime() && t < stop;
    });
    return {
      start: start.toISOString().slice(0, 10),
      km: inWeek.reduce((s, a) => s + a.distanceM / 1000, 0),
      runs: inWeek.length,
    };
  });

  return {
    asOf: asOf.toISOString(),
    acuteKm,
    chronicWeeklyKm,
    acwr,
    status: acwr === null ? null : classifyAcwr(acwr),
    weekOverWeekPct,
    weeklyJumpFlag:
      weekOverWeekPct !== null && weekOverWeekPct > 15 && acuteKm > 5 && acuteKm > chronicWeeklyKm,
    weeks,
  };
}
