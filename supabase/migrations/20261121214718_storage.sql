begin;
-- Public assets are explicitly published files. Admission documents are always private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('branding','branding',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('teachers','teachers',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('gallery','gallery',true,26214400,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']),
 ('admission-documents','admission-documents',false,10485760,array['application/pdf','image/jpeg','image/png']),
 ('academic-documents','academic-documents',true,10485760,array['application/pdf']),
 ('website-media','website-media',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy school_admin_storage on storage.objects for all to authenticated using(bucket_id in('branding','teachers','gallery','admission-documents','academic-documents','website-media') and (select public.is_admin())) with check(bucket_id in('branding','teachers','gallery','admission-documents','academic-documents','website-media') and (select public.is_admin()));
-- Storage authorization also protects signed URL generation for the private bucket.
commit;
