begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('company-documents','company-documents',false,5242880,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'])
on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='company-documents' and public) then raise exception 'Existing company-documents bucket is public; review before proceeding'; end if;
end $$;
create policy masar_private_read on storage.objects for select to authenticated using(
 bucket_id='company-documents' and exists(select 1 from public.documents d where d.storage_bucket=bucket_id and d.storage_path=name and private.can_read_document(d.company_id,d.id)));
-- Restrictive guards defeat unrelated broad permissive policies for our bucket.
create policy masar_anon_guard on storage.objects as restrictive for all to anon using(bucket_id<>'company-documents') with check(bucket_id<>'company-documents');
create policy masar_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'company-documents' or exists(select 1 from public.documents d where d.storage_bucket=bucket_id and d.storage_path=name and private.can_read_document(d.company_id,d.id)));
create policy masar_insert_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'company-documents');
create policy masar_update_guard on storage.objects as restrictive for update to authenticated using(bucket_id<>'company-documents') with check(bucket_id<>'company-documents');
create policy masar_delete_guard on storage.objects as restrictive for delete to authenticated using(bucket_id<>'company-documents');
commit;
