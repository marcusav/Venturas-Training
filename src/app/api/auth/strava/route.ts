import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl } from "@/lib/strava";

export async function GET(req: NextRequest) {
  let url: string;
  try {
    url = authorizeUrl(crypto.randomUUID());
  } catch (e) {
    // Normalmente: variável de ambiente ausente na Vercel. Mostra o motivo na tela de login.
    // Usa a origem da própria requisição, porque APP_URL pode ser justamente a variável ausente.
    const msg = e instanceof Error ? e.message : "Erro de configuração";
    return NextResponse.redirect(new URL(`/login?erro=${encodeURIComponent(msg)}`, req.url));
  }
  const state = new URL(url).searchParams.get("state")!;
  (await cookies()).set("vt_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(url);
}
