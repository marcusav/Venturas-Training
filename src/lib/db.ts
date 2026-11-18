import postgres from "postgres";
import { env } from "./env";
import type { ActivityAnalysis, HrZones } from "./analysis";
import type { TrainingDays, WorkoutOverride } from "./plan";

declare global {
  // eslint-disable-next-line no-var
  var __sql: postgres.Sql | undefined;
}

/** Conexão única, reaproveitada entre invocações (e no hot reload em dev). */
export function sql(): postgres.Sql {
  if (!globalThis.__sql) {
    // prepare: false é necessário para poolers em "transaction mode" (Supabase/Neon).
    globalThis.__sql = postgres(env.databaseUrl, { max: 3, prepare: false });
  }
  return globalThis.__sql;
}

export interface AthleteRow {
  id: number;
  firstname: string | null;
  lastname: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  hr_zones: HrZones | null;
}

export interface ActivityRow {
  id: number;
  athlete_id: number;
  name: string | null;
  sport_type: string;
  start_date: Date;
  start_date_local: string | null;
  distance_m: number;
  moving_time_s: number;
  elapsed_time_s: number;
  elevation_gain_m: number;
  avg_hr: number | null;
  max_hr: number | null;
  avg_speed: number | null;
  avg_cadence: number | null;
  analysis: ActivityAnalysis | null;
  feedback: string | null;
  feedback_at: Date | null;
}

function normalizeAthlete(r: Record<string, unknown>): AthleteRow {
  return { ...(r as unknown as AthleteRow), id: Number(r.id), expires_at: Number(r.expires_at) };
}

function normalizeActivity(r: Record<string, unknown>): ActivityRow {
  return { ...(r as unknown as ActivityRow), id: Number(r.id), athlete_id: Number(r.athlete_id) };
}

export async function getAthlete(id: number): Promise<AthleteRow | null> {
  const rows = await sql()`select * from athletes where id = ${id}`;
  return rows[0] ? normalizeAthlete(rows[0]) : null;
}

export async function upsertAthlete(a: Omit<AthleteRow, "hr_zones"> & { hr_zones?: HrZones | null }) {
  await sql()`
    insert into athletes (id, firstname, lastname, access_token, refresh_token, expires_at, hr_zones)
    values (${a.id}, ${a.firstname}, ${a.lastname}, ${a.access_token}, ${a.refresh_token},
            ${a.expires_at}, ${a.hr_zones ? sql().json(a.hr_zones) : null})
    on conflict (id) do update set
      firstname = excluded.firstname,
      lastname = excluded.lastname,
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      hr_zones = coalesce(excluded.hr_zones, athletes.hr_zones),
      updated_at = now()`;
}

export async function updateTokens(id: number, access: string, refresh: string, expiresAt: number) {
  await sql()`
    update athletes set access_token = ${access}, refresh_token = ${refresh},
      expires_at = ${expiresAt}, updated_at = now()
    where id = ${id}`;
}

export async function setHrZones(id: number, zones: HrZones) {
  await sql()`update athletes set hr_zones = ${sql().json(zones)}, updated_at = now() where id = ${id}`;
}

export type ActivityUpsert = Omit<ActivityRow, "analysis" | "feedback" | "feedback_at">;

export async function upsertActivity(a: ActivityUpsert) {
  await sql()`
    insert into activities (id, athlete_id, name, sport_type, start_date, start_date_local,
      distance_m, moving_time_s, elapsed_time_s, elevation_gain_m, avg_hr, max_hr, avg_speed, avg_cadence)
    values (${a.id}, ${a.athlete_id}, ${a.name}, ${a.sport_type}, ${a.start_date}, ${a.start_date_local},
      ${a.distance_m}, ${a.moving_time_s}, ${a.elapsed_time_s}, ${a.elevation_gain_m},
      ${a.avg_hr}, ${a.max_hr}, ${a.avg_speed}, ${a.avg_cadence})
    on conflict (id) do update set
      name = excluded.name, sport_type = excluded.sport_type, start_date = excluded.start_date,
      start_date_local = excluded.start_date_local, distance_m = excluded.distance_m,
      moving_time_s = excluded.moving_time_s, elapsed_time_s = excluded.elapsed_time_s,
      elevation_gain_m = excluded.elevation_gain_m, avg_hr = excluded.avg_hr,
      max_hr = excluded.max_hr, avg_speed = excluded.avg_speed, avg_cadence = excluded.avg_cadence,
      updated_at = now()`;
}

export async function saveAnalysis(id: number, analysis: ActivityAnalysis) {
  await sql()`update activities set analysis = ${sql().json(analysis as never)}, updated_at = now() where id = ${id}`;
}

export async function saveFeedback(id: number, feedback: string) {
  await sql()`update activities set feedback = ${feedback}, feedback_at = now(), updated_at = now() where id = ${id}`;
}

export async function deleteActivity(id: number) {
  await sql()`delete from activities where id = ${id}`;
}

export async function getActivity(athleteId: number, id: number): Promise<ActivityRow | null> {
  const rows = await sql()`select * from activities where id = ${id} and athlete_id = ${athleteId}`;
  return rows[0] ? normalizeActivity(rows[0]) : null;
}

export async function listActivities(athleteId: number, sinceDays = 56): Promise<ActivityRow[]> {
  const rows = await sql()`
    select * from activities
    where athlete_id = ${athleteId} and start_date > now() - make_interval(days => ${sinceDays})
    order by start_date desc`;
  return rows.map(normalizeActivity);
}

/* ---------- Personalização ---------- */

declare global {
  // eslint-disable-next-line no-var
  var __schemaV2: Promise<void> | undefined;
}

/** Cria as colunas/tabela de personalização se ainda não existirem (uma vez por instância). */
export function ensurePersonalization(): Promise<void> {
  if (!globalThis.__schemaV2) {
    globalThis.__schemaV2 = (async () => {
      await sql()`alter table athletes add column if not exists prefs jsonb`;
      await sql()`
        create table if not exists workout_overrides (
          athlete_id bigint not null references athletes(id) on delete cascade,
          planned_date date not null,
          new_date date,
          km real,
          skipped boolean not null default false,
          updated_at timestamptz not null default now(),
          primary key (athlete_id, planned_date)
        )`;
    })().catch((e) => {
      globalThis.__schemaV2 = undefined;
      throw e;
    });
  }
  return globalThis.__schemaV2;
}

export interface AthletePrefs {
  days?: TrainingDays;
}

export async function getPrefs(athleteId: number): Promise<AthletePrefs> {
  await ensurePersonalization();
  const rows = await sql()`select prefs from athletes where id = ${athleteId}`;
  return (rows[0]?.prefs as AthletePrefs | null) ?? {};
}

export async function savePrefs(athleteId: number, prefs: AthletePrefs) {
  await ensurePersonalization();
  await sql()`update athletes set prefs = ${sql().json(prefs as never)}, updated_at = now() where id = ${athleteId}`;
}

const isoDate = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

export async function listOverrides(athleteId: number): Promise<WorkoutOverride[]> {
  await ensurePersonalization();
  const rows = await sql()`
    select planned_date::text as planned_date, new_date::text as new_date, km, skipped
    from workout_overrides where athlete_id = ${athleteId}`;
  return rows.map((r) => ({
    plannedDate: isoDate(r.planned_date)!,
    date: isoDate(r.new_date),
    km: r.km == null ? null : Number(r.km),
    skipped: Boolean(r.skipped),
  }));
}

export async function saveOverride(athleteId: number, o: WorkoutOverride) {
  await ensurePersonalization();
  await sql()`
    insert into workout_overrides (athlete_id, planned_date, new_date, km, skipped)
    values (${athleteId}, ${o.plannedDate}, ${o.date ?? null}, ${o.km ?? null}, ${Boolean(o.skipped)})
    on conflict (athlete_id, planned_date) do update set
      new_date = excluded.new_date, km = excluded.km, skipped = excluded.skipped, updated_at = now()`;
}

export async function deleteOverride(athleteId: number, plannedDate: string) {
  await ensurePersonalization();
  await sql()`delete from workout_overrides where athlete_id = ${athleteId} and planned_date = ${plannedDate}`;
}
