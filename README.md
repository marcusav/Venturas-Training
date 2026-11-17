# Ventura's Training

Treinador virtual de corrida integrado ao Strava. É um app web instalável (PWA): abre no navegador do celular e pode ser adicionado à tela inicial.

## O que faz

- **Login com Strava** (OAuth) e importação das últimas 6 semanas.
- **Webhook do Strava**: quando você salva uma corrida, o app busca os dados segundo a segundo e analisa:
  - **Tempo em zona de FC** (zonas do seu perfil no Strava).
  - **Deriva cardíaca e desacoplamento Pa:FC**: 1ª vs 2ª metade, depois de 10 min de aquecimento.
  - **Pace ajustado ao desnível (GAP)**, pelo custo energético de Minetti.
  - **Splits por km**: negativo, constante ou positivo, e saída forte demais.
  - **Carga (ACWR)**: 7 dias vs média semanal de 28 dias, e alerta de aumento semanal acima de 15%.
- **Feedback pós-treino** em português, começando pelo veredito. Sem custo, ele é gerado por regras; com uma chave da Claude API (opcional, paga), o Claude escreve o texto. Pode ser enviado pelo Telegram.
- **Plano de treino** (em `src/lib/plan.ts`) com a semana atual na tela inicial.

## Configuração (uma vez)

### 1. Banco de dados (Supabase, grátis)
1. Crie um projeto em https://supabase.com.
2. Em *Project Settings → Database → Connection string*, copie a URI do **Transaction pooler** (porta 6543). Esse é o `DATABASE_URL`.
3. Crie as tabelas: no *SQL Editor*, cole o conteúdo de `db/schema.sql` e rode. Também dá para rodar `DATABASE_URL=... npm run db:migrate`.

### 2. Claude API (opcional)
O app funciona de graça sem ela, com feedback por regras. Para o Claude escrever o feedback, crie uma chave em https://console.anthropic.com/settings/keys (exige créditos) e defina `ANTHROPIC_API_KEY`.

### 3. Deploy na Vercel (grátis)
1. Em https://vercel.com, importe este repositório.
2. Em *Environment Variables*, preencha tudo do `.env.example`. `APP_URL` é o endereço que a Vercel der (ex.: `https://venturas-training.vercel.app`).
3. Faça o deploy.

### 4. App no Strava
1. Em https://www.strava.com/settings/api, crie um app:
   - *Website*: o `APP_URL`.
   - *Authorization Callback Domain*: só o domínio, sem `https://` (ex.: `venturas-training.vercel.app`).
2. Copie *Client ID* e *Client Secret* para as variáveis `STRAVA_CLIENT_ID` e `STRAVA_CLIENT_SECRET` na Vercel e faça *Redeploy*.

### 5. Ativar o webhook (uma vez)
Entre no app, abra **Configuração** (no fim da tela inicial) e toque em **Ativar webhook do Strava**. A tela também mostra se o banco, a Claude API e o Telegram estão configurados.

Alternativa pelo terminal:
```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=SEU_CLIENT_ID \
  -F client_secret=SEU_CLIENT_SECRET \
  -F callback_url=https://SEU_APP/api/webhook \
  -F verify_token=O_MESMO_STRAVA_WEBHOOK_VERIFY_TOKEN
```

### 6. No celular
Abra o `APP_URL`, toque em **Conectar com Strava** e marque todas as permissões. Depois:
- **iPhone (Safari)**: Compartilhar → *Adicionar à Tela de Início*.
- **Android (Chrome)**: menu ⋮ → *Instalar app*.

### Telegram (opcional)
Crie um bot com o @BotFather e use o token em `TELEGRAM_BOT_TOKEN`. Mande uma mensagem para o bot e pegue seu `chat.id` em `https://api.telegram.org/bot<TOKEN>/getUpdates`; esse é o `TELEGRAM_CHAT_ID`.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha
npm run dev                  # http://localhost:3000
npm test                     # testes do motor de análise
npm run lint                 # checagem de tipos
```

Estrutura:
- `src/lib/analysis/`: cálculos puros (deriva, GAP, splits, zonas, ACWR), com testes.
- `src/lib/strava.ts`: OAuth e API do Strava (renova o token sozinho).
- `src/lib/pipeline.ts`: importa, analisa e gera o feedback.
- `src/lib/coach.ts`: prompt e chamada ao Claude.
- `src/lib/plan.ts`: plano de treino atual.
- `src/app/`: telas e rotas da API (Next.js).
