import { env } from "./env";
import { getAthlete, updateTokens, type AthleteRow } from "./db";
import type { HrZones, Streams } from "./analysis";

const API = "https://www.strava.com/api/v3";
export const SCOPES = "read,activity:read_all,profile:read_all";

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env.stravaClientId,
    redirect_uri: `${env.appUrl}/api/auth/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: SCOPES,
    state,
  });
  return `https://www.strava.com/oauth/authorize?${p}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname: string; lastname: string };
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.stravaClientId,
      client_secret: env.stravaClientSecret,
      ...body,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Strava OAuth falhou (${res.status}): ${await res.text()}`);
  return res.json();
}

export const exchangeCode = (code: string) =>
  tokenRequest({ code, grant_type: "authorization_code" });

/** Devolve um access token válido, renovando-o se estiver a menos de 5 min de expirar. */
export async function accessTokenFor(athlete: AthleteRow): Promise<string> {
  if (athlete.expires_at - 300 > Date.now() / 1000) return athlete.access_token;
  const t = await tokenRequest({ refresh_token: athlete.refresh_token, grant_type: "refresh_token" });
  await updateTokens(athlete.id, t.access_token, t.refresh_token, t.expires_at);
  return t.access_token;
}

export class StravaError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class StravaClient {
  constructor(private token: string) {}

  static async forAthlete(id: number) {
    const athlete = await getAthlete(id);
    if (!athlete) throw new Error(`Atleta ${id} não conectado`);
    return new StravaClient(await accessTokenFor(athlete));
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: "no-store",
    });
    if (res.status === 429) {
      throw new StravaError(429, "Limite de requisições do Strava atingido; tente em 15 min.");
    }
    if (!res.ok) throw new StravaError(res.status, `Strava GET ${path} falhou (${res.status})`);
    return res.json() as Promise<T>;
  }

  listActivities(afterEpoch: number, page = 1, perPage = 100) {
    return this.get<StravaActivity[]>(
      `/athlete/activities?after=${afterEpoch}&page=${page}&per_page=${perPage}`,
    );
  }

  getActivity(id: number) {
    return this.get<StravaActivity>(`/activities/${id}`);
  }

  async getStreams(id: number): Promise<Streams | null> {
    const keys = "time,distance,heartrate,velocity_smooth,grade_smooth,altitude,moving";
    const raw = await this.get<Record<string, { data: unknown[] }>>(
      `/activities/${id}/streams?keys=${keys}&key_by_type=true`,
    );
    if (!raw.time || !raw.distance) return null;
    return {
      time: raw.time.data as number[],
      distance: raw.distance.data as number[],
      heartrate: raw.heartrate?.data as number[] | undefined,
      velocity: raw.velocity_smooth?.data as number[] | undefined,
      grade: raw.grade_smooth?.data as number[] | undefined,
      altitude: raw.altitude?.data as number[] | undefined,
      moving: raw.moving?.data as boolean[] | undefined,
    };
  }

  async getHrZones(): Promise<HrZones | null> {
    const z = await this.get<{ heart_rate?: { zones?: HrZones } }>(`/athlete/zones`);
    return z.heart_rate?.zones?.length ? z.heart_rate.zones : null;
  }
}

/** Campos da atividade do Strava usados pelo app. */
export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  average_cadence?: number;
  has_heartrate?: boolean;
  athlete: { id: number };
}

/* ---------- Assinatura do webhook (uma por app do Strava) ---------- */

export interface PushSubscription {
  id: number;
  callback_url: string;
}

const PUSH = "https://www.strava.com/api/v3/push_subscriptions";

export async function listPushSubscriptions(): Promise<PushSubscription[]> {
  const p = new URLSearchParams({
    client_id: env.stravaClientId,
    client_secret: env.stravaClientSecret,
  });
  const res = await fetch(`${PUSH}?${p}`, { cache: "no-store" });
  if (!res.ok) throw new StravaError(res.status, `Falha ao consultar o webhook (${res.status})`);
  return res.json();
}

export const webhookCallbackUrl = () => `${env.appUrl}/api/webhook`;

/** Cria a assinatura. O Strava chama GET /api/webhook para validar antes de responder. */
export async function createPushSubscription(): Promise<PushSubscription> {
  const body = new URLSearchParams({
    client_id: env.stravaClientId,
    client_secret: env.stravaClientSecret,
    callback_url: webhookCallbackUrl(),
    verify_token: env.webhookVerifyToken,
  });
  const res = await fetch(PUSH, { method: "POST", body, cache: "no-store" });
  if (!res.ok) throw new StravaError(res.status, `Strava recusou o webhook (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function deletePushSubscription(id: number): Promise<void> {
  const p = new URLSearchParams({
    client_id: env.stravaClientId,
    client_secret: env.stravaClientSecret,
  });
  const res = await fetch(`${PUSH}/${id}?${p}`, { method: "DELETE", cache: "no-store" });
  if (!res.ok && res.status !== 404) throw new StravaError(res.status, `Falha ao remover o webhook (${res.status})`);
}
