-- ==================================================================
-- SHOW DOWN — Tabelas novas no Supabase
--
-- Cole isso no SQL Editor do MESMO projeto que o Time Attack já usa
-- (a URL/chave em assets/js/supabase-client.js é a mesma) e aperte
-- Run. Cria as 3 tabelas de uma vez.
--
-- Depois de rodar, vá em Database → Replication e ative o Realtime
-- pras tabelas showdown_rooms e showdown_players (mesma coisa que
-- provavelmente já está ativado pras tabelas do Time Attack).
-- ==================================================================

create table if not exists showdown_rooms (
    id uuid primary key default gen_random_uuid(),
    room_code text not null,
    host_name text not null,
    pack_slug text not null,
    question_seconds int not null,
    num_questions int not null,
    questions jsonb not null,
    status text not null default 'waiting',            -- waiting | question | results | finished | closed
    current_question_index int not null default -1,
    question_started_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists showdown_players (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references showdown_rooms(id) on delete cascade,
    nickname text not null,
    total_score int not null default 0,
    joined_at timestamptz not null default now()
);

create table if not exists showdown_answers (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references showdown_rooms(id) on delete cascade,
    player_id uuid not null references showdown_players(id) on delete cascade,
    question_index int not null,
    is_correct boolean not null,
    points_earned int not null default 0,
    answered_at timestamptz not null default now(),
    unique (player_id, question_index)
);

-- --------------------------------------------------------
-- Row Level Security: se o seu projeto já usa RLS nas tabelas do
-- Time Attack (time_attack_rooms / time_attack_players), replique a
-- mesma policy aqui, senão a chave publishable do navegador não
-- consegue ler/escrever. Se o Time Attack funciona sem RLS habilitado
-- nessas tabelas, pode ignorar esse bloco.
-- --------------------------------------------------------

-- alter table showdown_rooms enable row level security;
-- alter table showdown_players enable row level security;
-- alter table showdown_answers enable row level security;
--
-- create policy "public read/write showdown_rooms" on showdown_rooms
--     for all using (true) with check (true);
-- create policy "public read/write showdown_players" on showdown_players
--     for all using (true) with check (true);
-- create policy "public read/write showdown_answers" on showdown_answers
--     for all using (true) with check (true);
