-- Migration: Create ai_chatbot."ReviewerProfile" linked to Supabase auth.users
-- This migration sets up multi-user recruiter profiles for the ATS application.
-- DO NOT EXECUTE DIRECTLY IN THIS BATCH. Save file for review.

-- ============================================================================
-- 1. Ensure the custom schema exists
-- ============================================================================
create schema if not exists ai_chatbot;

-- ============================================================================
-- 2. Create the ReviewerProfile table
-- ============================================================================
create table if not exists ai_chatbot."ReviewerProfile" (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'reviewer' check (role in ('admin', 'reviewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 3. Schema & Table Grants for PostgREST / Supabase API
-- ============================================================================
-- Grant schema usage to authenticated reviewers and service_role
grant usage on schema ai_chatbot to authenticated, service_role;

-- Recruiter users only have SELECT permission to inspect their own profile.
-- Untrusted roles (anon, authenticated) have NO INSERT, UPDATE, or DELETE privileges.
grant select on ai_chatbot."ReviewerProfile" to authenticated;
grant all on ai_chatbot."ReviewerProfile" to service_role;

-- Revoke all permissions on the table from anonymous/public users
revoke all on ai_chatbot."ReviewerProfile" from anon;
revoke all on ai_chatbot."ReviewerProfile" from public;

-- ============================================================================
-- 4. Enable Row Level Security (RLS)
-- ============================================================================
alter table ai_chatbot."ReviewerProfile" enable row level security;

-- Policy: Restrict profile reads strictly to the user's own profile row.
-- Users cannot inspect or scrape the directory of other recruiters.
drop policy if exists "Allow users to read own profile only" on ai_chatbot."ReviewerProfile";
create policy "Allow users to read own profile only"
  on ai_chatbot."ReviewerProfile"
  for select
  to authenticated
  using (auth.uid() = id);

-- No client-side INSERT, UPDATE, or DELETE policies exist for 'authenticated'.
-- Recruiter users cannot modify their own role ('admin' elevation) or alter profiles directly.

-- ============================================================================
-- 5. Hardened SECURITY DEFINER Trigger Function
-- ============================================================================
-- Security Hardening Notes:
-- 1. search_path = '' ensures NO search-path hijacking or operator/function shadowing
--    can occur from public or untrusted schemas.
-- 2. All table, ordinary function, catalog, and type references are fully qualified.
-- 3. SQL expressions COALESCE and NULLIF are standard expressions (not schema-qualified).
-- 4. Function execution is explicitly revoked from public, anon, and authenticated.
-- 5. Trigger runs reliably within the auth signup transaction without silent swallow.
create or replace function ai_chatbot.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into ai_chatbot."ReviewerProfile" (id, email, name, role)
  values (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      NULLIF(pg_catalog.split_part(new.email, '@', 1), ''),
      'Reviewer'
    ),
    'reviewer'
  )
  on conflict (id) do update
  set email = excluded.email,
      name = COALESCE(excluded.name, ai_chatbot."ReviewerProfile".name),
      updated_at = pg_catalog.now();
  return new;
end;
$$;

-- Revoke execution from untrusted roles to prevent direct RPC / SQL execution
revoke all on function ai_chatbot.handle_new_user() from public;
revoke execute on function ai_chatbot.handle_new_user() from public;
revoke execute on function ai_chatbot.handle_new_user() from anon, authenticated;

-- Trigger firing after insert on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function ai_chatbot.handle_new_user();

-- ============================================================================
-- 6. Safe & Idempotent Backfill for Pre-existing Auth Users
-- ============================================================================
-- Ensures any accounts created prior to migration receive a ReviewerProfile.
-- Idempotent: 'where not exists' and 'on conflict do nothing' prevent duplicate
-- inserts, avoid overwriting customized profile data, and prevent write locks.
insert into ai_chatbot."ReviewerProfile" (id, email, name, role)
select
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    NULLIF(pg_catalog.split_part(u.email, '@', 1), ''),
    'Reviewer'
  ),
  'reviewer'
from auth.users u
where not exists (
  select 1 from ai_chatbot."ReviewerProfile" p where p.id = u.id
)
on conflict (id) do nothing;
