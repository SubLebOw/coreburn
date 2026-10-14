-- COREBURN online leaderboards (Supabase free tier). Paste ALL of this into
-- Supabase -> SQL Editor -> New query -> Run. Safe to run again (it replaces the function).
--
-- Design: the browser can only READ scores, and can only WRITE through submit_score(), which
-- re-checks every score (format, plausibility, today's/this week's board, rate limit, name filter).
-- One row per player per board (their best).

create table if not exists public.coreburn_scores (
  id         bigint generated always as identity primary key,
  board      text        not null,   -- 'global' | 'hero:<id>' | 'daily:YYYY-MM-DD' | 'rush:YYYY-Www'
  player_id  uuid        not null,   -- random id made on the device (no account)
  name       text        not null,
  hero       text        not null,
  score      bigint      not null,
  wave       int         not null default 0,
  kills      int         not null default 0,
  seconds    int         not null default 0,
  version    text        not null,
  updated_at timestamptz not null default now(),
  unique (board, player_id)
);
create index if not exists coreburn_scores_board_score on public.coreburn_scores (board, score desc);
create index if not exists coreburn_scores_player on public.coreburn_scores (player_id, updated_at desc);

alter table public.coreburn_scores enable row level security;
drop policy if exists "anyone can read scores" on public.coreburn_scores;
create policy "anyone can read scores" on public.coreburn_scores for select to anon, authenticated using (true);
-- (no insert/update/delete policies: direct writes are refused; use submit_score)

create or replace function public.coreburn_name_ok(p_name text) returns boolean
language sql immutable as $$
  select p_name ~ '^[A-Za-z0-9 _.-]{3,16}$'
     and regexp_replace(translate(lower(p_name), '013457@$!', 'oieastasi'), '[^a-z]', '', 'g') !~
         '(fuck|fuk|shit|cunt|bitch|nigg|fag|retard|whore|slut|rape|nazi|hitler|kike|chink|twat|wank|dick|cock|pussy|penis|vagina|porn|tranny|dyke|asshole|pedo)'
$$;

create or replace function public.submit_score(
  p_boards text[], p_player uuid, p_name text, p_hero text,
  p_score bigint, p_wave int, p_kills int, p_seconds int, p_version text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  b text;
  bosses int;
  boss_waves int;
  max_score numeric;
  last_at timestamptz;
  today date := (now() at time zone 'utc')::date;
begin
  if p_boards is null or array_length(p_boards, 1) is null or array_length(p_boards, 1) > 3 then return 'bad boards'; end if;
  if not public.coreburn_name_ok(p_name) then return 'bad name'; end if;
  if p_hero not in ('sarrow', 'zaleks', 'iskra', 'orin') then return 'bad hero'; end if;
  if p_version !~ '^\d+\.\d+\.\d+$' then return 'bad version'; end if;

  -- rate limit: one submission per player every 15 seconds
  select max(updated_at) into last_at from coreburn_scores where player_id = p_player;
  if last_at is not null and now() - last_at < interval '15 seconds' then return 'slow down'; end if;

  foreach b in array p_boards loop
    if b !~ '^(global|hero:(sarrow|zaleks|iskra|orin)|daily:\d{4}-\d{2}-\d{2}|rush:\d{4}-W\d{2})$' then return 'bad board'; end if;
    if b like 'hero:%' and b <> 'hero:' || p_hero then return 'bad board'; end if;
    if b like 'daily:%' and abs(substr(b, 7)::date - today) > 1 then return 'daily closed'; end if;
    if b like 'rush:%' then
      if b <> 'rush:' || to_char(now() at time zone 'utc', 'IYYY-"W"IW') then return 'week closed'; end if;
      bosses := floor((p_score + 999999) / 1000000.0);
      if bosses < 0 or bosses > 7 or p_seconds < bosses * 12 then return 'implausible'; end if;
    else
      if p_wave < 1 or p_wave > 1000 or p_kills < 0 or p_kills > 20 * p_wave * p_wave + 200 then return 'implausible'; end if;
      if p_seconds < (p_wave - 1) * 5 then return 'implausible'; end if;
      boss_waves := p_wave / 5;
      max_score := p_kills * 1000::numeric + 18000::numeric * boss_waves * (boss_waves + 1) / 2
                 + 300::numeric * p_wave * (p_wave + 1) / 2 + p_seconds * 400::numeric;
      if p_score < 0 or p_score > max_score then return 'implausible'; end if;
    end if;
  end loop;

  foreach b in array p_boards loop
    insert into coreburn_scores as s (board, player_id, name, hero, score, wave, kills, seconds, version)
    values (b, p_player, p_name, p_hero, p_score, p_wave, p_kills, p_seconds, p_version)
    on conflict (board, player_id) do update set
      name = excluded.name,
      updated_at = now(),
      hero    = case when excluded.score > s.score then excluded.hero    else s.hero    end,
      wave    = case when excluded.score > s.score then excluded.wave    else s.wave    end,
      kills   = case when excluded.score > s.score then excluded.kills   else s.kills   end,
      seconds = case when excluded.score > s.score then excluded.seconds else s.seconds end,
      version = case when excluded.score > s.score then excluded.version else s.version end,
      score   = greatest(s.score, excluded.score);
  end loop;
  return 'ok';
end $$;

revoke all on function public.submit_score(text[], uuid, text, text, bigint, int, int, int, text) from public;
grant execute on function public.submit_score(text[], uuid, text, text, bigint, int, int, int, text) to anon, authenticated;
grant select on public.coreburn_scores to anon, authenticated;
