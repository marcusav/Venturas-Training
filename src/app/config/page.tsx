import Link from "next/link";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { requireAthleteId } from "@/lib/session";
import { listPushSubscriptions, webhookCallbackUrl } from "@/lib/strava";

export const dynamic = "force-dynamic";

async function check<T>(fn: () => Promise<T>): Promise<{ ok: boolean; value?: T; error?: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function Line({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li>
      <div className="row">
        <span>{label}</span>
        <span className={`badge ${ok ? "ok" : "bad"}`}>{ok ? "ok" : "pendente"}</span>
      </div>
      {detail && <div className="small muted">{detail}</div>}
    </li>
  );
}

export default async function Config({
  searchParams,
}: {
  searchParams: Promise<{ webhook?: string; erro?: string }>;
}) {
  await requireAthleteId();
  const { webhook, erro } = await searchParams;
  const db = await check(() => sql()`select count(*)::int as n from activities`);
  const subs = await check(listPushSubscriptions);
  const active = subs.value?.some((s) => s.callback_url === webhookCallbackUrl()) ?? false;

  return (
    <main>
      <header className="top">
        <h1>Configuração</h1>
        <Link href="/ajustes" className="small">‹ Ajustes</Link>
      </header>
      {webhook && <p className="notice">Webhook ativado. As próximas corridas chegam sozinhas.</p>}
      {erro && <p className="notice">{erro}</p>}
      <section className="card">
        <ul className="list">
          <Line ok={db.ok} label="Banco de dados" detail={db.ok ? undefined : db.error} />
          <Line
            ok={env.hasClaude}
            label="Claude API (opcional)"
            detail={env.hasClaude ? "Feedback escrito pelo Claude." : "Sem chave: o feedback é automático, por regras (grátis)."}
          />
          <Line
            ok={active}
            label="Webhook do Strava"
            detail={active ? webhookCallbackUrl() : subs.ok ? "Ainda não ativado." : subs.error}
          />
          <Line ok={Boolean(env.telegram)} label="Telegram (opcional)" />
        </ul>
        {!active && (
          <form action="/api/webhook/subscribe" method="post" style={{ marginTop: 12 }}>
            <button className="btn" type="submit">Ativar webhook do Strava</button>
          </form>
        )}
      </section>
    </main>
  );
}
