-- ==================================================================
-- TAP RUSH — Tabelas novas no Supabase
-- ==================================================================

create table if not exists tap_rush_rooms (
    id uuid primary key default gen_random_uuid(),
    room_code text not null,
    host_name text not null,
    mode text not null,                          -- 'race' | 'tugofwar'
    target_taps int,                              -- só no modo race
    max_seconds int,                              -- só no modo race
    duration_seconds int,                         -- só no modo tugofwar
    theme_name text,
    status text not null default 'waiting',       -- waiting | active | finished | closed
    round_started_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists tap_rush_players (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references tap_rush_rooms(id) on delete cascade,
    nickname text not null,
    team text,                                    -- 'A' | 'B' | null (null no modo race)
    tap_count int not null default 0,
    joined_at timestamptz not null default now()
);

-- Depois de rodar isso, ative Realtime nas duas (Database Tables →
-- coluna Realtime, ou Database → Publications → supabase_realtime):
-- tap_rush_rooms e tap_rush_players precisam das duas, porque o
-- jogador fica escutando a sala (pra saber quando a rodada começa/
-- termina) e o host fica escutando os jogadores (pra desenhar a
-- pista/corda em tempo real).
