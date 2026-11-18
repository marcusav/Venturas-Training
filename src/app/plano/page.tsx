import Link from "next/link";
import { listActivities } from "@/lib/db";
import { myPlan } from "@/lib/my-plan";
import { RUN_TYPES } from "@/lib/pipeline";
import { ATHLETE_GOAL, TARGET, todayLocal, WEEKDAYS } from "@/lib/plan";
import { requireAthleteId } from "@/lib/session";
import { dateBR, Icon, km } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Plano() {
  const athleteId = await requireAthleteId();
  const [{ plan, days }, acts] = await Promise.all([myPlan(athleteId), listActivities(athleteId, 120)]);
  const runDates = new Set(acts.filter((r) => RUN_TYPES.has(r.sport_type)).map((r) => (r.start_date_local ?? "").slice(0, 10)));
  const today = todayLocal();
  const dayNames = [days.easy1, days.easy2, days.long].map((d) => WEEKDAYS[d].slice(0, 3)).join(", ");

  return (
    <main className="app">
      <header className="top">
        <h1>Plano</h1>
      </header>
      <section className="card">
        <p style={{ marginTop: 0 }}>{ATHLETE_GOAL}</p>
        <p className="small muted">{TARGET.note}</p>
        <Link className="setting" href="/ajustes">
          <span>Dias de treino <b>{dayNames}</b> (longo: {WEEKDAYS[days.long].toLowerCase()})</span>
          <Icon name="chevron" />
        </Link>
      </section>

      {plan.map((w) => {
        const total = w.workouts.filter((x) => !x.skipped).reduce((s, x) => s + x.km, 0);
        const past = w.workouts[w.workouts.length - 1].date < today;
        return (
          <section key={w.start} className={`card ${past ? "past" : ""}`}>
            <div className="row">
              <h2>{w.label}</h2>
              <span className={`badge ${w.deload ? "warn" : ""}`}>{km(total, 1)}</span>
            </div>
            <ul className="list nav">
              {w.workouts.map((x) => {
                const done = runDates.has(x.date);
                const changed = x.km !== x.plannedKm || x.date !== x.plannedDate;
                return (
                  <li key={x.plannedDate} className={x.skipped ? "skipped" : ""}>
                    <Link href={`/treino/${x.plannedDate}`}>
                      <div className={`dot ${done ? "feito" : x.skipped ? "pulado" : x.date < today ? "perdido" : "planejado"}`} />
                      <div style={{ flex: 1 }}>
                        <strong>{dateBR(x.date)} · {x.type}</strong>
                        <div className="small muted">
                          {km(x.km)}
                          {changed && !x.skipped && <span className="badge">ajustado</span>}
                          {x.skipped && <span className="badge warn">pulado</span>}
                          {done && <span className="badge ok">feito</span>}
                        </div>
                      </div>
                      <Icon name="chevron" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
