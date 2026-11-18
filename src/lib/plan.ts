/**
 * Plano de treino atual. Fica em código para ser fácil de revisar e versionar:
 * o treinador (Claude) atualiza este arquivo quando ajusta a planilha.
 */

export const ATHLETE_GOAL =
  "Saúde e conseguir fazer 1 longo de 15 km por mês. Sem prova-alvo. 3 corridas/semana, longo no sábado (dias ajustáveis no app).";

export const TARGET = {
  z2HrMax: 145,
  z2HrMin: 130,
  note: "A FC manda, não o pace. Em Z2 o pace é livre (provavelmente 6:50–7:20/km no calor do Rio).",
};

export type WorkoutType = "Rodagem leve" | "Leve + strides" | "Longo" | "Longo 15 km";

export interface Workout {
  date: string; // YYYY-MM-DD (horário local)
  type: WorkoutType;
  km: number;
  structure: string;
  target: string;
  /** Data original da planilha (chave das personalizações). */
  plannedDate: string;
  /** Km original da planilha. */
  plannedKm: number;
  skipped?: boolean;
}

export interface PlanWeek {
  start: string; // segunda-feira
  label: string;
  deload?: boolean;
  workouts: Workout[];
}

/** Dias da semana (0 = domingo … 6 = sábado) das 3 corridas. */
export interface TrainingDays {
  easy1: number;
  easy2: number;
  long: number;
}

export const DEFAULT_DAYS: TrainingDays = { easy1: 2, easy2: 4, long: 6 };

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Personalização de um treino, feita pelo atleta no app. */
export interface WorkoutOverride {
  plannedDate: string;
  date?: string | null; // mover para outro dia da mesma semana
  km?: number | null;
  skipped?: boolean;
}

const br = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const Z2 = `Z2: FC ${TARGET.z2HrMin}–${TARGET.z2HrMax} bpm, pace livre`;

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dia da semana (0 = domingo) de uma data YYYY-MM-DD. */
export function weekdayOf(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay();
}

/** Deslocamento a partir da segunda-feira (segunda = 0 … domingo = 6). */
const offsetOf = (weekday: number) => (weekday + 6) % 7;

export function validDays(d: TrainingDays): boolean {
  const all = [d.easy1, d.easy2, d.long];
  return all.every((x) => Number.isInteger(x) && x >= 0 && x <= 6) && new Set(all).size === 3;
}

export function structureFor(type: WorkoutType, km: number): string {
  switch (type) {
    case "Rodagem leve":
      return km > 2 ? `1 km trote bem leve, ${br(km - 1.5)} km contínuo, 0,5 km solto` : "Trote leve contínuo";
    case "Leve + strides":
      return km > 2
        ? `1 km aquecimento, ${br(km - 1.5)} km Z2, 4×20 s strides soltos, 0,5 km solto`
        : "Trote leve + 4×20 s strides soltos";
    case "Longo 15 km":
      return "Tudo em Z2. Hidratação a cada 20–25 min. Caminhe 30 s se a FC passar de 145";
    case "Longo":
      return "Tudo em Z2. Caminhe 30 s se a FC passar de 145. Saia cedo por causa do calor";
  }
}

interface WeekTemplate {
  start: string;
  label: string;
  easy1: number;
  easy2: number;
  long: number;
  deload?: boolean;
  /** Dias fixos só desta semana (sobrepõe a preferência). */
  days?: TrainingDays;
}

function makeWorkout(date: string, type: WorkoutType, km: number): Workout {
  return {
    date,
    type,
    km,
    structure: structureFor(type, km),
    target: type === "Leve + strides" ? `${Z2}; strides sem forçar` : Z2,
    plannedDate: date,
    plannedKm: km,
  };
}

function buildWeek(t: WeekTemplate, prefs: TrainingDays): PlanWeek {
  const d = t.days ?? prefs;
  const workouts = [
    makeWorkout(addDays(t.start, offsetOf(d.easy1)), "Rodagem leve", t.easy1),
    makeWorkout(addDays(t.start, offsetOf(d.easy2)), "Leve + strides", t.easy2),
    makeWorkout(addDays(t.start, offsetOf(d.long)), t.long >= 15 ? "Longo 15 km" : "Longo", t.long),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return { start: t.start, label: t.label, deload: t.deload, workouts };
}

const TEMPLATE: WeekTemplate[] = [
  // Semana 1 excepcional: quarta, quinta e sábado.
  { start: "2026-11-16", label: "Semana 1: retomada", easy1: 4.5, easy2: 5, long: 6, days: { easy1: 3, easy2: 4, long: 6 } },
  { start: "2026-11-23", label: "Semana 2", easy1: 6, easy2: 6, long: 7.5 },
  { start: "2026-11-30", label: "Semana 3", easy1: 6.5, easy2: 6.5, long: 9 },
  { start: "2026-12-07", label: "Semana 4: alívio", easy1: 5, easy2: 5, long: 7, deload: true },
  { start: "2026-12-14", label: "Semana 5", easy1: 7, easy2: 7, long: 11 },
  { start: "2026-12-21", label: "Semana 6", easy1: 7, easy2: 7, long: 13 },
  { start: "2026-12-28", label: "Semana 7: alívio", easy1: 6, easy2: 6, long: 9, deload: true },
  { start: "2027-01-04", label: "Semana 8: primeiro 15 km", easy1: 6, easy2: 6, long: 15 },
];

/** Planilha com os dias escolhidos pelo atleta (sem as personalizações por treino). */
export function buildPlan(prefs: TrainingDays = DEFAULT_DAYS): PlanWeek[] {
  const p = validDays(prefs) ? prefs : DEFAULT_DAYS;
  return TEMPLATE.map((t) => buildWeek(t, p));
}

/** Aplica as personalizações por treino (mudar km, mover dia, pular). */
export function applyOverrides(plan: PlanWeek[], overrides: WorkoutOverride[]): PlanWeek[] {
  const byDate = new Map(overrides.map((o) => [o.plannedDate, o]));
  return plan.map((w) => {
    const end = addDays(w.start, 6);
    const workouts = w.workouts
      .map((x) => {
        const o = byDate.get(x.plannedDate);
        if (!o) return x;
        const km = o.km && o.km > 0 ? Math.round(o.km * 2) / 2 : x.km;
        const date = o.date && o.date >= w.start && o.date <= end ? o.date : x.date;
        return { ...x, km, date, structure: structureFor(x.type, km), skipped: Boolean(o.skipped) };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    return { ...w, workouts };
  });
}

/** Planilha padrão (dias padrão, sem personalizações). */
export const PLAN: PlanWeek[] = buildPlan();

export function weekFor(dateIso: string, plan: PlanWeek[] = PLAN): PlanWeek | null {
  const d = dateIso.slice(0, 10);
  return (
    plan.find((w) => {
      const end = new Date(`${w.start}T12:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 6);
      return d >= w.start && d <= end.toISOString().slice(0, 10);
    }) ?? null
  );
}

export function workoutOn(dateIso: string, plan: PlanWeek[] = PLAN): Workout | null {
  const d = dateIso.slice(0, 10);
  return weekFor(d, plan)?.workouts.find((w) => w.date === d && !w.skipped) ?? null;
}

/** Próximo treino a partir de uma data (inclusive), ignorando os pulados. */
export function nextWorkout(fromIso: string, plan: PlanWeek[] = PLAN): Workout | null {
  const d = fromIso.slice(0, 10);
  return plan.flatMap((w) => w.workouts).find((w) => w.date >= d && !w.skipped) ?? null;
}

/** Data de hoje no fuso do atleta (Rio de Janeiro). */
export function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
