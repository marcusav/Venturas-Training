import { formatDuration, paceFromSpeed, type LoadResult, type LoadStatus } from "@/lib/analysis";

export const ZONE_COLORS = ["var(--z1)", "var(--z2)", "var(--z3)", "var(--z4)", "var(--z5)"];

const STATUS_CLASS: Record<LoadStatus, string> = {
  destreino: "warn",
  ideal: "ok",
  atenção: "warn",
  risco: "bad",
};

const STATUS_TEXT: Record<LoadStatus, string> = {
  destreino: "Volume abaixo do seu normal. Volte a subir aos poucos (até +15% por semana).",
  ideal: "Carga equilibrada: siga o plano.",
  atenção: "Carga subindo rápido. Não acrescente volume extra nesta semana.",
  risco: "Salto de carga alto: risco de lesão. Reduza a próxima sessão.",
};

export function LoadCard({ load }: { load: LoadResult }) {
  const max = Math.max(...load.weeks.map((w) => w.km), 1);
  return (
    <section className="card">
      <div className="row">
        <h2>Carga de treino</h2>
        {load.status && <span className={`badge ${STATUS_CLASS[load.status]}`}>{load.status}</span>}
      </div>
      <div className="stats">
        <div className="stat">
          <b>{km(load.acuteKm, 1)}</b>
          <span>últimos 7 dias</span>
        </div>
        <div className="stat">
          <b>{km(load.chronicWeeklyKm, 1)}</b>
          <span>média/sem (28 d)</span>
        </div>
        <div className="stat">
          <b>{load.acwr === null ? "—" : load.acwr.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
          <span>ACWR</span>
        </div>
      </div>
      {load.status && <p className="small muted">{STATUS_TEXT[load.status]}</p>}
      {load.weeklyJumpFlag && (
        <p className="notice">
          Aumento de {Math.round(load.weekOverWeekPct ?? 0)}% sobre a semana anterior: acima do limite de 15%.
        </p>
      )}
      <div className="bars" aria-label="Quilômetros por semana">
        {load.weeks.map((w) => (
          <div key={w.start} title={`${km(w.km, 1)} em ${w.runs} corridas`}>
            <small>{w.km.toFixed(0)}</small>
            <i style={{ height: `${(w.km / max) * 70}%` }} />
            <small>{w.start.slice(8, 10)}/{w.start.slice(5, 7)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ZoneBar({ seconds }: { seconds: number[] }) {
  const total = seconds.reduce((a, b) => a + b, 0);
  if (!total) return <p className="small muted">Sem dados de frequência cardíaca.</p>;
  return (
    <>
      <div className="zonebar">
        {seconds.map((s, i) => (
          <div key={i} style={{ width: `${(s / total) * 100}%`, background: ZONE_COLORS[i] }} />
        ))}
      </div>
      <div className="legend">
        {seconds.map((s, i) => (
          <span key={i} style={{ ["--c" as string]: ZONE_COLORS[i] }}>
            Z{i + 1} {Math.round((s / total) * 100)}% · {formatDuration(s)}
          </span>
        ))}
      </div>
    </>
  );
}

export function runLine(r: { distance_m: number; moving_time_s: number; avg_speed: number | null; avg_hr: number | null }) {
  const parts = [
    km(r.distance_m / 1000, 2),
    formatDuration(r.moving_time_s),
    r.avg_speed ? `${paceFromSpeed(r.avg_speed)}/km` : null,
    r.avg_hr ? `${Math.round(r.avg_hr)} bpm` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Quilômetros no formato brasileiro (4,5 km). */
export function km(n: number, digits?: number) {
  return `${n.toLocaleString("pt-BR", digits === undefined ? { maximumFractionDigits: 2 } : { minimumFractionDigits: digits, maximumFractionDigits: digits })} km`;
}

export function dateBR(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  const wd = new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", {
    weekday: "short",
    timeZone: "UTC",
  });
  return `${wd.replace(".", "")} ${d}/${m}${y === String(new Date().getFullYear()) ? "" : `/${y}`}`;
}
