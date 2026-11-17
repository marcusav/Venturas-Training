"use client";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <header className="top">
        <h1>Algo deu errado</h1>
      </header>
      <div className="card">
        <p>
          Não foi possível carregar esta tela. Se acabou de configurar o app, confira as variáveis de
          ambiente na Vercel (principalmente <code>DATABASE_URL</code>) e faça um Redeploy.
        </p>
        {error.digest && <p className="small muted">Código do erro: {error.digest}</p>}
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <button className="btn" onClick={reset}>Tentar de novo</button>
          <a className="btn ghost" href="/login">Ir para o login</a>
        </div>
      </div>
    </main>
  );
}
