-- Studio OS — database for one client. Run once in the client's own Supabase project (SQL editor).
-- One table holds everything (projects, tasks, leads, suppliers, meetings, quantities, drafts, log).
-- Only the signed-in owner can read or write her rows.
create table if not exists public.st_items (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('project','task','lead','supplier','meeting','quote','boq','plan','draft','log')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists st_items_owner_kind on public.st_items (owner, kind);
alter table public.st_items enable row level security;
drop policy if exists st_owner on public.st_items;
create policy st_owner on public.st_items for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create or replace function public.st_touch() returns trigger language plpgsql set search_path = '' as
$$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists st_touch on public.st_items;
create trigger st_touch before update on public.st_items for each row execute function public.st_touch();
-- Sign-ups: turn off "Allow new users to sign up" in Authentication settings after the owner's user exists.
