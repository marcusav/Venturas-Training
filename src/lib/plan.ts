/**
 * Plano de treino atual. Fica em código para ser fácil de revisar e versionar:
 * o treinador (Claude) atualiza este arquivo quando ajusta a planilha.
 */

export const ATHLETE_GOAL =
  "Saúde e conseguir fazer 1 longo de 15 km por mês. Sem prova-alvo. 3 corridas/semana, longo no domingo.";

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
}

export interface PlanWeek {
  start: string; // segunda-feira
  label: string;
  deload?: boolean;
  workouts: Workout[];
}

const br = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const Z2 = `Z2: FC ${TARGET.z2HrMin}–${TARGET.z2HrMax} bpm, pace livre`;

function week(
  start: string,
  label: string,
  wed: number,
  fri: number,
  sun: number,
  deload = false,
): PlanWeek {
  const add = (days: number) => {
    const d = new Date(`${start}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const isGoal = sun >= 15;
  return {
    start,
    label,
    deload,
    workouts: [
      {
        date: add(2),
        type: "Rodagem leve",
        km: wed,
        structure: `1 km trote bem leve, ${br(wed - 1.5)} km contínuo, 0,5 km solto`,
        target: Z2,
      },
      {
        date: add(4),
        type: "Leve + strides",
        km: fri,
        structure: `1 km aquecimento, ${br(fri - 1.5)} km Z2, 4×20 s strides soltos, 0,5 km solto`,
        target: `${Z2}; strides sem forçar`,
      },
      {
        date: add(6),
        type: isGoal ? "Longo 15 km" : "Longo",
        km: sun,
        structure: isGoal
          ? "Tudo em Z2. Hidratação a cada 20–25 min. Caminhe 30 s se a FC passar de 145"
          : "Tudo em Z2. Caminhe 30 s se a FC passar de 145. Saia cedo por causa do calor",
        target: Z2,
      },
    ],
  };
}

export const PLAN: PlanWeek[] = [
  week("2026-11-16", "Semana 1: retomada", 4.5, 5, 6),
  week("2026-11-23", "Semana 2", 5, 5, 7),
  week("2026-11-30", "Semana 3", 5, 5.5, 8),
  week("2026-12-07", "Semana 4: alívio", 4, 4, 6, true),
  week("2026-12-14", "Semana 5", 5.5, 5.5, 10),
  week("2026-12-21", "Semana 6", 5.5, 6, 11.5),
  week("2026-12-28", "Semana 7: alívio", 5, 5, 8, true),
  week("2027-01-04", "Semana 8: primeiro 15 km", 5, 5, 15),
];

export function weekFor(dateIso: string): PlanWeek | null {
  const d = dateIso.slice(0, 10);
  return (
    PLAN.find((w) => {
      const end = new Date(`${w.start}T12:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 6);
      return d >= w.start && d <= end.toISOString().slice(0, 10);
    }) ?? null
  );
}

export function workoutOn(dateIso: string): Workout | null {
  const d = dateIso.slice(0, 10);
  return weekFor(d)?.workouts.find((w) => w.date === d) ?? null;
}

/** Data de hoje no fuso do atleta (Rio de Janeiro). */
export function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
