-- ==================================================================
-- Endurecimento de segurança - auditoria de 11/2026
--
-- Aplicado em produção via Management API. Cada bloco é independente
-- e idempotente (pode rodar de novo sem quebrar nada).
--
-- Regra geral: o navegador conversa com o banco usando a chave
-- pública + o token da sessão, e as policies de RLS decidem o que ele
-- pode fazer. Policy de RLS decide QUAIS LINHAS, não QUAIS COLUNAS -
-- "usuário edita o próprio perfil" deixava editar is_vip também.
-- Coluna sensível precisa de proteção própria (GRANT por coluna ou
-- gatilho), e quem altera ela de verdade são as Edge Functions, com
-- a chave de serviço (role service_role), que passa por cima disso.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. profiles: ninguém se dá VIP pelo navegador
--
-- Antes qualquer usuário logado (inclusive convidado anônimo dos
-- jogos, que também é role "authenticated") conseguia rodar
--   update profiles set is_vip = true, vip_tier = 'gold' where id = <eu>
-- O navegador agora só pode gravar as colunas que o próprio usuário
-- edita na tela de conta. is_vip / vip_tier / vip_expires_at só mudam
-- por Edge Function (verify-vip-payment, redeem-vip-code,
-- admin-grant-vip).
--
-- ATENÇÃO pra quem criar coluna nova em profiles que o usuário edita
-- pelo navegador: precisa entrar nos dois GRANTs abaixo, senão o
-- update dá "permission denied for table profiles".
-- ------------------------------------------------------------------

revoke insert, update on public.profiles from anon, authenticated;

grant insert (id, username, x_handle, telegram_handle, instagram_handle,
              wallet_evm, bio, avatar_url, featured_badge_ids)
    on public.profiles to authenticated;

grant update (username, x_handle, telegram_handle, instagram_handle,
              wallet_evm, bio, avatar_url, featured_badge_ids)
    on public.profiles to authenticated;


-- ------------------------------------------------------------------
-- 2. Placar do Show Down: só a Edge Function pontua
--
-- A policy "usuário atualiza a própria linha" deixava o jogador
-- gravar total_score = 999999 direto. Agora qualquer mudança de
-- total_score vinda do navegador é ignorada (a linha ainda atualiza
-- last_seen_at normalmente). showdown-submit-answer e
-- showdown-reset-round usam a chave de serviço e passam direto.
-- Ignora em vez de dar erro de propósito: navegador com versão antiga
-- do site em cache não quebra, só não pontua por fora.
-- ------------------------------------------------------------------

create or replace function public.protect_showdown_score()
returns trigger
language plpgsql
as $$
begin
    if current_user in ('anon', 'authenticated') then
        if tg_op = 'INSERT' then
            new.total_score := 0;
        else
            new.total_score := old.total_score;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists protect_showdown_score on public.showdown_players;
create trigger protect_showdown_score
    before insert or update on public.showdown_players
    for each row execute function public.protect_showdown_score();

-- Resposta só entra pela Edge Function (que confere o gabarito e o
-- tempo). Antes qualquer um inseria resposta em nome de qualquer
-- jogador, de qualquer sala.
drop policy if exists "showdown_answers_insert" on public.showdown_answers;
do $$
declare p record;
begin
    for p in select policyname from pg_policies
             where schemaname = 'public' and tablename = 'showdown_answers' and cmd = 'INSERT'
    loop
        execute format('drop policy %I on public.showdown_answers', p.policyname);
    end loop;
end $$;


-- ------------------------------------------------------------------
-- 3. Placar do Time Attack
--
-- answered_question_ids: perguntas oficiais que o jogador já
-- respondeu - time-attack-submit-answer usa pra contar cada pergunta
-- uma vez só (antes dava pra reenviar a mesma pergunta infinitas
-- vezes).
--
-- correct_answers vindo do navegador:
--   - zerar (= 0) sempre pode: é o "jogar de novo" do host, e quem
--     zera também limpa answered_question_ids pra nova rodada.
--   - sala custom/salva (perguntas do host, guardadas na própria
--     sala): o navegador ainda grava a contagem no fim da partida,
--     mas limitada ao número de perguntas da sala - ninguém grava
--     9999. (No custom o gabarito já está dentro da sala, visível pra
--     quem entrar, então validar resposta a resposta no servidor não
--     protegeria mais que isso e deixaria o jogo mais lento.)
--   - sala de pacote oficial: ignorado. Só a Edge Function pontua.
-- ------------------------------------------------------------------

alter table public.time_attack_players
    add column if not exists answered_question_ids uuid[] not null default '{}';

create or replace function public.protect_time_attack_score()
returns trigger
language plpgsql
as $$
declare
    room_pack text;
    custom_count integer;
    is_custom boolean;
begin
    if current_user not in ('anon', 'authenticated') then
        return new;
    end if;

    select r.pack_slug, coalesce(jsonb_array_length(r.custom_questions), 0)
      into room_pack, custom_count
      from public.time_attack_rooms r
     where r.id = new.room_id;

    is_custom := room_pack = 'custom' or room_pack like 'saved:%';

    if tg_op = 'INSERT' then
        new.answered_question_ids := '{}';
        if is_custom then
            new.correct_answers := least(greatest(coalesce(new.correct_answers, 0), 0), custom_count);
        else
            new.correct_answers := 0;
        end if;
        return new;
    end if;

    -- UPDATE
    -- "Jogar de novo" do host: zera correct_answers e volta finished_at
    -- pra null. Mesmo quem fez 0 acertos (correct_answers não muda)
    -- precisa da lista de respondidas limpa pra jogar a rodada nova.
    if new.correct_answers = 0
       and (old.correct_answers <> 0 or (old.finished_at is not null and new.finished_at is null)) then
        new.answered_question_ids := '{}';
        return new;
    end if;

    if new.correct_answers is distinct from old.correct_answers then
        if is_custom then
            new.correct_answers := least(greatest(new.correct_answers, 0), custom_count);
        else
            new.correct_answers := old.correct_answers;
        end if;
    end if;

    -- Fora do reset, o navegador não mexe na lista de respondidas.
    new.answered_question_ids := old.answered_question_ids;

    return new;
end;
$$;

drop trigger if exists protect_time_attack_score on public.time_attack_players;
create trigger protect_time_attack_score
    before insert or update on public.time_attack_players
    for each row execute function public.protect_time_attack_score();


-- ------------------------------------------------------------------
-- 4. guest_participants: o registro do convidado continua sendo
-- gravado pelo próprio navegador do jogador (é importante ter esse
-- histórico mesmo de quem joga como convidado), mas o host_id tem que
-- ser o host REAL de uma sala com aquele código, naquele jogo. Antes
-- a policy era "with check (true)": qualquer um enchia o histórico de
-- qualquer host com linha falsa.
-- ------------------------------------------------------------------

do $$
declare p record;
begin
    for p in select policyname from pg_policies
             where schemaname = 'public' and tablename = 'guest_participants' and cmd = 'INSERT'
    loop
        execute format('drop policy %I on public.guest_participants', p.policyname);
    end loop;
end $$;

create policy "convidado grava participação em sala real"
    on public.guest_participants
    for insert
    with check (
        host_id is not null and (
            (game = 'time_attack' and exists (select 1 from public.time_attack_rooms r
                where r.room_code = guest_participants.room_code and r.host_id = guest_participants.host_id))
         or (game = 'show_down' and exists (select 1 from public.showdown_rooms r
                where r.room_code = guest_participants.room_code and r.host_id = guest_participants.host_id))
         or (game = 'tap_rush' and exists (select 1 from public.tap_rush_rooms r
                where r.room_code = guest_participants.room_code and r.host_id = guest_participants.host_id))
         or (game = 'roulette' and exists (select 1 from public.roulette_rooms r
                where r.room_code = guest_participants.room_code and r.host_id = guest_participants.host_id))
        )
    );


-- ------------------------------------------------------------------
-- 5. Funções internas que não devem ser chamadas pelo navegador
--
-- Os contadores de uso de código são chamados SÓ pelas Edge Functions
-- de resgate (claim-badge-code, redeem-vip-code), com a chave de
-- serviço. Resgatar continua aberto pra qualquer um com o código -
-- isso só impede chamar o contador direto (POST /rpc/...) e gastar os
-- usos de um código sem resgatar nada.
-- ------------------------------------------------------------------

revoke execute on function public.increment_badge_claim_code_use(uuid) from public, anon, authenticated;
revoke execute on function public.increment_vip_code_use(uuid) from public, anon, authenticated;
revoke execute on function public.cleanup_expired_question_packs() from public, anon, authenticated;
revoke execute on function public.handle_vip_pack_expiry() from public, anon, authenticated;

grant execute on function public.increment_badge_claim_code_use(uuid) to service_role;
grant execute on function public.increment_vip_code_use(uuid) to service_role;
grant execute on function public.cleanup_expired_question_packs() to service_role;


-- ------------------------------------------------------------------
-- 6. Storage: limite de tamanho e só imagem
--
-- 5 MB por arquivo (o site já limita avatar a 3 MB; os maiores
-- arquivos guardados hoje têm ~1,5 MB) e só formatos de imagem.
-- ------------------------------------------------------------------

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 where id = 'avatars';

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
 where id in ('badge-images', 'theme-logos');

-- theme-logos: antes qualquer usuário logado (até convidado anônimo)
-- subia qualquer coisa, com qualquer nome. Agora só VIP (criar tema é
-- recurso VIP) e só com o próprio prefixo, que é o formato que o site
-- já usa: "<user_id>-<timestamp>.<ext>".
drop policy if exists "authenticated users can upload theme logos" on storage.objects;
drop policy if exists "vip envia logo do próprio tema" on storage.objects;
create policy "vip envia logo do próprio tema"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'theme-logos'
        and name like (auth.uid()::text || '-%')
        and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_vip = true)
    );


-- ------------------------------------------------------------------
-- 7. Registro único de transações de pagamento
--
-- vip_payments e theme_submission_payments têm cada uma sua trava
-- UNIQUE, mas uma não enxerga a outra: a mesma transação pagava VIP e
-- tema. Toda Edge Function de pagamento grava o hash aqui antes de
-- conceder qualquer coisa; a chave primária garante que só a primeira
-- ganha, mesmo com dois pedidos chegando juntos. Só a chave de serviço
-- mexe aqui (RLS ligado, sem policy nenhuma).
-- ------------------------------------------------------------------

create table if not exists public.payment_tx_claims (
    tx_hash text primary key,
    purpose text not null,
    user_id uuid,
    created_at timestamptz not null default now()
);

alter table public.payment_tx_claims enable row level security;
revoke all on public.payment_tx_claims from anon, authenticated;
grant all on public.payment_tx_claims to service_role;

insert into public.payment_tx_claims (tx_hash, purpose, user_id, created_at)
select tx_hash, 'vip', user_id, now() from public.vip_payments
on conflict (tx_hash) do nothing;

insert into public.payment_tx_claims (tx_hash, purpose, user_id, created_at)
select tx_hash, 'theme_submission', user_id, coalesce(created_at, now()) from public.theme_submission_payments
on conflict (tx_hash) do nothing;
