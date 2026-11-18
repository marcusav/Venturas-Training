"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteOverride, getPrefs, listOverrides, saveOverride, savePrefs } from "@/lib/db";
import { myPlan } from "@/lib/my-plan";
import { validDays, type WorkoutOverride } from "@/lib/plan";
import { requireAthleteId } from "@/lib/session";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function context(plannedDate: string) {
  if (!DATE.test(plannedDate)) throw new Error("data inválida");
  const athleteId = await requireAthleteId();
  const { plan } = await myPlan(athleteId);
  const week = plan.find((w) => w.workouts.some((x) => x.plannedDate === plannedDate));
  const workout = week?.workouts.find((x) => x.plannedDate === plannedDate);
  if (!week || !workout) throw new Error("treino não encontrado");
  const existing = (await listOverrides(athleteId)).find((o) => o.plannedDate === plannedDate);
  const base: WorkoutOverride = existing ?? { plannedDate };
  return { athleteId, week, workout, base };
}

function done(plannedDate: string, back?: string) {
  revalidatePath("/", "layout");
  redirect(back && back.startsWith("/") ? back : `/treino/${plannedDate}`);
}

export async function changeKm(formData: FormData) {
  const plannedDate = String(formData.get("plannedDate"));
  const delta = Number(formData.get("delta"));
  const { athleteId, workout, base } = await context(plannedDate);
  const next = Math.min(25, Math.max(1, Math.round((workout.km + delta) * 2) / 2));
  await saveOverride(athleteId, { ...base, km: next === workout.plannedKm ? null : next });
  done(plannedDate);
}

export async function moveWorkout(formData: FormData) {
  const plannedDate = String(formData.get("plannedDate"));
  const date = String(formData.get("date"));
  const { athleteId, week, workout, base } = await context(plannedDate);
  if (!DATE.test(date)) throw new Error("data inválida");
  const taken = week.workouts.some((x) => x.plannedDate !== plannedDate && x.date === date && !x.skipped);
  if (!taken) {
    await saveOverride(athleteId, { ...base, date: date === workout.plannedDate ? null : date });
  }
  done(plannedDate);
}

export async function toggleSkip(formData: FormData) {
  const plannedDate = String(formData.get("plannedDate"));
  const back = formData.get("back")?.toString();
  const { athleteId, workout, base } = await context(plannedDate);
  await saveOverride(athleteId, { ...base, skipped: !workout.skipped });
  done(plannedDate, back);
}

export async function resetWorkout(formData: FormData) {
  const plannedDate = String(formData.get("plannedDate"));
  const { athleteId } = await context(plannedDate);
  await deleteOverride(athleteId, plannedDate);
  done(plannedDate);
}

export async function saveTrainingDays(formData: FormData) {
  const athleteId = await requireAthleteId();
  const days = {
    easy1: Number(formData.get("easy1")),
    easy2: Number(formData.get("easy2")),
    long: Number(formData.get("long")),
  };
  if (!validDays(days)) redirect("/ajustes?erro=dias");
  const prefs = await getPrefs(athleteId);
  await savePrefs(athleteId, { ...prefs, days });
  revalidatePath("/", "layout");
  redirect("/ajustes?ok=dias");
}
