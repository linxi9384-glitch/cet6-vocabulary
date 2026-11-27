create table public.exam_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  progress jsonb not null check (
    jsonb_typeof(progress) = 'object'
    and progress ?& array['exams', 'examTopics']
    and jsonb_typeof(progress->'exams') = 'object'
    and jsonb_typeof(progress->'examTopics') = 'object'
  )
);

alter table public.exam_progress enable row level security;
revoke all on public.exam_progress from public, anon, authenticated;
grant select, insert, update on public.exam_progress to authenticated;

create policy "WhiteMu owns exam progress"
  on public.exam_progress
  for all
  to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt()->>'email') = 'whitemu@cet6.invalid')
  with check (user_id = (select auth.uid()) and (select auth.jwt()->>'email') = 'whitemu@cet6.invalid');
