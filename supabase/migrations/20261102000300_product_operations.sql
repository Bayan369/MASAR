begin;

alter table public.documents add column content_sha256 text check (content_sha256 ~ '^[0-9a-f]{64}$');
alter table public.documents add column original_name text check (length(original_name) <= 255);
alter table public.documents add column uploaded_at timestamptz;
alter table public.documents add column processing_error text;
alter table public.documents add column processing_token uuid;
alter table public.documents add column processing_started_at timestamptz;
create unique index documents_company_hash on public.documents(company_id, content_sha256) where content_sha256 is not null;
create index documents_queue on public.documents(created_at) where status = 'draft';
alter table public.conversations add column initial_request_id uuid;
create unique index conversations_initial_request on public.conversations(owner_id,initial_request_id) where initial_request_id is not null;
alter table public.messages add column turn_id uuid;
alter table public.messages add column response_status text check(response_status in ('answered','not_found'));
alter table public.messages add column model text;
create unique index messages_turn_role on public.messages(conversation_id,turn_id,role) where turn_id is not null;

-- Browser writes cannot create unpublished jobs/provenance, assistant messages,
-- or privileged membership. Trusted RPCs revalidate the verified actor.
revoke insert,update,delete on public.documents from authenticated;
revoke insert(company_id,department_id,uploaded_by,title,description,visibility,mime_type,size_bytes,storage_bucket,storage_path),update(title,description,department_id,visibility,status) on public.documents from authenticated;
revoke insert(company_id,conversation_id,role,content) on public.messages from authenticated;
grant all on public.companies,public.profiles,public.departments,public.documents,public.document_chunks,public.conversations,public.messages to service_role;
grant usage on schema public,private,extensions to service_role;
grant usage on type public.membership_role,public.document_visibility,public.document_status,public.message_role to service_role;

create function private.require_admin(actor uuid) returns uuid
language plpgsql set search_path='' as $$
declare tenant uuid;
begin
 select company_id into tenant from public.profiles where id=actor and is_active and role='company_admin';
 if tenant is null then raise exception 'Administrator required' using errcode='42501'; end if;
 return tenant;
end; $$;
revoke all on function private.require_admin(uuid) from public,anon,authenticated;
grant execute on function private.require_admin(uuid) to service_role;

create function public.bootstrap_company(admin_id uuid,company_name text,display_name text) returns uuid
language plpgsql set search_path='' as $$
declare tenant uuid;
begin
 if exists(select 1 from public.profiles where id=admin_id) then raise exception 'Membership already exists' using errcode='23505'; end if;
 insert into public.companies(name) values(company_name) returning id into tenant;
 insert into public.profiles(id,company_id,role,display_name) values(admin_id,tenant,'company_admin',display_name);
 return tenant;
end; $$;

create function public.provision_member(actor uuid,member_id uuid,member_name text,member_department uuid,member_role public.membership_role default 'new_employee') returns void
language plpgsql set search_path='' as $$
declare tenant uuid:=private.require_admin(actor);
begin
 if actor=member_id then raise exception 'Self membership changes denied' using errcode='42501'; end if;
 insert into public.profiles(id,company_id,display_name,department_id,role)
 values(member_id,tenant,member_name,member_department,member_role);
end; $$;

create function public.register_document(actor uuid,document_id uuid,document_title text,department uuid,document_visibility public.document_visibility,mime text,byte_size bigint,file_hash text,object_path text,file_name text) returns public.documents
language plpgsql set search_path='' as $$
declare tenant uuid:=private.require_admin(actor); row public.documents;
begin
 insert into public.documents(id,company_id,uploaded_by,title,department_id,visibility,mime_type,size_bytes,content_sha256,storage_path,original_name)
 values(document_id,tenant,actor,document_title,department,document_visibility,mime,byte_size,file_hash,object_path,file_name) returning * into row;
 return row;
end; $$;

create function public.claim_document() returns setof public.documents
language plpgsql set search_path='' as $$
begin
 return query update public.documents set status='processing',processing_token=gen_random_uuid(),processing_started_at=now(),processing_error=null
 where id=(select id from public.documents where (status='draft' and uploaded_at is not null) or (status='processing' and processing_started_at<now()-interval '10 minutes')
 order by created_at for update skip locked limit 1) returning *;
end; $$;

create function public.finish_document(document_id uuid,lease uuid,parts jsonb) returns void
language plpgsql set search_path='' as $$
declare row public.documents; part jsonb;
begin
 select * into row from public.documents where id=document_id and status='processing' and processing_token=lease for update;
 if not found then raise exception 'Processing lease lost' using errcode='42501'; end if;
 if jsonb_typeof(parts)<>'array' or jsonb_array_length(parts) not between 1 and 80 then raise exception 'Invalid parts' using errcode='22023'; end if;
 delete from public.document_chunks where document_chunks.document_id=row.id;
 for part in select * from jsonb_array_elements(parts) loop
  if length(part->>'content') not between 1 and 2400 then raise exception 'Invalid chunk length' using errcode='22023'; end if;
  insert into public.document_chunks(company_id,document_id,chunk_index,content,page_number,section_title,embedding,embedding_model,embedding_dimensions)
  values(row.company_id,row.id,(part->>'chunk_index')::integer,part->>'content',(part->>'page_number')::integer,part->>'section_title',
   (part->>'embedding')::extensions.vector,'@cf/baai/bge-m3',1024);
 end loop;
 update public.documents set status='published',processing_token=null,processing_started_at=null,processing_error=null where id=row.id;
end; $$;

create function public.fail_document(document_id uuid,lease uuid,error_code text) returns void
language sql set search_path='' as $$
 update public.documents set status='failed',processing_token=null,processing_started_at=null,processing_error=left(error_code,80)
 where id=document_id and processing_token=lease and status='processing';
$$;

create function public.manage_document(actor uuid,document_id uuid,operation text) returns public.documents
language plpgsql set search_path='' as $$
declare tenant uuid:=private.require_admin(actor); row public.documents;
begin
 select * into row from public.documents where id=document_id and company_id=tenant for update;
 if not found then raise exception 'Document not found' using errcode='P0002'; end if;
 if operation='retry' then
  if row.status<>'failed' or row.uploaded_at is null then raise exception 'Only failed documents can retry' using errcode='22023'; end if;
  update public.documents set status='draft',processing_error=null where id=document_id returning * into row;
 elsif operation='archive' then
  update public.documents set status='archived',processing_token=null,processing_started_at=null where id=document_id returning * into row;
 elsif operation='delete' then
  if row.status<>'archived' then raise exception 'Archive first' using errcode='22023'; end if;
  delete from public.documents where id=document_id;
 else raise exception 'Invalid operation' using errcode='22023';
 end if;
 return row;
end; $$;

grant insert(initial_request_id) on public.conversations to authenticated;

-- Read using caller JWT and RLS, NEVER the service connection.
create function public.search_chunks(query_text text,query_embedding extensions.vector default null,result_limit integer default 6)
returns table(id uuid,document_id uuid,title text,section_title text,content text,page_number integer,score double precision)
language sql stable security invoker set search_path='' as $$
 select c.id,c.document_id,d.title,c.section_title,c.content,c.page_number,
 case when query_embedding is null then ts_rank_cd(to_tsvector('simple',c.content),plainto_tsquery('simple',query_text))::double precision
 else 0.85*(1-(c.embedding OPERATOR(extensions.<=>) query_embedding))+0.15*ts_rank_cd(to_tsvector('simple',c.content),plainto_tsquery('simple',query_text))::double precision end as score
 from public.document_chunks c join public.documents d on d.id=c.document_id and d.company_id=c.company_id
 where d.status='published' and (
  (query_embedding is null and to_tsvector('simple',c.content) @@ plainto_tsquery('simple',query_text)) or
  (query_embedding is not null and extensions.vector_dims(query_embedding)=1024
   and c.embedding_model='@cf/baai/bge-m3' and c.embedding_dimensions=1024
   and ((c.embedding OPERATOR(extensions.<=>) query_embedding)<0.65 or to_tsvector('simple',c.content) @@ plainto_tsquery('simple',query_text))))
 order by score desc,c.id limit least(greatest(result_limit,1),12);
$$;
revoke all on function public.search_chunks(text,extensions.vector,integer) from public,anon;
grant execute on function public.search_chunks(text,extensions.vector,integer) to authenticated;
grant usage on schema extensions to authenticated;
create index chunks_lexical on public.document_chunks using gin(to_tsvector('simple',content));
create index chunks_bge_m3_cosine on public.document_chunks using hnsw((embedding::extensions.vector(1024)) extensions.vector_cosine_ops)
 where embedding_model='@cf/baai/bge-m3' and embedding_dimensions=1024;

-- Prior citations can become inaccessible after document archival/deletion or a
-- department change; hide the whole assistant message, not just its link.
-- Preserve the existing policy object while tightening source revocation.
alter policy messages_read on public.messages using (
 company_id=(select private.company_id()) and exists(select 1 from public.conversations c where c.id=messages.conversation_id and c.company_id=messages.company_id and c.owner_id=(select auth.uid()))
 and (role='user' or not exists(select 1 from jsonb_array_elements(citations) ref where not private.can_read_document(messages.company_id,(ref->>'document_id')::uuid))));

create function public.save_turn(actor uuid,conversation uuid,request_id uuid,question text,answer text,source_refs jsonb,answer_status text,model_id text) returns void
language plpgsql set search_path='' as $$
declare member public.profiles; conv public.conversations; ref jsonb; previous text;
begin
 select * into member from public.profiles where id=actor and is_active;
 if not found then raise exception 'Membership required' using errcode='42501'; end if;
 select * into conv from public.conversations where id=conversation and owner_id=actor and company_id=member.company_id for update;
 if not found then raise exception 'Conversation denied' using errcode='42501'; end if;
 select content into previous from public.messages where conversation_id=conversation and turn_id=request_id and role='user';
 if found then
  if previous<>question then raise exception 'Request ID conflict' using errcode='23505'; end if;
  return;
 end if;
 if jsonb_typeof(source_refs)<>'array' or jsonb_array_length(source_refs)>12 then raise exception 'Invalid sources' using errcode='22023'; end if;
 if answer_status='answered' and jsonb_array_length(source_refs)=0 then raise exception 'Sources required' using errcode='22023'; end if;
 for ref in select * from jsonb_array_elements(source_refs) loop
  if not exists(select 1 from public.document_chunks ch join public.documents d on d.id=ch.document_id and d.company_id=ch.company_id
   where ch.id=(ref->>'chunk_id')::uuid and d.id=(ref->>'document_id')::uuid and d.company_id=member.company_id
   and length(ref->>'quote')>0 and position((ref->>'quote') in ch.content)>0
   and d.status='published' and (member.role='company_admin' or d.visibility='company' or (d.visibility='department' and d.department_id=member.department_id)))
  then raise exception 'Source not permitted or quote invalid' using errcode='42501'; end if;
 end loop;
 insert into public.messages(company_id,conversation_id,role,content,turn_id) values(member.company_id,conv.id,'user',question,request_id);
 insert into public.messages(company_id,conversation_id,role,content,turn_id,citations,response_status,model)
 values(member.company_id,conv.id,'assistant',answer,request_id,source_refs,answer_status,model_id);
 update public.conversations set updated_at=now() where id=conv.id;
end; $$;

create function public.mark_document_uploaded(actor uuid,document_id uuid,successful boolean) returns void
language plpgsql set search_path='' as $$
declare tenant uuid:=private.require_admin(actor);
begin
 update public.documents d set uploaded_at=case when successful then now() else null end,
 status=case when successful then 'draft'::public.document_status else 'failed'::public.document_status end,
 processing_error=case when successful then null else 'UPLOAD_FAILED' end
 where d.id=document_id and d.company_id=tenant and d.status='draft' and d.uploaded_at is null;
 if not found then raise exception 'Upload state invalid' using errcode='42501'; end if;
end; $$;
revoke all on function public.mark_document_uploaded(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.mark_document_uploaded(uuid,uuid,boolean) to service_role;

-- No anonymous/browser execution for trusted write RPCs.
revoke all on function public.bootstrap_company(uuid,text,text),public.provision_member(uuid,uuid,text,uuid,public.membership_role),public.register_document(uuid,uuid,text,uuid,public.document_visibility,text,bigint,text,text,text),public.claim_document(),public.finish_document(uuid,uuid,jsonb),public.fail_document(uuid,uuid,text),public.manage_document(uuid,uuid,text),public.save_turn(uuid,uuid,uuid,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.bootstrap_company(uuid,text,text),public.provision_member(uuid,uuid,text,uuid,public.membership_role),public.register_document(uuid,uuid,text,uuid,public.document_visibility,text,bigint,text,text,text),public.claim_document(),public.finish_document(uuid,uuid,jsonb),public.fail_document(uuid,uuid,text),public.manage_document(uuid,uuid,text),public.save_turn(uuid,uuid,uuid,text,text,jsonb,text,text) to service_role;
commit;
