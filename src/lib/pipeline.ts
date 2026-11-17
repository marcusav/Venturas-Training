import {
  analyzeActivity,
  computeLoad,
  DEFAULT_HR_ZONES,
  type ActivitySummary,
  type HrZones,
} from "./analysis";
import { generateFeedback, verdictOf } from "./coach";
import {
  deleteActivity,
  getAthlete,
  listActivities,
  saveAnalysis,
  saveFeedback,
  setHrZones,
  upsertActivity,
  type ActivityRow,
  type ActivityUpsert,
} from "./db";
import { env } from "./env";
import { PLAN, workoutOn } from "./plan";
import { StravaClient, StravaError, type StravaActivity } from "./strava";
import { notifyTelegram } from "./telegram";

export const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

function toRow(a: StravaActivity, athleteId: number): ActivityUpsert {
  return {
    id: a.id,
    athlete_id: athleteId,
    name: a.name,
    sport_type: a.sport_type,
    start_date: new Date(a.start_date),
    start_date_local: a.start_date_local,
    distance_m: a.distance,
    moving_time_s: a.moving_time,
    elapsed_time_s: a.elapsed_time,
    elevation_gain_m: a.total_elevation_gain ?? 0,
    avg_hr: a.average_heartrate ?? null,
    max_hr: a.max_heartrate ?? null,
    avg_speed: a.average_speed ?? null,
    avg_cadence: a.average_cadence ?? null,
  };
}

export function toSummary(r: ActivityRow): ActivitySummary {
  return {
    id: r.id,
    startDate: r.start_date.toISOString(),
    distanceM: r.distance_m,
    movingTimeS: r.moving_time_s,
    sportType: r.sport_type,
  };
}

async function zonesFor(athleteId: number, strava: StravaClient): Promise<HrZones> {
  const athlete = await getAthlete(athleteId);
  if (athlete?.hr_zones?.length) return athlete.hr_zones;
  try {
    const z = await strava.getHrZones();
    if (z) {
      await setHrZones(athleteId, z);
      return z;
    }
  } catch (e) {
    console.warn("Não foi possível ler as zonas do Strava; usando padrão.", e);
  }
  return DEFAULT_HR_ZONES;
}

async function analyze(strava: StravaClient, row: ActivityUpsert, zones: HrZones) {
  const id = row.id;
  const streams = await strava.getStreams(id);
  if (!streams) return null;
  const analysis = analyzeActivity(streams, zones, {
    distanceM: row.distance_m,
    movingTimeS: row.moving_time_s,
    avgHr: row.avg_hr,
    elevGainM: row.elevation_gain_m,
  });
  await saveAnalysis(id, analysis);
  return analysis;
}

/** Busca, analisa e (opcionalmente) gera feedback do Claude para uma atividade. */
export async function processActivity(
  athleteId: number,
  activityId: number,
  opts: { feedback: boolean },
): Promise<void> {
  const strava = await StravaClient.forAthlete(athleteId);
  const a = await strava.getActivity(activityId);
  const row = toRow(a, athleteId);
  await upsertActivity(row);
  if (!RUN_TYPES.has(a.sport_type)) return;

  const zones = await zonesFor(athleteId, strava);
  const analysis = await analyze(strava, row, zones);
  if (!analysis || !opts.feedback) return;
  await feedbackFor(athleteId, activityId);
}

/** Gera (ou regenera) o feedback do Claude a partir do que já está no banco. */
export async function feedbackFor(athleteId: number, activityId: number): Promise<string | null> {
  if (!env.hasClaude) return null;
  const all = await listActivities(athleteId, 60);
  const current = all.find((r) => r.id === activityId);
  if (!current?.analysis) return null;

  const localDate = (current.start_date_local ?? current.start_date.toISOString()).slice(0, 10);
  const load = computeLoad(all.map(toSummary), current.start_date);
  const previous = all
    .filter((r) => r.start_date < current.start_date && RUN_TYPES.has(r.sport_type))
    .slice(0, 2)
    .map((r) => ({
      date: (r.start_date_local ?? "").slice(0, 10),
      verdict: verdictOf(r.feedback),
    }));
  const next =
    PLAN.flatMap((w) => w.workouts).find((w) => w.date > localDate) ?? null;

  const text = await generateFeedback({
    activity: {
      name: current.name,
      date: localDate,
      sportType: current.sport_type,
      avgSpeed: current.avg_speed,
    },
    analysis: current.analysis,
    load,
    planned: workoutOn(localDate),
    next,
    previous,
  });
  await saveFeedback(activityId, text);
  const url = `${env.appUrl}/corridas/${activityId}`;
  await notifyTelegram(`🏃 ${current.name ?? "Corrida"} (${localDate})\n\n${text}\n\n${url}`);
  return text;
}

/** Importa as atividades recentes e analisa as corridas que ainda não têm análise. */
export async function syncRecent(athleteId: number, days = 42, maxAnalyses = 12) {
  const strava = await StravaClient.forAthlete(athleteId);
  const after = Math.floor(Date.now() / 1000) - days * 86400;
  const acts = await strava.listActivities(after);
  for (const a of acts) await upsertActivity(toRow(a, athleteId));

  const stored = await listActivities(athleteId, days + 1);
  const pending = stored
    .filter((r) => RUN_TYPES.has(r.sport_type) && !r.analysis)
    .slice(0, maxAnalyses);
  if (pending.length) {
    const zones = await zonesFor(athleteId, strava);
    for (const r of pending) await analyze(strava, r, zones);
  }
  return { imported: acts.length, analyzed: pending.length };
}

/**
 * Remove a atividade só se ela realmente não existir mais no Strava
 * (os eventos do webhook não são assinados, então confirmamos antes de apagar).
 */
export async function removeActivity(athleteId: number, activityId: number) {
  const strava = await StravaClient.forAthlete(athleteId);
  try {
    await strava.getActivity(activityId);
    return; // ainda existe: mantém
  } catch (e) {
    if (e instanceof StravaError && e.status === 404) await deleteActivity(activityId);
    else throw e;
  }
}
