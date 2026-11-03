-- Catalog audit: execute only with owner permission via the read-only endpoint.
-- Owner-approved catalog reads were verified on 2026-11-03; never use to apply DDL.
-- Intended for POST /v1/projects/{ref}/database/query/read-only (database_read).
-- One SELECT; PostgreSQL metadata only, no application rows, secrets, function
-- bodies, Storage objects or bucket rows. Bucket listing still needs storage_read.
select pg_catalog.jsonb_build_object(
  'postgres_version', pg_catalog.current_setting('server_version'),
  'schemas', (
    select coalesce(pg_catalog.jsonb_agg(n.nspname order by n.nspname),'[]'::jsonb)
    from pg_catalog.pg_namespace n
    where n.nspname <> 'information_schema' and n.nspname !~ '^pg_'
  ),
  'extensions', (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name',e.extname,'version',e.extversion,'schema',n.nspname
    ) order by e.extname),'[]'::jsonb)
    from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid=e.extnamespace
  ),
  'tables', (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema',n.nspname,'name',c.relname,'kind',c.relkind,
      'rls_enabled',c.relrowsecurity,'rls_forced',c.relforcerowsecurity,
      'columns',(
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
          'not_null',a.attnotnull
        ) order by a.attnum),'[]'::jsonb)
        from pg_catalog.pg_attribute a
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
      ),
      'constraints',(
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'name',k.conname,'type',k.contype,
          'definition',pg_catalog.pg_get_constraintdef(k.oid,true)
        ) order by k.conname),'[]'::jsonb)
        from pg_catalog.pg_constraint k where k.conrelid=c.oid
      )
    ) order by n.nspname,c.relname),'[]'::jsonb)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname <> 'information_schema' and n.nspname !~ '^pg_'
      and n.nspname <> 'vault' and c.relkind in ('r','p','v','m','f')
  ),
  'policies', (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema',p.schemaname,'table',p.tablename,'name',p.policyname,
      'permissive',p.permissive,'roles',p.roles,'command',p.cmd,
      'using',p.qual,'with_check',p.with_check
    ) order by p.schemaname,p.tablename,p.policyname),'[]'::jsonb)
    from pg_catalog.pg_policies p
    where p.schemaname in ('public','private','storage')
  ),
  'types', (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema',n.nspname,'name',t.typname,'kind',t.typtype
    ) order by n.nspname,t.typname),'[]'::jsonb)
    from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid=t.typnamespace
    where n.nspname in ('public','private','extensions')
  ),
  'functions', (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema',n.nspname,'name',p.proname,
      'arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),
      'security_definer',p.prosecdef
    ) order by n.nspname,p.proname,p.oid),'[]'::jsonb)
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private')
  ),
  'indexes', (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema',n.nspname,'table',t.relname,'name',i.relname,'unique',x.indisunique
    ) order by n.nspname,t.relname,i.relname),'[]'::jsonb)
    from pg_catalog.pg_index x
    join pg_catalog.pg_class t on t.oid=x.indrelid
    join pg_catalog.pg_class i on i.oid=x.indexrelid
    join pg_catalog.pg_namespace n on n.oid=t.relnamespace
    where n.nspname in ('public','private')
  )
) as metadata;
