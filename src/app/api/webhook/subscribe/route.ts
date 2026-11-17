import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { currentAthleteId } from "@/lib/session";
import {
  createPushSubscription,
  deletePushSubscription,
  listPushSubscriptions,
  webhookCallbackUrl,
} from "@/lib/strava";

/** Ativa o webhook do Strava apontando para este app (substitui um antigo com outro endereço). */
export async function POST() {
  const id = await currentAthleteId();
  if (!id) return NextResponse.redirect(`${env.appUrl}/login`, { status: 303 });
  try {
    const subs = await listPushSubscriptions();
    const ours = subs.find((s) => s.callback_url === webhookCallbackUrl());
    if (!ours) {
      for (const s of subs) await deletePushSubscription(s.id); // o Strava só permite uma
      await createPushSubscription();
    }
    return NextResponse.redirect(`${env.appUrl}/config?webhook=ok`, { status: 303 });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "erro";
    return NextResponse.redirect(`${env.appUrl}/config?erro=${encodeURIComponent(msg)}`, { status: 303 });
  }
}
