import { describe, expect, it } from "vitest";
import { PLAN, weekFor, workoutOn } from "./plan";

describe("plano", () => {
  it("a partir da semana 2, treinos caem em terça, quinta e sábado", () => {
    for (const w of PLAN.slice(1)) {
      const days = w.workouts.map((x) => new Date(`${x.date}T12:00:00Z`).getUTCDay());
      expect(days).toEqual([2, 4, 6]);
    }
  });

  it("semana 1 cai em quarta, quinta e sábado", () => {
    const days = PLAN[0].workouts.map((x) => new Date(`${x.date}T12:00:00Z`).getUTCDay());
    expect(days).toEqual([3, 4, 6]);
  });

  it("primeiro 15 km no sábado 09/01/2027", () => {
    expect(workoutOn("2027-01-09")?.km).toBe(15);
  });

  it("longo nunca cresce mais que ~25% de uma semana normal para a outra", () => {
    const normal = PLAN.filter((w) => !w.deload).map((w) => w.workouts[2].km);
    for (let i = 1; i < normal.length - 1; i++) {
      expect(normal[i] / normal[i - 1]).toBeLessThanOrEqual(1.26);
    }
  });

  it("encontra a semana de uma data", () => {
    expect(weekFor("2026-11-18")?.label).toContain("Semana 1");
    expect(weekFor("2027-02-01")).toBeNull();
  });
});
