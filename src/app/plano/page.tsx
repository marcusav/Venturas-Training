import Link from "next/link";
import { ATHLETE_GOAL, PLAN, TARGET, todayLocal } from "@/lib/plan";
import { requireAthleteId } from "@/lib/session";
import { dateBR, km } from "@/components/ui";

export default async function Plano() {
  await requireAthleteId();
  const today = todayLocal();
  return (
    <main>
      <header className="top">
        <h1>Plano</h1>
        <Link href="/">Voltar</Link>
      </header>
      <div className="card">
        <p style={{ marginTop: 0 }}>{ATHLETE_GOAL}</p>
        <p className="small muted" style={{ marginBottom: 0 }}>{TARGET.note}</p>
      </div>
      {PLAN.map((w) => {
        const total = w.workouts.reduce((s, x) => s + x.km, 0);
        const past = w.workouts[w.workouts.length - 1].date < today;
        return (
          <section key={w.start} className="card" style={past ? { opacity: 0.6 } : undefined}>
            <div className="row">
              <h2>{w.label}</h2>
              <span className={`badge ${w.deload ? "warn" : ""}`}>{km(total, 1)}</span>
            </div>
            <table>
              <thead>
                <tr><th>Dia</th><th>Treino</th><th>Km</th></tr>
              </thead>
              <tbody>
                {w.workouts.map((x) => (
                  <tr key={x.date}>
                    <td>{dateBR(x.date)}</td>
                    <td>
                      {x.type}
                      <div className="small muted">{x.structure}</div>
                    </td>
                    <td>{x.km.toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
