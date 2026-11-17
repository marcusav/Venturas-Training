// Service worker mínimo: permite instalar o app na tela inicial.
// Não faz cache dos dados (eles mudam a cada treino), só mostra uma página simples sem conexão.
const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão</title><body style="font-family:system-ui;padding:24px;background:#0b1214;color:#e6f0ef">
<h1>Sem conexão</h1><p>Abra de novo quando estiver online para ver seus treinos.</p></body>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
