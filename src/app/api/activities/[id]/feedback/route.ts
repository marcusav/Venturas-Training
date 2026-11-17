import { NextResponse, type NextRequest } from "next/server";
import { getActivity } from "@/lib/db";
import { env } from "@/lib/env";
import { feedbackFor, processActivity } from "@/lib/pipeline";
import { currentAthleteId } from "@/lib/session";

export const maxDuration = 60;

/** Gera ou refaz o feedback do Claude para uma corrida. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const athleteId = await currentAthleteId();
  if (!athleteId) return NextResponse.redirect(`${env.appUrl}/login`, { status: 303 });
  const id = Number((await ctx.params).id);
  const back = `${env.appUrl}/corridas/${id}`;
  try {
    const row = await getActivity(athleteId, id);
    if (!row) return NextResponse.redirect(`${env.appUrl}/`, { status: 303 });
    if (!row.analysis) await processActivity(athleteId, id, { feedback: false });
    await feedbackFor(athleteId, id);
    return NextResponse.redirect(back, { status: 303 });
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(`${back}?erro=feedback`, { status: 303 });
  }
}
