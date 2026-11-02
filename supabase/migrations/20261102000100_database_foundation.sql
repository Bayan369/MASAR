-- Review-only foundation. No hosted execution is authorized by this file.
begin;

create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create type public.membership_role as enum ('company_admin', 'new_employee');
create type public.document_visibility as enum ('company', 'department', 'admins');
create type public.document_status as enum ('draft', 'processing', 'published', 'failed', 'archived');
create type public.message_role as enum ('user', 'assistant');

create table public.companies (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(btrim(name)) between 1 and 200),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.departments (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete restrict,
    name text not null check (length(btrim(name)) between 1 and 200),
    description text check (length(description) <= 4000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, id),
    unique (company_id, name)
);

-- No auth.users signup trigger: never trust user_metadata for company/role.
-- Provisioning is reserved for an approved trusted backend/admin workflow.
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    company_id uuid not null references public.companies(id) on delete restrict,
    department_id uuid,
    role public.membership_role not null default 'new_employee',
    display_name text check (length(btrim(display_name)) between 1 and 200),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, id),
    foreign key (company_id, department_id)
        references public.departments(company_id, id) on delete restrict
);

create table public.documents (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete restrict,
    department_id uuid,
    uploaded_by uuid not null,
    title text not null check (length(btrim(title)) between 1 and 300),
    description text check (length(description) <= 4000),
    status public.document_status not null default 'draft',
    visibility public.document_visibility not null default 'admins',
    version integer not null default 1 check (version > 0),
    mime_type text not null check (mime_type in (
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    )),
    size_bytes bigint not null check (size_bytes > 0),
    storage_bucket text not null default 'company-documents'
        check (storage_bucket = 'company-documents'),
    storage_path text not null check (
        length(storage_path) between 38 and 1024
        and starts_with(storage_path, company_id::text || '/')
        and storage_path !~ '(^|/)\.\.(/|$)'
        and storage_path !~ '//'
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, id),
    unique (storage_bucket, storage_path),
    foreign key (company_id, department_id)
        references public.departments(company_id, id) on delete restrict,
    foreign key (company_id, uploaded_by)
        references public.profiles(company_id, id) on delete restrict,
    check (visibility <> 'department' or department_id is not null)
);

create table public.document_chunks (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete restrict,
    document_id uuid not null,
    chunk_index integer not null check (chunk_index >= 0),
    content text not null check (length(btrim(content)) > 0),
    page_number integer check (page_number > 0),
    section_title text,
    embedding extensions.vector,
    embedding_model text,
    embedding_dimensions integer,
    created_at timestamptz not null default now(),
    unique (document_id, chunk_index),
    foreign key (company_id, document_id)
        references public.documents(company_id, id) on delete cascade,
    check (
        (embedding is null and embedding_model is null and embedding_dimensions is null)
        or (embedding is not null and embedding_model is not null
            and length(btrim(embedding_model)) > 0 and embedding_dimensions > 0
            and embedding_dimensions is not null
            and extensions.vector_dims(embedding) = embedding_dimensions)
    )
);

create table public.conversations (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete restrict,
    owner_id uuid not null,
    title text check (length(btrim(title)) between 1 and 300),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (company_id, id),
    foreign key (company_id, owner_id)
        references public.profiles(company_id, id) on delete restrict
);

create table public.messages (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete restrict,
    conversation_id uuid not null,
    role public.message_role not null,
    content text not null check (length(btrim(content)) > 0),
    -- Future trusted assistant writer must resolve/authorize every source.
    -- Clients cannot insert/update this column or assistant messages.
    citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
    created_at timestamptz not null default now(),
    foreign key (company_id, conversation_id)
        references public.conversations(company_id, id) on delete cascade,
    check (role <> 'user' or citations = '[]'::jsonb)
);

create index profiles_department_idx on public.profiles(company_id, department_id);
create index documents_access_idx on public.documents(company_id, status, visibility, department_id);
create index documents_uploader_idx on public.documents(company_id, uploaded_by);
create index chunks_document_idx on public.document_chunks(company_id, document_id);
create index conversations_owner_idx on public.conversations(company_id, owner_id, updated_at desc);
create index messages_conversation_idx on public.messages(company_id, conversation_id, created_at, id);
-- No ANN index until a model, dimensions and retrieval metric are approved.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
    new.updated_at = now();
    return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger companies_updated_at before update on public.companies
    for each row execute function private.set_updated_at();
create trigger departments_updated_at before update on public.departments
    for each row execute function private.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
    for each row execute function private.set_updated_at();
create trigger documents_updated_at before update on public.documents
    for each row execute function private.set_updated_at();
create trigger conversations_updated_at before update on public.conversations
    for each row execute function private.set_updated_at();

-- Close all new tables before the first transaction commits. This also
-- overrides broad Supabase default grants while policies are not yet installed.
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.companies force row level security;
alter table public.profiles force row level security;
alter table public.departments force row level security;
alter table public.documents force row level security;
alter table public.document_chunks force row level security;
alter table public.conversations force row level security;
alter table public.messages force row level security;

-- Reset broad Supabase default grants; privilege and RLS checks BOTH apply.
revoke all on table public.companies, public.profiles, public.departments,
    public.documents, public.document_chunks, public.conversations, public.messages
    from public, anon, authenticated;

commit;
