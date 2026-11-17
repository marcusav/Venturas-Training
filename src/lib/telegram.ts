import { env } from "./env";

/** Envia uma mensagem para o seu chat do Telegram, se configurado. Falhas não quebram o fluxo. */
export async function notifyTelegram(text: string): Promise<void> {
  const tg = env.telegram;
  if (!tg) return;
  try {
    await fetch(`https://api.telegram.org/bot${tg.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: tg.chatId, text, disable_web_page_preview: true }),
    });
  } catch (e) {
    console.error("Telegram falhou", e);
  }
}
