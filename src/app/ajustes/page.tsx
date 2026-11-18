import Link from "next/link";
import { getAthlete } from "@/lib/db";
import { myPlan } from "@/lib/my-plan";
import { WEEKDAYS } from "@/lib/plan";
import { requireAthleteId } from "@/lib/session";
import { Icon } from "@/components/ui";
import { saveTrainingDays } from "../actions";

export const dynamic = "force-dynamic";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // segunda → domingo

function DaySelect({ name, value, label }: { name: string; value: number; label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        {ORDER.map((d) => (
          <option key={d} value={d}>{WEEKDAYS[d]}</option>
        ))}
      </select>
    </label>
  );
}

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const athleteId = await requireAthleteId();
  const { ok, erro } = await searchParams;
  const [athlete, { days }] = await Promise.all([getAthlete(athleteId), myPlan(athleteId)]);

  return (
    <main className="app">
      <header className="top">
        <h1>Ajustes</h1>
      </header>

      {ok && <p className="notice">Dias de treino salvos. O plano já foi atualizado.</p>}
      {erro && <p className="notice">Escolha três dias diferentes.</p>}

      <section className="card">
        <h2>Dias de treino</h2>
        <form action={saveTrainingDays} className="form">
          <DaySelect name="easy1" value={days.easy1} label="Rodagem leve" />
          <DaySelect name="easy2" value={days.easy2} label="Leve + strides" />
          <DaySelect name="long" value={days.long} label="Longo" />
          <p className="small muted">
            Vale para as próximas semanas. Para mudar só um treino, abra-o no Plano. Deixe pelo menos um dia de
            descanso antes do longo.
          </p>
          <button className="btn wide" type="submit">Salvar dias</button>
        </form>
      </section>

      <section className="card">
        <h2>Conta</h2>
        <ul className="list nav">
          <li>
            <div className="row" style={{ padding: "4px 0" }}>
              <span>Strava</span>
              <span className="small muted">{athlete ? `${athlete.firstname ?? ""} ${athlete.lastname ?? ""}`.trim() : ""}</span>
            </div>
          </li>
          <li>
            <form action="/api/sync" method="post">
              <button className="rowbtn" type="submit">
                <span>Sincronizar com o Strava</span>
                <Icon name="sync" />
              </button>
            </form>
          </li>
          <li>
            <Link href="/config">
              <span>Status do app e webhook</span>
              <Icon name="chevron" />
            </Link>
          </li>
          <li>
            <form action="/api/auth/logout" method="post">
              <button className="rowbtn danger" type="submit">
                <span>Sair</span>
              </button>
            </form>
          </li>
        </ul>
      </section>
    </main>
  );
}
