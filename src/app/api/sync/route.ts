import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { syncRecent } from "@/lib/pipeline";
import { currentAthleteId } from "@/lib/session";

export const maxDuration = 60;

export async function POST() {
  const id = await currentAthleteId();
  if (!id) return NextResponse.redirect(`${env.appUrl}/login`, { status: 303 });
  try {
    const r = await syncRecent(id);
    return NextResponse.redirect(`${env.appUrl}/?sync=${r.imported}`, { status: 303 });
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(`${env.appUrl}/?erro=sync`, { status: 303 });
  }
}
