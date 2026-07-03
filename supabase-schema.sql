create table if not exists public.hasan_frenzy_scores (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  level text not null check (level in ('easy', 'medium', 'hard')),
  score integer not null check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hasan_frenzy_scores_username_level_key unique (username, level)
);

alter table public.hasan_frenzy_scores enable row level security;

drop policy if exists "Scores are public read" on public.hasan_frenzy_scores;
create policy "Scores are public read"
on public.hasan_frenzy_scores
for select
to anon
using (true);

create or replace function public.submit_hasan_frenzy_score(
  p_username text,
  p_level text,
  p_score integer
)
returns public.hasan_frenzy_scores
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
  saved_row public.hasan_frenzy_scores;
begin
  normalized_username := nullif(trim(p_username), '');

  if normalized_username is null then
    raise exception 'Username is required';
  end if;

  if p_level not in ('easy', 'medium', 'hard') then
    raise exception 'Invalid level';
  end if;

  if p_score < 0 then
    raise exception 'Invalid score';
  end if;

  insert into public.hasan_frenzy_scores (username, level, score)
  values (left(normalized_username, 24), p_level, p_score)
  on conflict (username, level)
  do update set
    score = greatest(public.hasan_frenzy_scores.score, excluded.score),
    updated_at = case
      when excluded.score > public.hasan_frenzy_scores.score then now()
      else public.hasan_frenzy_scores.updated_at
    end
  returning * into saved_row;

  return saved_row;
end;
$$;

grant execute on function public.submit_hasan_frenzy_score(text, text, integer) to anon;

create or replace function public.reset_hasan_frenzy_scores(p_password text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if p_password <> 'H4sanFrenzy' then
    raise exception 'Invalid admin password';
  end if;

  delete from public.hasan_frenzy_scores where true;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.reset_hasan_frenzy_scores(text) to anon;
