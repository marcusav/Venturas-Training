import { after, NextResponse, type NextRequest } from "next/server";
import { getAthlete } from "@/lib/db";
import { env } from "@/lib/env";
import { processActivity, removeActivity } from "@/lib/pipeline";

/** Verificação da assinatura do webhook (feita uma vez, ao registrar). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === env.webhookVerifyToken) {
    return NextResponse.json({ "hub.challenge": p.get("hub.challenge") });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

// Tempo para buscar streams + gerar o feedback depois da resposta.
export const maxDuration = 60;

interface StravaEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  updates?: Record<string, string>;
}

/**
 * Eventos do Strava. Precisa responder em até 2 s, então o processamento
 * (streams, análise, Claude, Telegram) roda depois da resposta com after().
 */
export async function POST(req: NextRequest) {
  const ev = (await req.json().catch(() => null)) as StravaEvent | null;
  if (!ev || ev.object_type !== "activity") return NextResponse.json({ ok: true });

  const athlete = await getAthlete(ev.owner_id);
  if (!athlete) return NextResponse.json({ ok: true }); // atleta desconhecido: ignora

  after(async () => {
    try {
      if (ev.aspect_type === "delete") {
        await removeActivity(ev.owner_id, ev.object_id);
      } else {
        // Feedback do Claude só na criação; edições (ex.: título) só reanalisam.
        await processActivity(ev.owner_id, ev.object_id, { feedback: ev.aspect_type === "create" });
      }
    } catch (e) {
      console.error("webhook: falha ao processar", ev, e);
    }
  });
  return NextResponse.json({ ok: true });
}
