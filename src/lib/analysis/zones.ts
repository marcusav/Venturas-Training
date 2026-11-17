import type { HrZones, Streams } from "./types";

/** Zonas padrão (as do Strava do Ventura em nov/2026), usadas se a API não retornar zonas. */
export const DEFAULT_HR_ZONES: HrZones = [
  { min: 0, max: 116 },
  { min: 117, max: 145 },
  { min: 146, max: 159 },
  { min: 160, max: 174 },
  { min: 175, max: -1 },
];

export function zoneOf(hr: number, zones: HrZones): number {
  for (let z = zones.length - 1; z >= 0; z--) {
    if (hr >= zones[z].min) return z + 1;
  }
  return 1;
}

/** Segundos em cada zona de FC (índice 0 = Z1). */
export function timeInHrZones(s: Streams, zones: HrZones): number[] {
  const out = zones.map(() => 0);
  if (!s.heartrate) return out;
  for (let i = 1; i < s.time.length; i++) {
    const dt = s.time[i] - s.time[i - 1];
    if (dt <= 0 || dt > 30) continue;
    const hr = s.heartrate[i];
    if (!hr) continue;
    out[zoneOf(hr, zones) - 1] += dt;
  }
  return out;
}

/** Zona predominante e zona da FC média. */
export function dominantZone(seconds: number[]): number {
  let best = 0;
  seconds.forEach((v, i) => {
    if (v > seconds[best]) best = i;
  });
  return best + 1;
}
