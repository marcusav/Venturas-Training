import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/strava";

export async function GET() {
  const state = crypto.randomUUID();
  (await cookies()).set("vt_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl(state));
}
