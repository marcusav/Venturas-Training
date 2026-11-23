import { describe, expect, it } from "vitest";
import { applyOverrides, buildPlan, nextWorkout, PLAN, validDays, weekFor, workoutOn } from "./plan";

describe("plano", () => {
  it("a partir da semana 2, treinos caem em terça, quinta e sábado", () => {
    for (const w of PLAN.slice(2)) {
      const days = w.workouts.map((x) => new Date(`${x.date}T12:00:00Z`).getUTCDay());
      expect(days).toEqual([2, 4, 6]);
    }
  });

  it("semana 2 tem 4 treinos (seg, qua, sex, sáb) e 20 km", () => {
    const w = PLAN[1];
    expect(w.workouts.map((x) => new Date(`${x.date}T12:00:00Z`).getUTCDay())).toEqual([1, 3, 5, 6]);
    expect(w.workouts.map((x) => x.km)).toEqual([4, 5, 4, 7]);
    expect(w.workouts[2].structure).toContain("3,5 km");
    expect(buildPlan({ easy1: 1, easy2: 3, long: 0 })[1].workouts.map((x) => x.date)).toEqual(w.workouts.map((x) => x.date));
  });

  it("semana 1 cai em quarta, quinta e sábado", () => {
    const days = PLAN[0].workouts.map((x) => new Date(`${x.date}T12:00:00Z`).getUTCDay());
    expect(days).toEqual([3, 4, 6]);
  });

  it("primeiro 15 km no sábado 09/01/2027", () => {
    expect(workoutOn("2027-01-09")?.km).toBe(15);
  });

  it("longo nunca cresce mais que ~25% de uma semana normal para a outra", () => {
    const normal = PLAN.filter((w) => !w.deload).map((w) => w.workouts.find((x) => x.type.startsWith("Longo"))!.km);
    for (let i = 1; i < normal.length - 1; i++) {
      expect(normal[i] / normal[i - 1]).toBeLessThanOrEqual(1.26);
    }
  });

  it("encontra a semana de uma data", () => {
    expect(weekFor("2026-11-18")?.label).toContain("Semana 1");
    expect(weekFor("2027-02-01")).toBeNull();
  });

  it("usa os dias escolhidos pelo atleta (semana 1 mantém os dias fixos)", () => {
    const plan = buildPlan({ easy1: 1, easy2: 3, long: 0 }); // seg, qua, dom
    const w2 = plan[2].workouts;
    expect(w2.map((x) => new Date(`${x.date}T12:00:00Z`).getUTCDay())).toEqual([1, 3, 0]);
    expect(w2[2].type).toBe("Longo");
    expect(plan[0].workouts.map((x) => x.date)).toEqual(PLAN[0].workouts.map((x) => x.date));
  });

  it("dias inválidos voltam ao padrão", () => {
    expect(validDays({ easy1: 2, easy2: 2, long: 6 })).toBe(false);
    expect(buildPlan({ easy1: 2, easy2: 2, long: 6 })[1].workouts.map((x) => x.date)).toEqual(
      PLAN[1].workouts.map((x) => x.date),
    );
  });

  it("aplica km, mudança de dia e pulo, só dentro da mesma semana", () => {
    const [a, b, c] = PLAN[2].workouts; // 01/12, 03/12, 05/12
    const plan = applyOverrides(PLAN, [
      { plannedDate: a.plannedDate, km: 7.3 },
      { plannedDate: b.plannedDate, date: "2026-12-06" },
      { plannedDate: c.plannedDate, date: "2026-12-12" }, // fora da semana: ignora
    ]);
    const w = plan[2].workouts;
    expect(w.map((x) => x.date)).toEqual(["2026-12-01", "2026-12-05", "2026-12-06"]);
    expect(w[0].km).toBe(7.5);
    expect(w[0].plannedKm).toBe(6.5);
    expect(w[0].structure).toContain("6 km contínuo");

    const skipped = applyOverrides(PLAN, [{ plannedDate: a.plannedDate, skipped: true }]);
    expect(workoutOn(a.plannedDate, skipped)).toBeNull();
    expect(nextWorkout(a.plannedDate, skipped)?.date).toBe(b.date);
  });
});
