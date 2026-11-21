-- Single-school tenancy. All writes are authorized in PostgreSQL, not just the UI.
begin;
create schema if not exists private;
revoke all on schema private from public;
create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade, role text not null default 'super_admin' check(role='super_admin'), singleton boolean not null default true unique check(singleton), display_name text not null default 'Administrator', created_at timestamptz not null default now());
alter table public.admins enable row level security;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.admins where user_id=(select auth.uid()) and role='super_admin'); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon,authenticated,service_role;
create policy admin_self on public.admins for select to authenticated using(user_id=(select auth.uid()));
create policy admin_profile on public.admins for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.admins from anon,authenticated;
grant select on public.admins to authenticated;
grant update(display_name) on public.admins to authenticated;

create table public.settings (id uuid primary key default gen_random_uuid(), singleton boolean not null default true unique check(singleton), school_name_bn text not null default '[বিদ্যালয়ের নাম]', school_name_en text not null default '[School name]', tagline_bn text default 'শিখি আনন্দে, গড়ি আগামী', tagline_en text default 'A happy beginning. A brighter tomorrow.', address_bn text default '[বিদ্যালয়ের ঠিকানা]', address_en text default '[School address]', phone text default '', email text default '', logo_url text default '', hero_image_url text default '', map_url text default '', facebook_url text default '', admission_open boolean not null default false, admission_requirements_bn text default '[ভর্তির শর্ত ও প্রয়োজনীয় কাগজপত্র যোগ করুন]', admission_requirements_en text default '[Add admission requirements and required documents]', seo_description_bn text default 'প্রাথমিক বিদ্যালয়ের তথ্য ও শিক্ষাসেবা।', seo_description_en text default 'Primary school information and academic services.', social_image_url text default '', created_at timestamptz not null default now());
insert into public.settings default values;
create table public.content (id uuid primary key default gen_random_uuid(), section text not null check(section in('welcome','history','mission','vision','objectives','facilities','achievements','infrastructure','highlights','timings','policies')), title_bn text not null, title_en text default '', body_bn text not null default '', body_en text default '', image_url text default '', sort_order integer not null default 0, published boolean not null default false, created_at timestamptz not null default now());
create table public.people (id uuid primary key default gen_random_uuid(), kind text not null check(kind in('principal','assistant_head','teacher','staff','committee')), name_bn text not null, name_en text default '', designation_bn text default '', designation_en text default '', qualification_bn text default '', qualification_en text default '', subjects_bn text default '', subjects_en text default '', bio_bn text default '', bio_en text default '', photo_url text default '', published boolean not null default false, created_at timestamptz not null default now());
create table public.notices (id uuid primary key default gen_random_uuid(), title_bn text not null, title_en text default '', body_bn text default '', body_en text default '', category text not null default 'general' check(category in('general','admission','examination','holiday','important')), attachment_url text default '', pinned boolean not null default false, publish_at timestamptz not null default now(), published boolean not null default false, created_at timestamptz not null default now());
create index notices_publication on public.notices(published,publish_at desc);
create table public.events (id uuid primary key default gen_random_uuid(), title_bn text not null, title_en text default '', body_bn text default '', body_en text default '', kind text not null default 'news' check(kind in('news','event','calendar')), event_date date not null default current_date, image_url text default '', published boolean not null default false, created_at timestamptz not null default now());
create table public.gallery (id uuid primary key default gen_random_uuid(), title_bn text not null, title_en text default '', category text not null default 'classroom' check(category in('classroom','cultural','sports','annual','trips','events')), media_type text not null default 'image' check(media_type in('image','video')), media_url text not null, alt_bn text default '', alt_en text default '', published boolean not null default false, created_at timestamptz not null default now());
create table public.academic_documents (id uuid primary key default gen_random_uuid(), title_bn text not null, title_en text default '', body_bn text default '', body_en text default '', kind text not null default 'download' check(kind in('routine','exam_routine','syllabus','curriculum','download','admission_form')), class_level integer check(class_level between 1 and 5), file_url text default '', published boolean not null default false, created_at timestamptz not null default now());
create table public.classes (id uuid primary key default gen_random_uuid(), name_bn text not null, name_en text default '', level integer not null check(level between 1 and 5), section text not null default 'A', academic_year integer not null check(academic_year between 2000 and 2100), created_at timestamptz not null default now(), unique(level,section,academic_year));
create table public.students (id uuid primary key default gen_random_uuid(), student_code text not null unique check(length(student_code) between 1 and 50), roll text not null, name_bn text not null, name_en text default '', class_id uuid not null references public.classes(id) on delete restrict, guardian_name text not null, phone text not null, birth_date date not null check(birth_date<current_date), address text default '', active boolean not null default true, created_at timestamptz not null default now(), unique(class_id,roll));
create index students_class on public.students(class_id);
create table public.admissions (id uuid primary key default gen_random_uuid(), tracking_code text not null unique default replace(gen_random_uuid()::text,'-',''), student_name text not null check(length(student_name) between 2 and 120), guardian_name text not null check(length(guardian_name) between 2 and 120), phone text not null check(phone ~ '^(\+?88)?01[3-9][0-9]{8}$'), email text default '', birth_date date not null check(birth_date<current_date), class_level integer not null check(class_level between 1 and 5), address text not null check(length(address) between 5 and 1000), consent boolean not null check(consent), status text not null default 'pending' check(status in('pending','reviewing','approved','rejected')), admin_notes text default '', created_at timestamptz not null default now());
create table public.exams (id uuid primary key default gen_random_uuid(), name_bn text not null, name_en text default '', academic_year integer not null check(academic_year between 2000 and 2100), class_id uuid not null references public.classes(id) on delete restrict, exam_date date not null, created_at timestamptz not null default now());
create table public.results (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete restrict, exam_id uuid not null references public.exams(id) on delete restrict, marks jsonb not null default '[]'::jsonb check(jsonb_typeof(marks)='array'), grade text default '', access_code text not null unique default replace(gen_random_uuid()::text,'-',''), published boolean not null default false, publish_at timestamptz not null default now(), created_at timestamptz not null default now(), unique(student_id,exam_id));
create index results_exam on public.results(exam_id);
create function private.validate_result() returns trigger language plpgsql set search_path='' as $$
declare item jsonb; student_class uuid; exam_class uuid;
begin
 select class_id into student_class from public.students where id=new.student_id;
 select class_id into exam_class from public.exams where id=new.exam_id;
 if student_class is distinct from exam_class then raise exception 'Student and exam must belong to the same class'; end if;
 if jsonb_array_length(new.marks)=0 or jsonb_array_length(new.marks)>30 then raise exception 'Enter 1–30 subjects'; end if;
 for item in select value from jsonb_array_elements(new.marks) loop
  if jsonb_typeof(item->'subject') is distinct from 'string' or length(trim(item->>'subject'))=0 or jsonb_typeof(item->'score') is distinct from 'number' or jsonb_typeof(item->'maximum') is distinct from 'number' then raise exception 'Each subject needs a name, numeric score and maximum'; end if;
  if (item->>'maximum')::numeric<=0 or (item->>'score')::numeric<0 or (item->>'score')::numeric>(item->>'maximum')::numeric then raise exception 'Invalid subject marks'; end if;
 end loop;
 return new;
end $$;
create trigger check_result before insert or update on public.results for each row execute function private.validate_result();
create table public.attendance (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete restrict, class_id uuid not null references public.classes(id) on delete restrict, attendance_date date not null, status text not null check(status in('present','absent','late','excused')), created_at timestamptz not null default now(), unique(student_id,attendance_date));
create function private.validate_attendance() returns trigger language plpgsql set search_path='' as $$ begin if not exists(select 1 from public.students where id=new.student_id and class_id=new.class_id) then raise exception 'Attendance class does not match student'; end if; return new; end $$;
create trigger check_attendance before insert or update on public.attendance for each row execute function private.validate_attendance();
create table public.contact_messages (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 120), email text not null check(length(email)<=254 and position('@' in email)>1), phone text default '', message text not null check(length(message) between 10 and 4000), status text not null default 'unread' check(status in('unread','read','resolved')), created_at timestamptz not null default now());
create table public.activity_logs (id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, table_name text not null, record_id uuid, created_at timestamptz not null default now());
-- Deliberately log identifiers and operations only: no passwords, marks or personal payloads.
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.activity_logs(actor_id,action,table_name,record_id) values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(new.id,old.id)); return coalesce(new,old); end $$;
do $$ declare t text; begin
 foreach t in array array['settings','content','people','notices','events','gallery','academic_documents','classes','students','admissions','exams','results','attendance','contact_messages'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy admin_all on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create trigger audit after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
 end loop;
 foreach t in array array['content','people','events','gallery','academic_documents'] loop
  execute format('create policy published_read on public.%I for select to anon,authenticated using(published)',t);
  execute format('grant select on public.%I to anon',t);
 end loop;
end $$;
create policy read_settings on public.settings for select to anon,authenticated using(true);
grant select on public.settings to anon;
create policy visible_notices on public.notices for select to anon,authenticated using(published and publish_at<=now());
grant select on public.notices to anon;
alter table public.activity_logs enable row level security;
create policy admin_logs on public.activity_logs for select to authenticated using((select public.is_admin()));
grant select on public.activity_logs to authenticated;
revoke insert,update,delete on public.activity_logs from anon,authenticated;

-- Only the Edge Function service role can accept public submissions or look up private results.
create function public.submit_admission(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare code text;
begin
 if not exists(select 1 from public.settings where admission_open) then raise exception 'Admissions are currently closed'; end if;
 if p_payload->>'consent' is distinct from 'true' then raise exception 'Guardian consent is required'; end if;
 insert into public.admissions(student_name,guardian_name,phone,email,birth_date,class_level,address,consent) values(trim(p_payload->>'student_name'),trim(p_payload->>'guardian_name'),p_payload->>'phone',p_payload->>'email',(p_payload->>'birth_date')::date,(p_payload->>'class_level')::integer,trim(p_payload->>'address'),true) returning tracking_code into code;
 return jsonb_build_object('tracking_code',code);
end $$;
create function public.track_admission(p_code text) returns jsonb language sql security definer set search_path='' as $$ select coalesce((select jsonb_build_object('status',status,'submitted_at',created_at) from public.admissions where tracking_code=p_code),'{}'::jsonb); $$;
create function public.lookup_result(p_student_code text,p_access_code text) returns jsonb language sql security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('exam',e.name_bn,'exam_en',e.name_en,'academic_year',e.academic_year,'class',c.level,'marks',r.marks,'grade',r.grade,'published_at',r.publish_at) from public.results r join public.students s on s.id=r.student_id join public.exams e on e.id=r.exam_id join public.classes c on c.id=e.class_id where s.student_code=p_student_code and r.access_code=p_access_code and r.published and r.publish_at<=now()),'{}'::jsonb);
$$;
create table private.rate_limits (key text primary key, bucket timestamptz not null, hits integer not null);
create function public.consume_rate_limit(p_key text) returns boolean language plpgsql security definer set search_path='' as $$ declare hits integer; begin
 delete from private.rate_limits where bucket<now()-interval '1 day';
 insert into private.rate_limits(key,bucket,hits) values(p_key,date_trunc('hour',now()),1) on conflict(key) do update set hits=case when private.rate_limits.bucket=date_trunc('hour',now()) then private.rate_limits.hits+1 else 1 end,bucket=date_trunc('hour',now()) returning private.rate_limits.hits into hits;
 return hits<=20;
end $$;
revoke all on function public.submit_admission(jsonb), public.track_admission(text), public.lookup_result(text,text), public.consume_rate_limit(text) from public,anon,authenticated;
grant execute on function public.submit_admission(jsonb), public.track_admission(text), public.lookup_result(text,text), public.consume_rate_limit(text) to service_role;
grant usage on schema public to anon,authenticated,service_role;
grant all on all tables in schema public to service_role;
commit;
