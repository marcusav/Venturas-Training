import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPace, paceFromSpeed, round } from "@/lib/analysis";
import { verdictOf } from "@/lib/coach";
import { getActivity } from "@/lib/db";
import { env } from "@/lib/env";
import { workoutOn } from "@/lib/plan";
import { requireAthleteId } from "@/lib/session";
import { dateBR, runLine, ZoneBar } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Corrida({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const athleteId = await requireAthleteId();
  const id = Number((await params).id);
  const { erro } = await searchParams;
  const r = await getActivity(athleteId, id);
  if (!r) notFound();
  const a = r.analysis;
  const date = (r.start_date_local ?? r.start_date.toISOString()).slice(0, 10);
  const planned = workoutOn(date);
  const verdict = verdictOf(r.feedback);
  const body = r.feedback?.replace(/^\s*veredito:.*\n?/im, "").trim();

  return (
    <main>
      <header className="top">
        <h1>{r.name ?? "Corrida"}</h1>
        <Link href="/">Voltar</Link>
      </header>

      <section className="card">
        <div className="small muted">{dateBR(date)}</div>
        <div>{runLine(r)}</div>
        {planned && (
          <div className="small muted" style={{ marginTop: 6 }}>
            Planejado: {planned.type}, {planned.km} km · {planned.target}
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <a className="small" href={`https://www.strava.com/activities/${r.id}`} target="_blank" rel="noreferrer">
            Abrir no Strava
          </a>
        </div>
      </section>

      <section className="card">
        <h2>Treinador</h2>
        {erro && <p className="notice">Não foi possível gerar o feedback agora. Tente de novo.</p>}
        {r.feedback ? (
          <>
            {verdict && <p className="verdict">Veredito: {verdict}</p>}
            <div className="feedback">{body}</div>
          </>
        ) : (
          <p className="muted">
            {env.hasClaude ? "Ainda sem feedback para esta corrida." : "Configure a ANTHROPIC_API_KEY para receber feedback."}
          </p>
        )}
        {env.hasClaude && (
          <form action={`/api/activities/${r.id}/feedback`} method="post" style={{ marginTop: 10 }}>
            <button className="btn ghost" type="submit">{r.feedback ? "Refazer feedback" : "Gerar feedback"}</button>
          </form>
        )}
      </section>

      {a ? (
        <>
          <section className="card">
            <h2>Zonas de FC</h2>
            <ZoneBar seconds={a.timeInZonesS} />
          </section>

          <section className="card">
            <h2>Deriva cardíaca</h2>
            {a.drift ? (
              <>
                <div className="stats compact">
                  <div className="stat">
                    <b>{paceFromSpeed(a.drift.firstHalf.gapSpeed)} → {paceFromSpeed(a.drift.secondHalf.gapSpeed)}</b>
                    <span>pace ajustado (GAP)</span>
                  </div>
                  <div className="stat">
                    <b>{Math.round(a.drift.firstHalf.avgHr)} → {Math.round(a.drift.secondHalf.avgHr)}</b>
                    <span>FC média</span>
                  </div>
                  <div className="stat">
                    <b style={a.drift.decouplingFlag ? { color: "var(--bad)" } : undefined}>{round(a.drift.decouplingPct)}%</b>
                    <span>desacoplamento</span>
                  </div>
                </div>
                <p className="small muted">
                  1ª vs 2ª metade, depois dos 10 primeiros minutos. Acima de 5% indica fadiga, calor ou base
                  aeróbica ainda curta para essa duração.
                </p>
              </>
            ) : (
              <p className="small muted">Treino curto demais (menos de 20 min úteis) ou sem FC.</p>
            )}
          </section>

          {a.splits && (
            <section className="card">
              <div className="row">
                <h2>Splits</h2>
                <span className="badge">
                  {a.splits.pattern}
                  {a.splits.fastStart ? " · saída forte" : ""}
                </span>
              </div>
              <table>
                <thead>
                  <tr><th>Km</th><th>Pace</th><th>GAP</th><th>FC</th></tr>
                </thead>
                <tbody>
                  {a.splits.splits.map((s) => (
                    <tr key={s.km}>
                      <td>{s.distanceM < 950 ? `${s.km} (${(s.distanceM / 1000).toFixed(2)})` : s.km}</td>
                      <td>{formatPace(s.paceSecPerKm)}</td>
                      <td>{formatPace(s.gapSecPerKm)}</td>
                      <td>{s.avgHr ? Math.round(s.avgHr) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      ) : (
        <p className="notice">Análise ainda não disponível. Toque em Gerar feedback para analisar.</p>
      )}
    </main>
  );
}
