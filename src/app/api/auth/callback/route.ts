import { after } from "next/server";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { upsertAthlete } from "@/lib/db";
import { env } from "@/lib/env";
import { syncRecent } from "@/lib/pipeline";
import { createSession } from "@/lib/session";
import { exchangeCode, SCOPES } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const fail = (msg: string) =>
    NextResponse.redirect(`${env.appUrl}/login?erro=${encodeURIComponent(msg)}`);

  const jar = await cookies();
  const expected = jar.get("vt_oauth_state")?.value;
  jar.delete("vt_oauth_state");
  if (!expected || url.searchParams.get("state") !== expected) return fail("Sessão de login expirada, tente de novo.");
  if (url.searchParams.get("error")) return fail("Acesso negado no Strava.");

  const granted = (url.searchParams.get("scope") ?? "").split(",");
  const missing = SCOPES.split(",").filter((s) => !granted.includes(s));
  if (missing.length) return fail(`Marque todas as permissões no Strava (faltou: ${missing.join(", ")}).`);

  const code = url.searchParams.get("code");
  if (!code) return fail("Código de autorização ausente.");

  const t = await exchangeCode(code);
  const athlete = t.athlete;
  if (!athlete) return fail("O Strava não retornou o atleta.");
  if (env.allowedAthleteId && athlete.id !== env.allowedAthleteId) {
    return fail("Este app é pessoal e não está liberado para esta conta.");
  }

  await upsertAthlete({
    id: athlete.id,
    firstname: athlete.firstname,
    lastname: athlete.lastname,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: t.expires_at,
  });
  await createSession(athlete.id);

  // Importa as últimas 6 semanas em segundo plano.
  after(() => syncRecent(athlete.id).catch((e) => console.error("sync inicial falhou", e)));
  return NextResponse.redirect(`${env.appUrl}/`);
}
