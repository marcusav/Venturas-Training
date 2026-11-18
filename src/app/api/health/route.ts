import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const VARS = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "APP_URL",
  "STRAVA_CLIENT_ID",
  "STRAVA_CLIENT_SECRET",
  "STRAVA_WEBHOOK_VERIFY_TOKEN",
  "ALLOWED_ATHLETE_ID",
] as const;

/**
 * Diagnóstico de configuração, público: diz só QUAIS variáveis existem (nunca os valores)
 * e se o banco responde, com a mensagem de erro do Postgres sem a URI.
 */
export async function GET() {
  const vars = Object.fromEntries(VARS.map((v) => [v, Boolean(process.env[v])]));
  let database: { ok: boolean; host?: string; tables?: boolean; error?: string } = { ok: false };
  try {
    // Host e porta do banco (sem usuário e senha), para conferir se é o pooler.
    const u = new URL(process.env.DATABASE_URL ?? "");
    database.host = `${u.hostname}:${u.port || "5432"}`;
  } catch {
    if (process.env.DATABASE_URL) database.host = "URI inválida";
  }
  if (process.env.DATABASE_URL) {
    try {
      const rows = await sql()`select to_regclass('public.activities') is not null as t`;
      database = { ...database, ok: true, tables: Boolean(rows[0]?.t) };
    } catch (e) {
      // Erros de rede às vezes vêm sem mensagem (ex.: AggregateError); inclui código e causas.
      const parts: string[] = [];
      const collect = (x: unknown) => {
        if (!x || typeof x !== "object") return;
        const err = x as { name?: string; code?: string; message?: string; errors?: unknown[]; cause?: unknown };
        parts.push([err.name, err.code, err.message].filter(Boolean).join(" "));
        err.errors?.forEach(collect);
        if (err.cause) collect(err.cause);
      };
      collect(e);
      const msg = parts.filter(Boolean).join(" | ") || String(e);
      // Remove qualquer URI que apareça na mensagem.
      database = { ...database, ok: false, error: msg.replace(/postgres(ql)?:\/\/\S+/gi, "[uri]") };
    }
  } else {
    database = { ok: false, error: "DATABASE_URL ausente" };
  }
  const ok = Object.values(vars).every(Boolean) && database.ok && database.tables === true;
  return NextResponse.json({ ok, vars, database });
}
