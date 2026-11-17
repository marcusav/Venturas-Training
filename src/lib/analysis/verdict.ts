import type { ActivityAnalysis } from "./index";
import type { LoadResult } from "./load";
import { round } from "./format";

/** Treino planejado, no formato mínimo usado pelas regras. */
export interface PlannedLite {
  date: string;
  type: string;
  km: number;
  structure?: string;
}

export interface VerdictInput {
  analysis: ActivityAnalysis;
  load: LoadResult;
  planned: PlannedLite | null;
  next: PlannedLite | null;
  /** Quantos dos 2 treinos anteriores já ficaram acima da zona-alvo. */
  previousMisses: number;
}

const pct = (n: number) => `${Math.round(n)}%`;
const br = (n: number, d = 1) => round(n, d).toLocaleString("pt-BR");
const kmBR = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Fração do tempo com FC acima da Z2 (Z3 ou mais), em %. Null se não houver FC. */
export function aboveZ2Pct(a: ActivityAnalysis): number | null {
  const total = a.timeInZonesS.reduce((s, v) => s + v, 0);
  if (!total) return null;
  return (a.timeInZonesS.slice(2).reduce((s, v) => s + v, 0) / total) * 100;
}

/** O treino ficou acima da zona-alvo (mais da metade do tempo acima da Z2)? */
export function missedTarget(a: ActivityAnalysis | null): boolean {
  const hi = a ? aboveZ2Pct(a) : null;
  return hi !== null && hi > 50;
}

/**
 * Feedback pós-treino por regras (sem IA), seguindo o protocolo do projeto:
 * veredito objetivo, análise (zona, deriva, splits, carga) e ajuste do próximo treino.
 */
export function ruleBasedFeedback(i: VerdictInput): string {
  const a = i.analysis;
  const hi = aboveZ2Pct(a);
  const km = a.distanceM / 1000;
  const bullets: string[] = [];

  // 1. Veredito: o plano atual é todo em Z2.
  let verdict: string;
  if (hi === null) {
    verdict = "Sem frequência cardíaca, não dá para confirmar se o estímulo Z2 foi atingido.";
  } else if (hi <= 20) {
    verdict = "Estímulo atingido: treino aeróbico em Z2, como planejado.";
  } else if (hi <= 50) {
    verdict = `Estímulo parcialmente atingido: ${pct(hi)} do tempo passou da Z2.`;
  } else {
    verdict = `Estímulo não atingido: ${pct(hi)} do tempo acima da Z2, foi um treino moderado, não leve.`;
  }
  if (i.planned && km < i.planned.km * 0.8) {
    verdict += ` Volume abaixo do planejado (${kmBR(km)} de ${kmBR(i.planned.km)} km).`;
  }

  // 2. Zona
  if (a.avgHr) {
    bullets.push(
      `FC média ${Math.round(a.avgHr)} bpm (Z${a.avgHrZone}).` +
        (hi !== null && hi > 20 ? " Para ficar em Z2, diminua o ritmo ou caminhe 30 s quando passar de 145." : ""),
    );
  }

  // 3. Deriva
  const d = a.drift;
  if (d) {
    if (d.hrDriftFlag) {
      bullets.push(
        `Deriva: FC subiu ${pct(d.hrChangePct)} com o mesmo pace. Sinal de fadiga acumulada ou desidratação.`,
      );
    } else if (d.decouplingFlag) {
      bullets.push(
        `Desacoplamento de ${br(d.decouplingPct)}% (FC ${d.hrChangePct >= 0 ? "+" : ""}${br(d.hrChangePct)}%, pace ${br(d.paceChangePct)}% mais lento no fim). A base aeróbica ainda é curta para essa duração; calor também pesa.`,
      );
    } else {
      bullets.push(`Deriva controlada (desacoplamento ${br(d.decouplingPct)}%): boa eficiência aeróbica.`);
    }
  }

  // 4. Splits
  const s = a.splits;
  if (s) {
    if (s.fastStart) bullets.push("Saída forte demais: o início foi mais rápido e o ritmo caiu no fim.");
    else if (s.pattern === "positivo") bullets.push(`Splits positivos: 2ª metade ${br(s.halfDiffPct)}% mais lenta.`);
    else if (s.pattern === "negativo") bullets.push("Splits negativos: terminou mais forte, ótimo controle.");
    else bullets.push("Ritmo constante do início ao fim.");
  }
  if (a.hilly) bullets.push(`Percurso com ${Math.round(a.elevGainM)} m de subida: compare pelo pace ajustado (GAP).`);

  // 5. Carga
  const l = i.load;
  if (l.acwr !== null) {
    const status = {
      destreino: "abaixo do seu normal, suba aos poucos",
      ideal: "carga equilibrada",
      atenção: "carga subindo rápido",
      risco: "salto de carga alto, risco de lesão",
    }[l.status!];
    bullets.push(`ACWR ${br(l.acwr, 2)}: ${status}.`);
  }
  if (l.weeklyJumpFlag) bullets.push(`Volume semanal +${pct(l.weekOverWeekPct ?? 0)} vs a semana anterior (limite: 15%).`);

  // 6. Próximo treino (ajuste dinâmico)
  const fatigue = Boolean(d && (d.hrDriftFlag || d.decouplingPct > 10));
  const loadRisk = l.status === "risco" || l.weeklyJumpFlag;
  const twoMisses = missedTarget(a) && i.previousMisses >= 1;
  let nextText: string;
  if (!i.next) {
    nextText = "Sem próximo treino no plano. Peça a próxima planilha ao treinador.";
  } else {
    const base = `${i.next.type}, ${kmBR(i.next.km)} km`;
    if (loadRisk || fatigue || twoMisses) {
      const reduced = Math.max(3, Math.round(i.next.km * 0.8 * 2) / 2);
      const why = loadRisk ? "carga alta" : twoMisses ? "dois treinos seguidos acima da zona" : "sinais de fadiga";
      nextText = `${base} → reduza para ${kmBR(reduced)} km por causa de ${why}. Tudo em Z2 (FC ≤145), sem pressa.`;
    } else {
      nextText = `${base}, como planejado. ${i.next.structure ?? ""}`.trim();
    }
  }

  return [
    `Veredito: ${verdict}`,
    "",
    "Análise:",
    ...bullets.map((b) => `• ${b}`),
    "",
    "Próximo treino:",
    nextText,
  ].join("\n");
}
