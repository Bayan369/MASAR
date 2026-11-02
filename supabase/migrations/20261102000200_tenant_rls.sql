begin;

-- Definer helpers avoid profiles-policy recursion. They accept no user identity
-- from clients, pin search_path, and derive membership from auth.uid(), not JWT
-- user_metadata. Execute migrations as a trusted database owner with BYPASSRLS.
create function private.current_membership()
returns table(company_id uuid, department_id uuid, role public.membership_role)
language sql stable security definer set search_path = '' as $$
    select p.company_id, p.department_id, p.role
    from public.profiles p
    where p.id = (select auth.uid()) and p.is_active;
$$;

create function private.company_id() returns uuid
language sql stable security definer set search_path = '' as $$
    select m.company_id from private.current_membership() m;
$$;

create function private.is_company_admin() returns boolean
language sql stable security definer set search_path = '' as $$
    select coalesce((select m.role = 'company_admin'::public.membership_role
                     from private.current_membership() m), false);
$$;

create function private.can_read_document(tenant uuid, document uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.documents d
        join private.current_membership() m on m.company_id = d.company_id
        where d.company_id = tenant and d.id = document
        and (m.role = 'company_admin'::public.membership_role or (
            d.status = 'published'::public.document_status and (
                d.visibility = 'company'::public.document_visibility
                or (d.visibility = 'department'::public.document_visibility
                    and d.department_id = m.department_id)
            )
        ))
    );
$$;

revoke all on function private.current_membership() from public, anon, authenticated;
revoke all on function private.company_id() from public, anon, authenticated;
revoke all on function private.is_company_admin() from public, anon, authenticated;
revoke all on function private.can_read_document(uuid, uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_membership() to authenticated;
grant execute on function private.company_id() to authenticated;
grant execute on function private.is_company_admin() to authenticated;
grant execute on function private.can_read_document(uuid, uuid) to authenticated;

grant select on table public.companies, public.profiles, public.departments,
    public.documents, public.document_chunks, public.conversations, public.messages
    to authenticated;
grant update(name) on public.companies to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert(company_id, name, description), update(name, description), delete
    on public.departments to authenticated;
grant insert(company_id, department_id, uploaded_by, title, description,
             visibility, mime_type, size_bytes, storage_bucket, storage_path),
      update(title, description, department_id, visibility, status)
    on public.documents to authenticated;
grant insert(company_id, owner_id, title), update(title), delete
    on public.conversations to authenticated;
grant insert(company_id, conversation_id, role, content) on public.messages to authenticated;
-- No authenticated company/profile provisioning, role changes, document/chunk
-- deletion, ingestion writes, message edits or assistant-message authoring.

create policy companies_read on public.companies for select to authenticated
    using (id = (select private.company_id()));
create policy companies_admin_update on public.companies for update to authenticated
    using (id = (select private.company_id()) and (select private.is_company_admin()))
    with check (id = (select private.company_id()) and (select private.is_company_admin()));

create policy profiles_read on public.profiles for select to authenticated
    using (company_id = (select private.company_id())
           and (id = (select auth.uid()) or (select private.is_company_admin())));
create policy profiles_self_update on public.profiles for update to authenticated
    using (id = (select auth.uid()) and company_id = (select private.company_id()))
    with check (id = (select auth.uid()) and company_id = (select private.company_id()));

create policy departments_read on public.departments for select to authenticated
    using (company_id = (select private.company_id()));
create policy departments_admin_insert on public.departments for insert to authenticated
    with check (company_id = (select private.company_id()) and (select private.is_company_admin()));
create policy departments_admin_update on public.departments for update to authenticated
    using (company_id = (select private.company_id()) and (select private.is_company_admin()))
    with check (company_id = (select private.company_id()) and (select private.is_company_admin()));
create policy departments_admin_delete on public.departments for delete to authenticated
    using (company_id = (select private.company_id()) and (select private.is_company_admin()));

create policy documents_read on public.documents for select to authenticated
    using (private.can_read_document(company_id, id));
create policy documents_admin_insert on public.documents for insert to authenticated
    with check (company_id = (select private.company_id())
        and (select private.is_company_admin()) and uploaded_by = (select auth.uid()));
create policy documents_admin_update on public.documents for update to authenticated
    using (company_id = (select private.company_id()) and (select private.is_company_admin()))
    with check (company_id = (select private.company_id()) and (select private.is_company_admin()));
create policy chunks_read on public.document_chunks for select to authenticated
    using (private.can_read_document(company_id, document_id));

create policy conversations_read on public.conversations for select to authenticated
    using (company_id = (select private.company_id()) and owner_id = (select auth.uid()));
create policy conversations_insert on public.conversations for insert to authenticated
    with check (company_id = (select private.company_id()) and owner_id = (select auth.uid()));
create policy conversations_update on public.conversations for update to authenticated
    using (company_id = (select private.company_id()) and owner_id = (select auth.uid()))
    with check (company_id = (select private.company_id()) and owner_id = (select auth.uid()));
create policy conversations_delete on public.conversations for delete to authenticated
    using (company_id = (select private.company_id()) and owner_id = (select auth.uid()));

create policy messages_read on public.messages for select to authenticated
    using (company_id = (select private.company_id()) and exists (
        select 1 from public.conversations c
        where c.company_id = messages.company_id and c.id = messages.conversation_id
            and c.owner_id = (select auth.uid())
    ));
create policy messages_user_insert on public.messages for insert to authenticated
    with check (role = 'user'::public.message_role
        and company_id = (select private.company_id()) and exists (
            select 1 from public.conversations c
            where c.company_id = messages.company_id and c.id = messages.conversation_id
                and c.owner_id = (select auth.uid())
        ));

commit;
