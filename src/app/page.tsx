import Link from "next/link";
import { computeLoad } from "@/lib/analysis";
import { verdictOf } from "@/lib/coach";
import { listActivities } from "@/lib/db";
import { RUN_TYPES, toSummary } from "@/lib/pipeline";
import { todayLocal, weekFor } from "@/lib/plan";
import { requireAthleteId } from "@/lib/session";
import { dateBR, km, LoadCard, runLine } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sync?: string; erro?: string }>;
}) {
  const athleteId = await requireAthleteId();
  const { sync, erro } = await searchParams;
  const all = await listActivities(athleteId, 56);
  const runs = all.filter((r) => RUN_TYPES.has(r.sport_type));
  const load = computeLoad(all.map(toSummary));
  const today = todayLocal();
  const week = weekFor(today);
  const runDates = new Set(runs.map((r) => (r.start_date_local ?? "").slice(0, 10)));

  return (
    <main>
      <header className="top">
        <h1>Ventura&apos;s Training</h1>
        <form action="/api/sync" method="post">
          <button className="btn ghost" type="submit">Sincronizar</button>
        </form>
      </header>

      {sync && <p className="notice">Sincronizado: {sync} atividades importadas.</p>}
      {erro && <p className="notice">Não foi possível sincronizar com o Strava agora. Tente de novo em alguns minutos.</p>}

      <section className="card">
        <div className="row">
          <h2>{week ? week.label : "Plano"}</h2>
          <Link className="small" href="/plano">Ver plano</Link>
        </div>
        {week ? (
          <ul className="list">
            {week.workouts.map((w) => {
              const done = runDates.has(w.date);
              const isToday = w.date === today;
              return (
                <li key={w.date} className={`workout ${done ? "done" : ""}`}>
                  <div className="row">
                    <strong>
                      {dateBR(w.date)} · {w.type} · {km(w.km)}
                    </strong>
                    {done ? <span className="check">✓</span> : isToday ? <span className="badge ok">hoje</span> : null}
                  </div>
                  <div className="small muted">{w.structure}</div>
                  <div className="small">{w.target}</div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">Sem plano para esta semana. Peça ao treinador a próxima planilha.</p>
        )}
      </section>

      <LoadCard load={load} />

      <section className="card">
        <h2>Últimas corridas</h2>
        {runs.length === 0 ? (
          <p className="muted">Nenhuma corrida ainda. Toque em Sincronizar para importar do Strava.</p>
        ) : (
          <ul className="list">
            {runs.slice(0, 12).map((r) => {
              const v = verdictOf(r.feedback);
              return (
                <li key={r.id}>
                  <Link href={`/corridas/${r.id}`} style={{ color: "inherit" }}>
                    <div className="row">
                      <strong>{r.name ?? "Corrida"}</strong>
                      <span className="small muted">{dateBR(r.start_date_local ?? r.start_date.toISOString())}</span>
                    </div>
                    <div className="small muted">{runLine(r)}</div>
                    {v && <div className="small">{v}</div>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="row" style={{ justifyContent: "center" }}>
        <Link className="btn ghost" href="/config">Configuração</Link>
        <form action="/api/auth/logout" method="post">
          <button className="btn ghost" type="submit">Sair</button>
        </form>
      </div>
    </main>
  );
}
