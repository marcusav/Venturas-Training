-- Esquema do Ventura's Training (Postgres). Idempotente: pode rodar mais de uma vez.
create table if not exists athletes (
  id              bigint primary key,           -- id do atleta no Strava
  firstname       text,
  lastname        text,
  access_token    text not null,
  refresh_token   text not null,
  expires_at      bigint not null,              -- epoch (s)
  hr_zones        jsonb,                        -- [{min,max}] do Strava
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists activities (
  id              bigint primary key,           -- id da atividade no Strava
  athlete_id      bigint not null references athletes(id) on delete cascade,
  name            text,
  sport_type      text not null,
  start_date      timestamptz not null,
  start_date_local text,
  distance_m      real not null default 0,
  moving_time_s   integer not null default 0,
  elapsed_time_s  integer not null default 0,
  elevation_gain_m real not null default 0,
  avg_hr          real,
  max_hr          real,
  avg_speed       real,
  avg_cadence     real,
  analysis        jsonb,
  feedback        text,
  feedback_at     timestamptz,
  updated_at      timestamptz not null default now()
);

create index if not exists activities_athlete_date on activities (athlete_id, start_date desc);
