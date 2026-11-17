import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";

const COOKIE = "vt_session";
const key = () => new TextEncoder().encode(env.sessionSecret);

export async function createSession(athleteId: number) {
  const token = await new SignJWT({ sub: String(athleteId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: env.appUrl.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 90 * 86400,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function currentAthleteId(): Promise<number | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload.sub ? Number(payload.sub) : null;
  } catch {
    return null;
  }
}

/** Para páginas: manda para /login se não houver sessão. */
export async function requireAthleteId(): Promise<number> {
  const id = await currentAthleteId();
  if (!id) redirect("/login");
  return id;
}
