/**
 * Pace ajustado ao desnível (GAP) pelo custo energético de Minetti et al. (2002).
 * C(i) em J/kg/m, com i = inclinação como fração (0.05 = 5%). No plano, C = 3.6.
 * O fator multiplica a velocidade real para obter a velocidade equivalente no plano.
 */
export function minettiCost(gradeFraction: number): number {
  const i = Math.max(-0.45, Math.min(0.45, gradeFraction));
  return (
    155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6
  );
}

export function gapFactor(gradePercent: number): number {
  return minettiCost(gradePercent / 100) / 3.6;
}

/** Velocidade ajustada ao desnível (m/s) para cada amostra. */
export function gradeAdjustedSpeeds(speeds: number[], gradesPercent?: number[]): number[] {
  if (!gradesPercent) return speeds.slice();
  return speeds.map((v, i) => v * gapFactor(gradesPercent[i] ?? 0));
}
