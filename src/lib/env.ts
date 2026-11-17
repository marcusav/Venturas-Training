function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

export const env = {
  get appUrl() {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get stravaClientId() {
    return required("STRAVA_CLIENT_ID");
  },
  get stravaClientSecret() {
    return required("STRAVA_CLIENT_SECRET");
  },
  get webhookVerifyToken() {
    return required("STRAVA_WEBHOOK_VERIFY_TOKEN");
  },
  get allowedAthleteId() {
    const v = process.env.ALLOWED_ATHLETE_ID;
    return v ? Number(v) : null;
  },
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get hasClaude() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },
  get telegram() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    return token && chatId ? { token, chatId } : null;
  },
};
