import type { HrZones, Streams } from "./types";
import { computeDrift, type DriftResult } from "./drift";
import { analyzeSplits, type SplitAnalysis } from "./splits";
import { dominantZone, timeInHrZones, zoneOf } from "./zones";

export * from "./types";
export * from "./drift";
export * from "./splits";
export * from "./zones";
export * from "./load";
export * from "./gap";
export * from "./format";
export * from "./verdict";

export interface ActivityAnalysis {
  version: 1;
  distanceM: number;
  movingTimeS: number;
  avgHr: number | null;
  avgHrZone: number | null;
  timeInZonesS: number[];
  dominantZone: number | null;
  elevGainM: number;
  /** Desnível relevante (>10 m/km): use o GAP para julgar o pace. */
  hilly: boolean;
  drift: DriftResult | null;
  splits: SplitAnalysis | null;
}

export function analyzeActivity(
  s: Streams,
  zones: HrZones,
  meta: { distanceM: number; movingTimeS: number; avgHr?: number | null; elevGainM?: number },
): ActivityAnalysis {
  const tiz = timeInHrZones(s, zones);
  const hasHr = tiz.some((v) => v > 0);
  const avgHr = meta.avgHr ?? null;
  const elevGainM = meta.elevGainM ?? 0;
  return {
    version: 1,
    distanceM: meta.distanceM,
    movingTimeS: meta.movingTimeS,
    avgHr,
    avgHrZone: avgHr ? zoneOf(avgHr, zones) : null,
    timeInZonesS: tiz,
    dominantZone: hasHr ? dominantZone(tiz) : null,
    elevGainM,
    hilly: meta.distanceM > 0 && elevGainM / (meta.distanceM / 1000) > 10,
    drift: computeDrift(s),
    splits: analyzeSplits(s),
  };
}
