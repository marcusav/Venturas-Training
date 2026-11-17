# Ventura's Training

App pessoal (Next.js 15 + Postgres + Claude API) que atua como treinador de corrida do Ventura a partir dos dados do Strava. Interface e textos em português do Brasil.

- Cálculos ficam em `src/lib/analysis/` como funções puras e testadas (`npm test`). Mudou um cálculo, atualize ou adicione teste.
- O plano de treino vive em `src/lib/plan.ts`. Ao ajustar a planilha, edite esse arquivo (datas em horário local, semanas começam na segunda).
- Zonas e regras do protocolo (deriva >5%, ACWR, salto semanal >15%) estão documentadas nos comentários de `drift.ts` e `load.ts` e no prompt de `coach.ts`; mantenha os três coerentes.
- Antes de abrir PR: `npm run lint && npm test && npm run build`.
