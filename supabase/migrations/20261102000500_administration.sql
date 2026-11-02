begin;
-- Only verified backend administrators may adjust tenant membership. No self
-- permission/tenant mutations and no transfer between companies.
create function public.update_member(actor uuid,member_id uuid,department uuid,assigned_role public.membership_role,active boolean) returns void
language plpgsql set search_path='' as $$
declare tenant uuid:=private.require_admin(actor);
begin
 if actor=member_id then raise exception 'Self permission change denied' using errcode='42501'; end if;
 update public.profiles p set department_id=department,role=assigned_role,is_active=active
 where p.id=member_id and p.company_id=tenant;
 if not found then raise exception 'Member not found' using errcode='P0002'; end if;
end; $$;
create function public.edit_document(actor uuid,document_id uuid,document_title text,department uuid,scope public.document_visibility) returns void
language plpgsql set search_path='' as $$
declare tenant uuid:=private.require_admin(actor);
begin
 update public.documents d set title=document_title,department_id=department,visibility=scope
 where d.id=document_id and d.company_id=tenant;
 if not found then raise exception 'Document not found' using errcode='P0002'; end if;
end; $$;
revoke all on function public.update_member(uuid,uuid,uuid,public.membership_role,boolean),public.edit_document(uuid,uuid,text,uuid,public.document_visibility) from public,anon,authenticated;
grant execute on function public.update_member(uuid,uuid,uuid,public.membership_role,boolean),public.edit_document(uuid,uuid,text,uuid,public.document_visibility) to service_role;
commit;
