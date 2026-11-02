-- Compatibility harness for a DISPOSABLE generic PostgreSQL container ONLY.
-- Not a migration, not a fake hosted integration, and never run on Supabase.
-- Models Supabase's database-role/JWT-sub boundary so real PostgreSQL RLS can
-- be tested independently of hosted Auth. API token validation is NOT tested.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- Simulate Supabase broad default grants to test that migration 1 closes them.
alter default privileges in schema public grant all on tables to anon, authenticated;
create role service_role nologin bypassrls;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant all on storage.objects to anon,authenticated,service_role;
grant all on storage.buckets to service_role;
