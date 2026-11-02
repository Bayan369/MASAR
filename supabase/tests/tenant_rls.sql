-- LOCAL TEST FIXTURES ONLY. All data/functions/schema roll back at the end.
-- Never execute this test file against a hosted project.
begin;
create schema masar_test;
grant usage on schema masar_test to authenticated, anon;
create table masar_test.results (label text primary key);
grant insert on masar_test.results to authenticated, anon;
create function masar_test.ok(condition boolean, label text) returns void
language plpgsql as $$
begin
    if condition is distinct from true then raise exception 'FAIL: %', label; end if;
    insert into masar_test.results values (label);
    raise notice 'PASS: %', label;
end;
$$;
create function masar_test.throws(statement text, expected_state text, label text) returns void
language plpgsql as $$
declare actual_state text;
begin
    begin
        execute statement;
    exception when others then
        get stacked diagnostics actual_state = returned_sqlstate;
    end;
    perform masar_test.ok(actual_state = expected_state, label);
end;
$$;

insert into public.companies(id, name) values
('10000000-0000-0000-0000-000000000001', 'TEST TENANT A'),
('20000000-0000-0000-0000-000000000001', 'TEST TENANT B');
insert into public.departments(id, company_id, name) values
('10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'TEST DEPARTMENT A1'),
('10000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001', 'TEST DEPARTMENT A2'),
('20000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000001', 'TEST DEPARTMENT B');
insert into auth.users(id) values
('a0000000-0000-0000-0000-000000000001'), -- Admin A
('a0000000-0000-0000-0000-000000000002'), -- Employee A1
('a0000000-0000-0000-0000-000000000003'), -- Employee A2
('b0000000-0000-0000-0000-000000000001'), -- Admin B
('a0000000-0000-0000-0000-000000000004'), -- Inactive A
('a0000000-0000-0000-0000-000000000005'); -- No profile
insert into public.profiles(id, company_id, department_id, role, is_active) values
('a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',null,'company_admin',true),
('a0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000010','new_employee',true),
('a0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000020','new_employee',true),
('b0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',null,'company_admin',true),
('a0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',null,'new_employee',false);
insert into public.documents(id,company_id,uploaded_by,title,status,visibility,department_id,mime_type,size_bytes,storage_path) values
('d0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','TEST company document','published','company',null,'text/plain',10,'10000000-0000-0000-0000-000000000001/test-1.txt'),
('d0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','TEST department document','published','department','10000000-0000-0000-0000-000000000010','application/pdf',10,'10000000-0000-0000-0000-000000000001/test-2.pdf'),
('d0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','TEST admin document','published','admins',null,'text/plain',10,'10000000-0000-0000-0000-000000000001/test-3.txt'),
('d0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','TEST draft','draft','company',null,'text/plain',10,'10000000-0000-0000-0000-000000000001/test-4.txt'),
('d0000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','TEST tenant B','published','company',null,'text/plain',10,'20000000-0000-0000-0000-000000000001/test-5.txt');
insert into public.document_chunks(company_id,document_id,chunk_index,content)
select company_id,id,0,'TEST passage — not company policy' from public.documents;
insert into public.conversations(id,company_id,owner_id) values
('c0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003'),
('c0000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001');
insert into public.messages(company_id,conversation_id,role,content)
select company_id,id,'user','TEST question' from public.conversations;

-- Catalog checks are run as the local migration owner, never a service key.
select masar_test.ok((select count(*) = 7 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('companies','profiles','departments','documents','document_chunks','conversations','messages') and c.relrowsecurity and c.relforcerowsecurity), 'RLS enabled and forced on all seven tables');
select masar_test.ok((select count(*)=4 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.prosecdef and p.proconfig @> array['search_path=""']), 'all four definer helpers pin empty search_path');

set local role anon;
do $$
declare table_name text;
begin
    foreach table_name in array array['companies','profiles','departments','documents','document_chunks','conversations','messages'] loop
        perform masar_test.throws(format('select * from public.%I',table_name),'42501','anonymous read denied: '||table_name);
    end loop;
end;
$$;
select masar_test.throws('select private.company_id()','42501','anonymous helper execution denied');
reset role;

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select masar_test.ok((select count(*)=1 from public.companies),'employee sees own company only');
select masar_test.ok((select count(*)=1 from public.profiles),'employee sees own profile only');
select masar_test.ok((select count(*)=2 from public.departments),'employee sees own company departments');
select masar_test.ok((select count(*)=2 from public.documents),'employee sees published company and own-department documents only');
select masar_test.ok((select count(*)=2 from public.document_chunks),'chunks inherit document visibility');
select masar_test.ok((select count(*)=1 from public.conversations),'employee sees own conversation only');
select masar_test.ok((select count(*)=1 from public.messages),'employee sees own messages only');
select masar_test.ok(not private.can_read_document('20000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000005'),'helper rejects cross-tenant document probe');
update public.profiles set display_name='TEST self-edit' where id=auth.uid();
select masar_test.ok((select display_name='TEST self-edit' from public.profiles where id=auth.uid()),'employee may update own display name');
select masar_test.throws($q$update public.profiles set role='company_admin' where id=auth.uid()$q$,'42501','self-promotion denied');
select masar_test.throws($q$update public.profiles set company_id='20000000-0000-0000-0000-000000000001' where id=auth.uid()$q$,'42501','self tenant reassignment denied');
select masar_test.throws($q$update public.profiles set department_id='10000000-0000-0000-0000-000000000020' where id=auth.uid()$q$,'42501','self department reassignment denied');
select masar_test.throws('update public.profiles set is_active=true where id=auth.uid()','42501','self activation write denied');
select masar_test.throws($q$insert into public.profiles(id,company_id,role) values(auth.uid(),'10000000-0000-0000-0000-000000000001','company_admin')$q$,'42501','self profile provisioning denied');
select masar_test.throws($q$insert into public.departments(company_id,name) values('10000000-0000-0000-0000-000000000001','TEST denied')$q$,'42501','employee department creation denied');
with changed as (update public.companies set name='TEST denied' returning id)
select masar_test.ok((select count(*)=0 from changed),'employee company update affects zero rows');
select masar_test.throws($q$insert into public.documents(company_id,uploaded_by,title,mime_type,size_bytes,storage_path) values('10000000-0000-0000-0000-000000000001',auth.uid(),'TEST denied','text/plain',1,'10000000-0000-0000-0000-000000000001/denied.txt')$q$,'42501','employee document creation denied');
select masar_test.throws($q$insert into public.document_chunks(company_id,document_id,chunk_index,content) values('10000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',1,'TEST denied')$q$,'42501','browser ingestion writes denied');
select masar_test.throws($q$insert into public.conversations(company_id,owner_id) values('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003')$q$,'42501','creating another employees conversation denied');
select masar_test.throws($q$insert into public.conversations(company_id,owner_id) values('20000000-0000-0000-0000-000000000001',auth.uid())$q$,'42501','cross-tenant conversation insert denied');
insert into public.conversations(company_id,owner_id,title) values('10000000-0000-0000-0000-000000000001',auth.uid(),'TEST owned');
select masar_test.ok((select count(*)=2 from public.conversations),'own conversation creation allowed');
update public.conversations set title='TEST renamed' where title='TEST owned';
select masar_test.ok((select count(*)=1 from public.conversations where title='TEST renamed'),'own conversation rename allowed');
select masar_test.throws($q$update public.conversations set owner_id='a0000000-0000-0000-0000-000000000003'$q$,'42501','conversation ownership transfer denied');
insert into public.messages(company_id,conversation_id,role,content) values('10000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','user','TEST own question');
select masar_test.ok((select count(*)=2 from public.messages),'own user message insert allowed');
select masar_test.throws($q$insert into public.messages(company_id,conversation_id,role,content) values('10000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','assistant','TEST forged answer')$q$,'42501','forged assistant message denied');
select masar_test.throws($q$insert into public.messages(company_id,conversation_id,role,content) values('10000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','user','TEST denied')$q$,'42501','inserting into peer conversation denied');
select masar_test.throws($q$insert into public.messages(company_id,conversation_id,role,content,citations) values('10000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','user','TEST denied','[]')$q$,'42501','browser citation writes denied even when empty');
select masar_test.throws($q$update public.messages set content='TEST changed'$q$,'42501','message tampering denied');
select masar_test.throws('delete from public.messages','42501','direct message deletion denied');
select masar_test.throws('delete from public.documents','42501','direct document deletion denied');
-- Forged user metadata never changes database membership.
select set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000002","user_metadata":{"role":"company_admin","company_id":"20000000-0000-0000-0000-000000000001"}}',true);
select masar_test.ok(not private.is_company_admin(),'user_metadata cannot grant admin');
select masar_test.ok(private.company_id()='10000000-0000-0000-0000-000000000001','user_metadata cannot change tenant');
reset role;

-- Switching departments is a trusted local-fixture action, never a client grant.
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select masar_test.ok((select count(*)=1 from public.documents),'other department cannot see restricted document');
select masar_test.ok((select count(*)=1 from public.document_chunks),'other department cannot see restricted chunks');
reset role;

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select masar_test.ok((select count(*)=4 from public.documents),'company admin sees all own-company documents including draft');
select masar_test.ok((select count(*)=4 from public.document_chunks),'company admin sees own-company chunks');
select masar_test.ok((select count(*)=4 from public.profiles),'company admin sees own-company profiles including inactive');
select masar_test.ok((select count(*)=0 from public.conversations),'company admin cannot read employees private conversations');
select masar_test.ok((select count(*)=0 from public.messages),'company admin cannot read employees private messages');
select masar_test.throws($q$update public.profiles set role='new_employee' where id=auth.uid()$q$,'42501','admin cannot change own role');
select masar_test.throws($q$update public.profiles set role='company_admin'$q$,'42501','direct admin role management denied');
insert into public.departments(company_id,name) values('10000000-0000-0000-0000-000000000001','TEST removable');
select masar_test.ok((select count(*)=1 from public.departments where name='TEST removable'),'admin department creation allowed');
update public.departments set description='TEST description' where name='TEST removable';
select masar_test.ok((select description='TEST description' from public.departments where name='TEST removable'),'admin department edit allowed');
delete from public.departments where name='TEST removable';
select masar_test.ok((select count(*)=0 from public.departments where name='TEST removable'),'admin unreferenced department deletion allowed');
select masar_test.throws($q$insert into public.departments(company_id,name) values('20000000-0000-0000-0000-000000000001','TEST cross tenant')$q$,'42501','admin cannot create another tenants department');
with changed as (update public.departments set name='TEST denied' where company_id='20000000-0000-0000-0000-000000000001' returning id)
select masar_test.ok((select count(*)=0 from changed),'admin cannot update cross-tenant departments');
insert into public.documents(company_id,uploaded_by,title,visibility,mime_type,size_bytes,storage_path)
values('10000000-0000-0000-0000-000000000001',auth.uid(),'TEST created','company','text/plain',1,'10000000-0000-0000-0000-000000000001/new.txt');
select masar_test.ok((select status='draft' from public.documents where title='TEST created'),'admin document creation defaults to draft');
update public.documents set status='published' where title='TEST created';
select masar_test.ok((select status='published' from public.documents where title='TEST created'),'admin may publish document metadata');
select masar_test.throws($q$update public.documents set storage_path='10000000-0000-0000-0000-000000000001/changed.txt'$q$,'42501','admin browser cannot rewrite document provenance');
select masar_test.throws($q$insert into public.documents(company_id,uploaded_by,title,department_id,visibility,mime_type,size_bytes,storage_path) values('10000000-0000-0000-0000-000000000001',auth.uid(),'TEST denied','20000000-0000-0000-0000-000000000010','department','text/plain',1,'10000000-0000-0000-0000-000000000001/cross.txt')$q$,'23503','composite FK rejects cross-tenant department reference');
select masar_test.throws($q$insert into public.documents(company_id,uploaded_by,title,mime_type,size_bytes,storage_path) values('10000000-0000-0000-0000-000000000001',auth.uid(),'TEST denied','text/plain',1,'20000000-0000-0000-0000-000000000001/wrong.txt')$q$,'23514','storage path must match owning company');
select masar_test.throws($q$insert into public.documents(company_id,uploaded_by,title,mime_type,size_bytes,storage_path) values('10000000-0000-0000-0000-000000000001',auth.uid(),'TEST denied','application/x-executable',1,'10000000-0000-0000-0000-000000000001/file.exe')$q$,'23514','unsupported document MIME rejected');
reset role;

-- Trusted fixture changes prove revocation is evaluated from the database.
update public.documents set status='archived' where id='d0000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select masar_test.ok(not exists(select 1 from public.documents where id='d0000000-0000-0000-0000-000000000001'),'archived documents disappear from employee reads');
select masar_test.ok((select count(*)=1 from public.document_chunks),'archived document chunks disappear');
reset role;
update public.profiles set is_active=false where id='a0000000-0000-0000-0000-000000000002';
set local role authenticated;
select masar_test.ok((select count(*)=0 from public.documents),'deactivated employee loses document access immediately');
select masar_test.ok((select count(*)=0 from public.conversations),'deactivated employee loses conversation access immediately');
select masar_test.throws($q$insert into public.conversations(company_id,owner_id) values('10000000-0000-0000-0000-000000000001',auth.uid())$q$,'42501','deactivated employee cannot create conversations');
reset role;

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000005',true);
set local role authenticated;
select masar_test.ok((select count(*)=0 from public.companies),'authenticated user without provisioned membership sees no tenant');
select masar_test.ok((select count(*)=0 from public.profiles),'unprovisioned user sees no profiles');
reset role;
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select masar_test.ok((select count(*)=1 from public.documents),'second tenant admin sees only second tenant documents');
select masar_test.ok((select count(*)=1 from public.conversations),'second tenant admin sees own conversation');
reset role;

select masar_test.throws($q$insert into public.document_chunks(company_id,document_id,chunk_index,content) values('20000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',99,'TEST cross')$q$,'23503','chunk composite FK prevents cross-tenant document references');
select masar_test.throws($q$insert into public.messages(company_id,conversation_id,role,content) values('20000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','user','TEST cross')$q$,'23503','message composite FK prevents cross-tenant conversation references');
select masar_test.throws($q$insert into public.document_chunks(company_id,document_id,chunk_index,content,embedding,embedding_model,embedding_dimensions) values('10000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',99,'TEST vector','[1,2,3]','TEST model',2)$q$,'23514','embedding dimension mismatch rejected');
insert into public.document_chunks(company_id,document_id,chunk_index,content,embedding,embedding_model,embedding_dimensions)
values('10000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',99,'TEST vector','[1,2,3]','TEST model',3);
select masar_test.ok((select count(*)=1 from public.document_chunks where chunk_index=99),'dimension-consistent vector accepted without choosing production model');
select masar_test.throws($q$insert into public.document_chunks(company_id,document_id,chunk_index,content) values('10000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',99,'TEST duplicate')$q$,'23505','duplicate document chunk index rejected');
select masar_test.throws($q$insert into public.messages(company_id,conversation_id,role,content) values('10000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','user','   ')$q$,'23514','blank message rejected');
select masar_test.throws($q$delete from public.departments where id='10000000-0000-0000-0000-000000000010'$q$,'23503','referenced department deletion blocked');

select masar_test.throws($q$insert into public.document_chunks(company_id,document_id,chunk_index,content,embedding,embedding_model) values('10000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',100,'TEST vector','[1,2,3]','TEST model')$q$,'23514','partial embedding metadata rejected');
select masar_test.throws($q$insert into public.documents(company_id,uploaded_by,title,visibility,mime_type,size_bytes,storage_path) values('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','TEST invalid visibility','department','text/plain',1,'10000000-0000-0000-0000-000000000001/missing-department.txt')$q$,'23514','department visibility requires department');
select masar_test.throws($q$insert into public.documents(company_id,uploaded_by,title,mime_type,size_bytes,storage_path) values('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','TEST path traversal','text/plain',1,'10000000-0000-0000-0000-000000000001/../hidden.txt')$q$,'23514','storage parent traversal rejected');
select 'TESTS_PASSED=' || count(*) from masar_test.results;
rollback;
