import { getPrefs, listOverrides } from "./db";
import { applyOverrides, buildPlan, DEFAULT_DAYS, type PlanWeek, type TrainingDays } from "./plan";

/** Planilha do atleta: dias escolhidos + ajustes por treino. Cai no padrão se o banco falhar. */
export async function myPlan(athleteId: number): Promise<{ plan: PlanWeek[]; days: TrainingDays }> {
  try {
    const [prefs, overrides] = await Promise.all([getPrefs(athleteId), listOverrides(athleteId)]);
    const days = prefs.days ?? DEFAULT_DAYS;
    return { plan: applyOverrides(buildPlan(days), overrides), days };
  } catch (e) {
    console.error("myPlan", e);
    return { plan: buildPlan(), days: DEFAULT_DAYS };
  }
}
