import { describe, expect, it } from "vitest";
import { ruleBasedFeedback, type ActivityAnalysis, type LoadResult } from "./index";

const load = (over: Partial<LoadResult> = {}): LoadResult => ({
  asOf: "2026-11-16T12:00:00Z",
  acuteKm: 6,
  chronicWeeklyKm: 11,
  acwr: 0.56,
  status: "destreino",
  weekOverWeekPct: 22,
  weeklyJumpFlag: false,
  weeks: [],
  ...over,
});

const analysis = (zones: number[], over: Partial<ActivityAnalysis> = {}): ActivityAnalysis => ({
  version: 1,
  distanceM: 6080,
  movingTimeS: 2325,
  avgHr: 151,
  avgHrZone: 3,
  timeInZonesS: zones,
  dominantZone: 3,
  elevGainM: 2,
  hilly: false,
  drift: null,
  splits: null,
  ...over,
});

const next = { date: "2026-11-18", type: "Rodagem leve", km: 4.5, structure: "3 km contínuo" };

describe("feedback por regras", () => {
  it("Z2 cumprida", () => {
    const t = ruleBasedFeedback({ analysis: analysis([60, 2000, 200, 0, 0]), load: load(), planned: null, next, previousMisses: 0 });
    expect(t.split("\n")[0]).toBe("Veredito: Estímulo atingido: treino aeróbico em Z2, como planejado.");
    expect(t).toContain("como planejado");
  });

  it("treino em Z3 é sinalizado e, com deriva alta, reduz o próximo", () => {
    const t = ruleBasedFeedback({
      analysis: analysis([0, 400, 1100, 800, 0], {
        drift: {
          firstHalf: { durationS: 900, distanceM: 2400, gapSpeed: 2.69, avgHr: 155 },
          secondHalf: { durationS: 900, distanceM: 2250, gapSpeed: 2.51, avgHr: 161 },
          hrChangePct: 3.9,
          paceChangePct: 7.2,
          decouplingPct: 11.3,
          hrDriftFlag: false,
          decouplingFlag: true,
        },
      }),
      load: load(),
      planned: { date: "2026-11-16", type: "Rodagem leve", km: 6 },
      next,
      previousMisses: 0,
    });
    expect(t).toMatch(/^Veredito: Estímulo não atingido: 83% do tempo acima da Z2/);
    expect(t).toContain("Desacoplamento de 11,3%");
    expect(t).toContain("reduza para 3,5 km");
  });

  it("dois treinos seguidos acima da zona reduzem o próximo", () => {
    const t = ruleBasedFeedback({ analysis: analysis([0, 300, 1500, 500, 0]), load: load(), planned: null, next, previousMisses: 1 });
    expect(t).toContain("dois treinos seguidos acima da zona");
  });

  it("volume abaixo do planejado", () => {
    const t = ruleBasedFeedback({
      analysis: analysis([0, 2000, 100, 0, 0], { distanceM: 3000 }),
      load: load(),
      planned: { date: "2026-11-18", type: "Rodagem leve", km: 4.5 },
      next,
      previousMisses: 0,
    });
    expect(t).toContain("Volume abaixo do planejado (3 de 4,5 km)");
  });
});
