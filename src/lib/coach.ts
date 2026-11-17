import Anthropic from "@anthropic-ai/sdk";
import {
  formatDuration,
  formatPace,
  paceFromSpeed,
  round,
  type ActivityAnalysis,
  type LoadResult,
} from "./analysis";
import { ATHLETE_GOAL, TARGET, type Workout } from "./plan";

export const COACH_MODEL = "claude-opus-5-5";

const SYSTEM = `Você é um treinador de corrida de rua de elite e fisiologista do exercício, atuando como treinador pessoal do Ventura.
Responda sempre em português do Brasil, em texto simples (sem Markdown, sem tabelas), com frases curtas, pronto para ler no celular.

Estrutura obrigatória:
1. Primeira linha: "Veredito: " seguido de uma frase objetiva dizendo se o estímulo fisiológico esperado foi atingido.
2. "Análise:" com 3 a 5 tópicos começando com "• ", cobrindo: zona/intensidade real, deriva cardíaca e desacoplamento, execução dos splits (saída forte, quebra, negativo/constante) e carga (ACWR). Considere o GAP antes de julgar quedas de ritmo em subidas.
3. "Próximo treino:" o que fazer no próximo treino planejado, ajustado se necessário.

Regras:
- Use apenas os números fornecidos; quando algo for estimativa ou cálculo seu, diga.
- Deriva: FC subindo >5% mantendo o pace em treino Z2 indica fadiga acumulada ou desidratação. Desacoplamento >5% indica base aeróbica ainda insuficiente para aquela duração.
- ACWR: <0,8 destreino; 0,8–1,3 ideal; 1,3–1,5 atenção; >1,5 risco. Aumento semanal >10–15% é zona de risco de lesão.
- Ajuste dinâmico: se houver fadiga excessiva, ou se os dados indicarem que os 2 últimos treinos falharam o alvo, reduza o volume ou a intensidade do próximo treino e diga quanto.
- O objetivo é saúde e consistência; nunca incentive forçar com dor.
- No máximo 180 palavras.`;

export interface CoachInput {
  activity: { name: string | null; date: string; sportType: string; avgSpeed: number | null };
  analysis: ActivityAnalysis;
  load: LoadResult;
  planned: Workout | null;
  next: Workout | null;
  previous: { date: string; verdict: string | null }[];
}

/** Resumo factual em texto, usado como contexto para o Claude (e útil para depuração). */
export function describeForCoach(i: CoachInput): string {
  const a = i.analysis;
  const lines: string[] = [];
  lines.push(`Objetivo do atleta: ${ATHLETE_GOAL}`);
  lines.push(`Alvo de Z2: FC ${TARGET.z2HrMin}–${TARGET.z2HrMax} bpm. ${TARGET.note}`);
  lines.push("");
  lines.push(`Treino: ${i.activity.name ?? "Corrida"} em ${i.activity.date} (${i.activity.sportType})`);
  lines.push(
    i.planned
      ? `Planejado para o dia: ${i.planned.type}, ${i.planned.km} km. ${i.planned.structure}. Alvo: ${i.planned.target}.`
      : "Não havia treino planejado para este dia.",
  );
  lines.push(
    `Feito (dados do Strava): ${round(a.distanceM / 1000, 2)} km em ${formatDuration(a.movingTimeS)}, pace médio ${
      i.activity.avgSpeed ? paceFromSpeed(i.activity.avgSpeed) : "—"
    }/km, FC média ${a.avgHr ? Math.round(a.avgHr) : "—"} bpm (Z${a.avgHrZone ?? "?"}), desnível ${Math.round(a.elevGainM)} m${
      a.hilly ? " (percurso com subidas relevantes)" : ""
    }.`,
  );
  if (a.timeInZonesS.some((v) => v > 0)) {
    const total = a.timeInZonesS.reduce((s, v) => s + v, 0);
    lines.push(
      "Tempo em zona (cálculo do app): " +
        a.timeInZonesS.map((v, k) => `Z${k + 1} ${Math.round((v / total) * 100)}%`).join(", "),
    );
  }
  if (a.drift) {
    const d = a.drift;
    lines.push(
      `Deriva (cálculo do app, após 10 min de aquecimento, pace ajustado ao desnível): 1ª metade ${paceFromSpeed(
        d.firstHalf.gapSpeed,
      )}/km com FC ${Math.round(d.firstHalf.avgHr)}; 2ª metade ${paceFromSpeed(d.secondHalf.gapSpeed)}/km com FC ${Math.round(
        d.secondHalf.avgHr,
      )}. FC ${d.hrChangePct >= 0 ? "+" : ""}${round(d.hrChangePct)}%, pace ${round(d.paceChangePct)}% mais lento, desacoplamento ${round(
        d.decouplingPct,
      )}%.`,
    );
  } else {
    lines.push("Deriva: não calculada (treino curto ou sem FC).");
  }
  if (a.splits) {
    const s = a.splits;
    lines.push(
      `Splits (cálculo do app): padrão ${s.pattern}, 2ª metade ${round(s.halfDiffPct)}% vs 1ª, variação ${round(s.cvPct)}%${
        s.fastStart ? ", saída forte demais" : ""
      }. Parciais: ` +
        s.splits
          .map((x) => `${x.km}: ${formatPace(x.paceSecPerKm)}${x.avgHr ? ` @${Math.round(x.avgHr)}` : ""}`)
          .join(" | "),
    );
  }
  const l = i.load;
  lines.push(
    `Carga (cálculo do app): últimos 7 dias ${round(l.acuteKm)} km; média semanal 28 dias ${round(
      l.chronicWeeklyKm,
    )} km; ACWR ${l.acwr === null ? "—" : round(l.acwr, 2)} (${l.status ?? "sem histórico"})${
      l.weekOverWeekPct === null ? "" : `; vs semana anterior ${l.weekOverWeekPct >= 0 ? "+" : ""}${Math.round(l.weekOverWeekPct)}%`
    }.`,
  );
  if (i.previous.length) {
    lines.push("Vereditos dos treinos anteriores: " + i.previous.map((p) => `${p.date}: ${p.verdict ?? "—"}`).join(" / "));
  }
  lines.push(
    i.next
      ? `Próximo treino planejado: ${i.next.date}, ${i.next.type}, ${i.next.km} km. ${i.next.structure}. Alvo: ${i.next.target}.`
      : "Sem próximo treino no plano atual.",
  );
  return lines.join("\n");
}

let client: Anthropic | null = null;

export async function generateFeedback(input: CoachInput): Promise<string> {
  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: COACH_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    // Se o modelo principal recusar, a API tenta automaticamente outro modelo.
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: SYSTEM,
    messages: [{ role: "user", content: describeForCoach(input) }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("O Claude não gerou o feedback para este treino.");
  }
  const text = response.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n")
    .trim();
  if (!text) throw new Error("Resposta vazia do Claude.");
  return text;
}

/** Extrai a linha "Veredito: ..." do feedback. */
export function verdictOf(feedback: string | null): string | null {
  if (!feedback) return null;
  const line = feedback.split("\n").find((l) => l.trim().toLowerCase().startsWith("veredito"));
  return line ? line.replace(/^\s*veredito:\s*/i, "").trim() : null;
}
