export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main>
      <header className="top">
        <h1>Ventura&apos;s Training</h1>
      </header>
      <div className="card">
        <h2>Seu treinador de corrida</h2>
        <p className="muted">
          Conecte o Strava para analisar cada corrida (zonas, deriva cardíaca, splits e carga) e
          receber o feedback do treinador logo depois de salvar o treino.
        </p>
        {erro && <p className="notice">{erro}</p>}
        <a className="btn" href="/api/auth/strava">
          Conectar com Strava
        </a>
      </div>
    </main>
  );
}
