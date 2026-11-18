import Link from "next/link";
import { notFound } from "next/navigation";
import { listActivities } from "@/lib/db";
import { myPlan } from "@/lib/my-plan";
import { RUN_TYPES } from "@/lib/pipeline";
import { addDays, todayLocal } from "@/lib/plan";
import { requireAthleteId } from "@/lib/session";
import { dateBR, Icon, km, runLine } from "@/components/ui";
import { changeKm, moveWorkout, resetWorkout, toggleSkip } from "../../actions";

export const dynamic = "force-dynamic";

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default async function Treino({ params }: { params: Promise<{ date: string }> }) {
  const athleteId = await requireAthleteId();
  const { date } = await params;
  const { plan } = await myPlan(athleteId);
  const week = plan.find((w) => w.workouts.some((x) => x.plannedDate === date));
  const w = week?.workouts.find((x) => x.plannedDate === date);
  if (!week || !w) notFound();

  const runs = (await listActivities(athleteId, 120)).filter((r) => RUN_TYPES.has(r.sport_type));
  const run = runs.find((r) => (r.start_date_local ?? "").slice(0, 10) === w.date);
  const today = todayLocal();
  const changed = w.km !== w.plannedKm || w.date !== w.plannedDate || w.skipped;
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
  const busy = new Set(week.workouts.filter((x) => x.plannedDate !== date && !x.skipped).map((x) => x.date));
  const hidden = <input type="hidden" name="plannedDate" value={w.plannedDate} />;

  return (
    <main className="app">
      <header className="top">
        <Link href="/plano" className="small">‹ Plano</Link>
      </header>

      <section className={`hero ${w.skipped ? "muted-hero" : ""}`}>
        <div className="eyebrow">{week.label} · {dateBR(w.date)}{w.date === today ? " · hoje" : ""}</div>
        <div className="big">{km(w.km)}</div>
        <div className="title">{w.type}{w.skipped ? " (pulado)" : ""}</div>
        <div className="sub">{w.structure}</div>
        <div className="pill">{w.target}</div>
      </section>

      {run && (
        <Link className="card linkcard" href={`/corridas/${run.id}`}>
          <div>
            <div className="small muted">Corrida feita</div>
            <strong>{runLine(run)}</strong>
          </div>
          <Icon name="chevron" />
        </Link>
      )}

      <section className="card">
        <h2>Distância</h2>
        <div className="stepper">
          <form action={changeKm}>
            {hidden}
            <input type="hidden" name="delta" value="-0.5" />
            <button className="round" type="submit" aria-label="Diminuir 0,5 km" disabled={w.km <= 1}>−</button>
          </form>
          <div className="value">
            <b>{w.km.toLocaleString("pt-BR")}</b> km
            <div className="small muted">planejado: {km(w.plannedKm)}</div>
          </div>
          <form action={changeKm}>
            {hidden}
            <input type="hidden" name="delta" value="0.5" />
            <button className="round" type="submit" aria-label="Aumentar 0,5 km">+</button>
          </form>
        </div>
        {w.km > w.plannedKm * 1.15 && (
          <p className="notice">Mais de 15% acima do planejado. Cuidado com o salto de carga, principalmente no calor.</p>
        )}
      </section>

      <section className="card">
        <h2>Dia</h2>
        <div className="daypicker">
          {days.map((d) => {
            const sel = d === w.date;
            return (
              <form key={d} action={moveWorkout}>
                {hidden}
                <input type="hidden" name="date" value={d} />
                <button type="submit" className={sel ? "sel" : ""} disabled={sel || busy.has(d)} aria-pressed={sel}>
                  <small>{WD[new Date(`${d}T12:00:00Z`).getUTCDay()]}</small>
                  <b>{d.slice(8, 10)}</b>
                </button>
              </form>
            );
          })}
        </div>
        <p className="small muted">Dias com outro treino ficam bloqueados. Evite o longo no dia seguinte a outro treino.</p>
      </section>

      <section className="card buttons">
        <form action={toggleSkip}>
          {hidden}
          <button className="btn wide outline-accent" type="submit">
            <Icon name={w.skipped ? "undo" : "skip"} size={18} /> {w.skipped ? "Voltar a fazer este treino" : "Pular este treino"}
          </button>
        </form>
        {changed && (
          <form action={resetWorkout}>
            {hidden}
            <button className="btn wide ghost" type="submit">
              <Icon name="undo" size={18} /> Restaurar o original
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
