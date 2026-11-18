import Link from "next/link";
import { verdictOf } from "@/lib/coach";
import { listActivities } from "@/lib/db";
import { RUN_TYPES } from "@/lib/pipeline";
import { requireAthleteId } from "@/lib/session";
import { dateBR, Icon, runLine } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Corridas() {
  const athleteId = await requireAthleteId();
  const runs = (await listActivities(athleteId, 120)).filter((r) => RUN_TYPES.has(r.sport_type));
  return (
    <main className="app">
      <header className="top">
        <h1>Corridas</h1>
        <form action="/api/sync" method="post">
          <button className="iconbtn" type="submit" aria-label="Sincronizar com o Strava" title="Sincronizar">
            <Icon name="sync" />
          </button>
        </form>
      </header>
      <section className="card">
        {runs.length === 0 ? (
          <p className="muted">Nenhuma corrida ainda. Toque em sincronizar para importar do Strava.</p>
        ) : (
          <ul className="list nav">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/corridas/${r.id}`}>
                  <div>
                    <strong>{r.name ?? "Corrida"}</strong>
                    <div className="small muted">{dateBR(r.start_date_local ?? r.start_date.toISOString())} · {runLine(r)}</div>
                    {verdictOf(r.feedback) && <div className="small">{verdictOf(r.feedback)}</div>}
                  </div>
                  <Icon name="chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
