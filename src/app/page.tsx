import Link from "next/link";
import { computeLoad } from "@/lib/analysis";
import { verdictOf } from "@/lib/coach";
import { getAthlete, listActivities } from "@/lib/db";
import { myPlan } from "@/lib/my-plan";
import { RUN_TYPES, toSummary } from "@/lib/pipeline";
import { nextWorkout, todayLocal, weekFor } from "@/lib/plan";
import { requireAthleteId } from "@/lib/session";
import { dateBR, Icon, km, LoadCard, runLine, WeekStrip, type DayState } from "@/components/ui";
import { toggleSkip } from "./actions";

export const dynamic = "force-dynamic";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sync?: string; erro?: string }>;
}) {
  const athleteId = await requireAthleteId();
  const { sync, erro } = await searchParams;
  const [all, athlete, { plan }] = await Promise.all([
    listActivities(athleteId, 56),
    getAthlete(athleteId),
    myPlan(athleteId),
  ]);
  const runs = all.filter((r) => RUN_TYPES.has(r.sport_type));
  const load = computeLoad(all.map(toSummary));
  const today = todayLocal();
  const week = weekFor(today, plan);
  const runByDate = new Map(runs.map((r) => [(r.start_date_local ?? "").slice(0, 10), r]));
  const todayRun = runByDate.get(today);
  const next = nextWorkout(today, plan);
  const isToday = next?.date === today;

  const states: Record<string, DayState> = {};
  if (week) {
    for (const r of runs) {
      const d = (r.start_date_local ?? "").slice(0, 10);
      if (d >= week.start) states[d] = "extra";
    }
    for (const w of week.workouts) {
      states[w.date] = runByDate.has(w.date) ? "feito" : w.skipped ? "pulado" : w.date < today ? "perdido" : "planejado";
    }
  }
  const weekDone = week?.workouts.filter((w) => runByDate.has(w.date)).length ?? 0;
  const weekKmDone = week
    ? runs.filter((r) => (r.start_date_local ?? "") >= week.start).reduce((s, r) => s + r.distance_m / 1000, 0)
    : 0;
  const weekKmPlan = week?.workouts.filter((w) => !w.skipped).reduce((s, w) => s + w.km, 0) ?? 0;

  return (
    <main className="app">
      <header className="top">
        <div>
          <div className="small muted">{greeting()}{athlete?.firstname ? `, ${athlete.firstname}` : ""}</div>
          <h1>Hoje</h1>
        </div>
        <form action="/api/sync" method="post">
          <button className="iconbtn" type="submit" aria-label="Sincronizar com o Strava" title="Sincronizar">
            <Icon name="sync" />
          </button>
        </form>
      </header>

      {sync && <p className="notice">Sincronizado: {sync} atividades importadas.</p>}
      {erro && <p className="notice">Não foi possível sincronizar com o Strava agora. Tente de novo em alguns minutos.</p>}

      {todayRun ? (
        <section className="hero done">
          <div className="eyebrow">Treino de hoje feito <Icon name="check" size={16} /></div>
          <div className="big">{km(todayRun.distance_m / 1000, 1)}</div>
          <div className="sub">{runLine(todayRun)}</div>
          {verdictOf(todayRun.feedback) && <p className="small">{verdictOf(todayRun.feedback)}</p>}
          <div className="actions">
            <Link className="btn light" href={`/corridas/${todayRun.id}`}>Ver análise</Link>
          </div>
        </section>
      ) : next ? (
        <section className="hero">
          <div className="eyebrow">{isToday ? "Treino de hoje" : `Próximo treino · ${dateBR(next.date)}`}</div>
          <div className="big">{km(next.km)}</div>
          <div className="title">{next.type}</div>
          <div className="sub">{next.structure}</div>
          <div className="pill">{next.target}</div>
          <div className="actions">
            <Link className="btn light" href={`/treino/${next.plannedDate}`}>
              <Icon name="edit" size={18} /> Ajustar
            </Link>
            <form action={toggleSkip}>
              <input type="hidden" name="plannedDate" value={next.plannedDate} />
              <input type="hidden" name="back" value="/" />
              <button className="btn outline" type="submit">
                <Icon name="skip" size={18} /> Pular
              </button>
            </form>
          </div>
        </section>
      ) : (
        <section className="hero">
          <div className="eyebrow">Planilha concluída</div>
          <div className="title">Peça ao treinador o próximo ciclo.</div>
        </section>
      )}

      {week && (
        <section className="card">
          <div className="row">
            <h2>{week.label}</h2>
            <Link className="small" href="/plano">Ver plano</Link>
          </div>
          <WeekStrip start={week.start} today={today} states={states} />
          <div className="progress" aria-label="Progresso da semana">
            <i style={{ width: `${Math.min(100, (weekKmDone / Math.max(weekKmPlan, 1)) * 100)}%` }} />
          </div>
          <div className="row small muted">
            <span>{weekDone} de {week.workouts.filter((w) => !w.skipped).length} treinos</span>
            <span>{km(weekKmDone, 1)} de {km(weekKmPlan, 1)}</span>
          </div>
        </section>
      )}

      <LoadCard load={load} />

      <section className="card">
        <div className="row">
          <h2>Últimas corridas</h2>
          <Link className="small" href="/corridas">Ver todas</Link>
        </div>
        {runs.length === 0 ? (
          <p className="muted">Nenhuma corrida ainda. Toque em sincronizar para importar do Strava.</p>
        ) : (
          <ul className="list nav">
            {runs.slice(0, 3).map((r) => (
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
