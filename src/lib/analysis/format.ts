/** Converte velocidade (m/s) em pace "m:ss" por km. */
export function paceFromSpeed(speed: number): string {
  if (!Number.isFinite(speed) || speed <= 0) return "—";
  return formatPace(1000 / speed);
}

/** Formata segundos por km como "m:ss". */
export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  let m = Math.floor(secPerKm / 60);
  let s = Math.round(secPerKm - m * 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
