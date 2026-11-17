import { describe, expect, it } from "vitest";
import {
  analyzeSplits,
  computeDrift,
  computeLoad,
  formatPace,
  gapFactor,
  timeInHrZones,
  DEFAULT_HR_ZONES,
  type Streams,
} from "./index";

/** Gera uma corrida sintética amostrada a cada 5 s. */
function synth(
  totalS: number,
  speedAt: (t: number) => number,
  hrAt: (t: number) => number,
  gradeAt: (t: number) => number = () => 0,
): Streams {
  const s: Streams = { time: [], distance: [], heartrate: [], velocity: [], grade: [] };
  let d = 0;
  for (let t = 0; t <= totalS; t += 5) {
    const v = speedAt(t);
    if (t > 0) d += v * 5;
    s.time.push(t);
    s.distance.push(d);
    s.heartrate!.push(hrAt(t));
    s.velocity!.push(v);
    s.grade!.push(gradeAt(t));
  }
  return s;
}

describe("format", () => {
  it("formata pace", () => {
    expect(formatPace(382.2)).toBe("6:22");
    expect(formatPace(359.6)).toBe("6:00");
  });
});

describe("GAP", () => {
  it("plano = 1, subida > 1, descida leve < 1", () => {
    expect(gapFactor(0)).toBeCloseTo(1, 5);
    expect(gapFactor(5)).toBeGreaterThan(1.2);
    expect(gapFactor(-5)).toBeLessThan(1);
  });
});

describe("deriva cardíaca", () => {
  it("pace constante e FC estável: sem alerta", () => {
    const s = synth(3600, () => 2.6, () => 140);
    const r = computeDrift(s)!;
    expect(Math.abs(r.hrChangePct)).toBeLessThan(0.5);
    expect(r.hrDriftFlag).toBe(false);
    expect(r.decouplingFlag).toBe(false);
  });

  it("mesmo pace com FC subindo ~7%: sinaliza fadiga/desidratação", () => {
    const s = synth(3600, () => 2.6, (t) => 140 + (t / 3600) * 24);
    const r = computeDrift(s)!;
    expect(r.hrChangePct).toBeGreaterThan(5);
    expect(r.hrDriftFlag).toBe(true);
    expect(r.decouplingFlag).toBe(true);
  });

  it("pace cai e FC sobe (padrão do longão de 31/10): desacoplamento alto", () => {
    const s = synth(4500, (t) => (t < 2550 ? 2.7 : 2.48), (t) => (t < 2550 ? 155 : 161));
    const r = computeDrift(s)!;
    expect(r.paceChangePct).toBeGreaterThan(5);
    expect(r.decouplingPct).toBeGreaterThan(10);
    expect(r.hrDriftFlag).toBe(false); // o pace não se manteve
  });

  it("ignora treinos curtos ou sem FC", () => {
    expect(computeDrift(synth(900, () => 2.6, () => 140))).toBeNull();
    const noHr = synth(3600, () => 2.6, () => 140);
    delete noHr.heartrate;
    expect(computeDrift(noHr)).toBeNull();
  });

  it("subida na 2ª metade não é confundida com queda de rendimento (GAP)", () => {
    // 2ª metade em 4% de subida: pace real cai, mas o esforço equivalente é o mesmo.
    const f = gapFactor(4);
    const s = synth(
      3600,
      (t) => (t < 2100 ? 2.6 : 2.6 / f),
      () => 145,
      (t) => (t < 2100 ? 0 : 4),
    );
    const r = computeDrift(s)!;
    expect(Math.abs(r.paceChangePct)).toBeLessThan(1);
  });
});

describe("zonas", () => {
  it("soma o tempo em cada zona", () => {
    const s = synth(600, () => 2.6, (t) => (t < 300 ? 130 : 150));
    const z = timeInHrZones(s, DEFAULT_HR_ZONES);
    expect(Math.abs(z[1] - 300)).toBeLessThanOrEqual(5); // Z2
    expect(Math.abs(z[2] - 300)).toBeLessThanOrEqual(5); // Z3
    expect(z[1] + z[2]).toBe(600);
  });
});

describe("splits", () => {
  it("detecta split positivo por saída forte", () => {
    const s = synth(3000, (t) => (t < 1500 ? 2.9 : 2.5), () => 150);
    const a = analyzeSplits(s)!;
    expect(a.pattern).toBe("positivo");
    expect(a.splits.length).toBeGreaterThanOrEqual(7);
  });

  it("detecta split negativo", () => {
    const s = synth(3000, (t) => (t < 1500 ? 2.5 : 2.8), () => 150);
    expect(analyzeSplits(s)!.pattern).toBe("negativo");
  });

  it("ritmo constante", () => {
    expect(analyzeSplits(synth(3000, () => 2.7, () => 150))!.pattern).toBe("constante");
  });
});

describe("carga (ACWR)", () => {
  const run = (date: string, km: number) => ({
    id: Math.random(),
    startDate: `${date}T10:00:00Z`,
    distanceM: km * 1000,
    movingTimeS: km * 380,
    sportType: "Run",
  });

  it("reproduz o diagnóstico de 17/11/2026 (ACWR ~0,56, destreino)", () => {
    const acts = [
      run("2026-10-24", 5.75),
      run("2026-10-25", 7.28),
      run("2026-10-26", 7.62),
      run("2026-10-31", 11.72),
      run("2026-11-07", 4.98),
      run("2026-11-16", 6.08),
    ];
    const r = computeLoad(acts, new Date("2026-11-17T23:59:00Z"));
    expect(r.acuteKm).toBeCloseTo(6.08, 2);
    expect(r.chronicWeeklyKm).toBeCloseTo(10.86, 1);
    expect(r.acwr!).toBeCloseTo(0.56, 2);
    expect(r.status).toBe("destreino");
    // +22% sobre a semana anterior, mas ainda abaixo da média: retomada, não alerta.
    expect(r.weeklyJumpFlag).toBe(false);
  });

  it("alerta salto semanal >15%", () => {
    const acts = [
      run("2026-11-03", 5),
      run("2026-11-05", 5),
      run("2026-11-10", 8),
      run("2026-11-12", 8),
    ];
    const r = computeLoad(acts, new Date("2026-11-15T23:00:00Z"));
    expect(r.weekOverWeekPct!).toBeCloseTo(60, 0);
    expect(r.weeklyJumpFlag).toBe(true);
  });

  it("sem histórico de 2–4 semanas, não calcula ACWR", () => {
    const r = computeLoad([run("2026-11-10", 5), run("2026-11-15", 8)], new Date("2026-11-16T00:00:00Z"));
    expect(r.acwr).toBeNull();
    expect(r.status).toBeNull();
  });

  it("ignora atividades que não são corrida", () => {
    const r = computeLoad(
      [{ ...run("2026-11-16", 30), sportType: "Ride" }],
      new Date("2026-11-17T00:00:00Z"),
    );
    expect(r.acuteKm).toBe(0);
    expect(r.acwr).toBeNull();
  });
});
