begin;
-- Additive upgrade: retain the original owner table and all existing school data.
create table public.admin_invitations(id uuid primary key default gen_random_uuid(), email text not null check(email=lower(trim(email)) and position('@' in email)>1), invited_by uuid not null references auth.users(id), user_id uuid references auth.users(id), status text not null default 'sending' check(status in('sending','sent','accepted','failed','revoked')), expires_at timestamptz not null default now()+interval '7 days', created_at timestamptz not null default now());
create unique index admin_invitation_one_slot on public.admin_invitations((true)) where status in('sending','sent','accepted');
create index admin_invitation_user on public.admin_invitations(user_id);
create index admin_invitation_inviter on public.admin_invitations(invited_by);
create table public.secondary_admins(id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id), invitation_id uuid not null unique references public.admin_invitations(id), active boolean not null default true, created_at timestamptz not null default now());
create unique index secondary_admin_one_active on public.secondary_admins((true)) where active;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.admins where user_id=auth.uid() and role='super_admin')$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select public.is_super_admin() or exists(select 1 from public.secondary_admins where user_id=auth.uid() and active)$$;
create table public.teacher_accounts(id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id), full_name text not null check(length(full_name) between 2 and 120), phone text not null check(phone ~ '^(\+?88)?01[3-9][0-9]{8}$'), designation text not null check(length(designation) between 2 and 120), photo_path text default '', gender text default '', qualification text default '', joining_date date, biography text default '', requested_assignments text default '', status text not null default 'pending' check(status in('pending','approved','rejected','suspended')), created_at timestamptz not null default now());
create function public.is_teacher() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.teacher_accounts where user_id=auth.uid() and status='approved')$$;
create table public.academic_years(id uuid primary key default gen_random_uuid(), year integer not null unique check(year between 2000 and 2100), title text not null, starts_on date not null, ends_on date not null, active boolean not null default true, created_at timestamptz not null default now(), check(ends_on>=starts_on));
create table public.subjects(id uuid primary key default gen_random_uuid(), code text not null unique, name_bn text not null, name_en text default '', active boolean not null default true, created_at timestamptz not null default now());
create table public.class_subjects(id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id), subject_id uuid not null references public.subjects(id), created_at timestamptz not null default now(), unique(class_id,subject_id));
create index class_subjects_subject on public.class_subjects(subject_id);
create table public.teacher_assignments(id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teacher_accounts(id), class_subject_id uuid not null unique references public.class_subjects(id), active boolean not null default true, created_at timestamptz not null default now());
create index teacher_assignments_teacher on public.teacher_assignments(teacher_id);
create table public.student_details(id uuid primary key default gen_random_uuid(), student_id uuid not null unique references public.students(id), gender text default '', photo_path text default '', admission_date date not null default current_date, status text not null default 'active' check(status in('active','inactive','transferred','withdrawn')), exit_date date, exit_reason text default '', created_at timestamptz not null default now());
create table public.enrollments(id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id), class_id uuid not null references public.classes(id), roll text not null, status text not null default 'active' check(status in('active','promoted','transferred','withdrawn')), created_at timestamptz not null default now(), unique(student_id,class_id), unique(class_id,roll));
create index enrollments_student on public.enrollments(student_id);
insert into public.enrollments(student_id,class_id,roll) select id,class_id,roll from public.students;
create table public.grading_schemes(id uuid primary key default gen_random_uuid(), name text not null, use_gpa boolean not null default false, bands jsonb not null check(jsonb_typeof(bands)='array'), created_at timestamptz not null default now());
create table public.exam_settings(id uuid primary key default gen_random_uuid(), exam_id uuid not null unique references public.exams(id), exam_type text not null default 'Other', deadline timestamptz not null, entry_open boolean not null default false, grading_scheme_id uuid not null references public.grading_schemes(id), created_at timestamptz not null default now());
create index exam_settings_scheme on public.exam_settings(grading_scheme_id);
create table public.exam_subjects(id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id), class_subject_id uuid not null references public.class_subjects(id), full_marks numeric(8,2) not null check(full_marks>0), pass_marks numeric(8,2) not null check(pass_marks>=0 and pass_marks<=full_marks), created_at timestamptz not null default now(), unique(exam_id,class_subject_id));
create index exam_subjects_class_subject on public.exam_subjects(class_subject_id);
create table public.assessment_components(id uuid primary key default gen_random_uuid(), exam_subject_id uuid not null references public.exam_subjects(id), name text not null, full_marks numeric(8,2) not null check(full_marks>0), created_at timestamptz not null default now(), unique(exam_subject_id,name));
create table public.mark_submissions(id uuid primary key default gen_random_uuid(), exam_subject_id uuid not null unique references public.exam_subjects(id), teacher_id uuid not null references public.teacher_accounts(id), status text not null default 'draft' check(status in('draft','submitted','reviewed')), submitted_at timestamptz, reviewed_by uuid references auth.users(id), reviewed_at timestamptz, revision integer not null default 1, created_at timestamptz not null default now());
create index mark_submissions_teacher on public.mark_submissions(teacher_id);
create index mark_submissions_reviewer on public.mark_submissions(reviewed_by);
create table public.subject_marks(id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.mark_submissions(id), enrollment_id uuid not null references public.enrollments(id), components jsonb not null check(jsonb_typeof(components)='object'), score numeric(8,2) not null check(score>=0), created_at timestamptz not null default now(), unique(submission_id,enrollment_id));
create index subject_marks_enrollment on public.subject_marks(enrollment_id);
create table public.mark_history(id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.mark_submissions(id), actor_id uuid references auth.users(id), action text not null, revision integer not null, snapshot jsonb not null, created_at timestamptz not null default now());
create index mark_history_submission on public.mark_history(submission_id);
create index mark_history_actor on public.mark_history(actor_id);
create table public.result_sheets(id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id), enrollment_id uuid not null references public.enrollments(id), access_code text not null unique default replace(gen_random_uuid()::text,'-',''), summary jsonb not null, published boolean not null default false, published_at timestamptz, created_at timestamptz not null default now(), unique(exam_id,enrollment_id));
create index result_sheets_enrollment on public.result_sheets(enrollment_id);
create table public.teacher_attendance(id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teacher_accounts(id), attendance_date date not null, status text not null check(status in('present','absent','late','excused')), created_at timestamptz not null default now(), unique(teacher_id,attendance_date));
create table public.class_attendance(id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references public.enrollments(id), attendance_date date not null, status text not null check(status in('present','absent','late','excused')), recorded_by uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(enrollment_id,attendance_date));
create index class_attendance_recorder on public.class_attendance(recorded_by);
create table public.timetable(id uuid primary key default gen_random_uuid(), class_subject_id uuid not null references public.class_subjects(id), weekday integer not null check(weekday between 0 and 6), starts_at time not null, ends_at time not null, room text default '', published boolean not null default false, created_at timestamptz not null default now(), check(ends_at>starts_at), unique(class_subject_id,weekday,starts_at));
create table public.homework(id uuid primary key default gen_random_uuid(), class_subject_id uuid not null references public.class_subjects(id), title text not null, description text default '', due_date date not null, published boolean not null default false, created_at timestamptz not null default now());
create index homework_class_subject on public.homework(class_subject_id);
create function public.has_class_subject(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_teacher() and exists(select 1 from public.teacher_assignments a join public.teacher_accounts t on t.id=a.teacher_id where a.class_subject_id=p_id and a.active and t.user_id=auth.uid() and t.status='approved')$$;
create function public.has_class(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.class_subjects cs where cs.class_id=p_id and public.has_class_subject(cs.id))$$;
-- New sensitive relations use deny-by-default grants and RLS.
do $$declare t text;begin
foreach t in array array['admin_invitations','secondary_admins','teacher_accounts','academic_years','subjects','class_subjects','teacher_assignments','student_details','enrollments','grading_schemes','exam_settings','exam_subjects','assessment_components','mark_submissions','subject_marks','mark_history','result_sheets','teacher_attendance','class_attendance','timetable','homework'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy admin_read on public.%I for select to authenticated using((select public.is_admin()))',t);
 execute format('create trigger audit after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
end loop;
foreach t in array array['academic_years','subjects','class_subjects','teacher_assignments','student_details','enrollments','grading_schemes','exam_settings','exam_subjects','assessment_components','teacher_attendance','timetable','homework'] loop
 execute format('grant insert,update on public.%I to authenticated',t);
 execute format('create policy admin_write on public.%I for all to authenticated using((select public.is_admin())) with check((select public.is_admin()))',t);
end loop;end $$;
create policy teacher_self on public.teacher_accounts for select to authenticated using(user_id=auth.uid());
create policy secondary_self on public.secondary_admins for select to authenticated using(user_id=auth.uid());
create policy assigned_classes on public.classes for select to authenticated using(public.has_class(id));
create policy assigned_exams on public.exams for select to authenticated using(public.has_class(class_id));
create policy teacher_subjects on public.subjects for select to authenticated using(public.is_teacher());
create policy teacher_class_subjects on public.class_subjects for select to authenticated using(public.has_class_subject(id));
create policy teacher_assignment_self on public.teacher_assignments for select to authenticated using(public.has_class_subject(class_subject_id));
create policy teacher_exam_settings on public.exam_settings for select to authenticated using(exists(select 1 from public.exams e where e.id=exam_id and public.has_class(e.class_id)));
create policy teacher_exam_subjects on public.exam_subjects for select to authenticated using(public.has_class_subject(class_subject_id));
create policy teacher_components on public.assessment_components for select to authenticated using(exists(select 1 from public.exam_subjects es where es.id=exam_subject_id and public.has_class_subject(es.class_subject_id)));
create policy teacher_submissions on public.mark_submissions for select to authenticated using(exists(select 1 from public.teacher_accounts t where t.id=teacher_id and t.user_id=auth.uid() and t.status='approved'));
create policy teacher_marks on public.subject_marks for select to authenticated using(exists(select 1 from public.mark_submissions ms join public.teacher_accounts t on t.id=ms.teacher_id where ms.id=submission_id and t.user_id=auth.uid() and t.status='approved'));
create policy teacher_history on public.mark_history for select to authenticated using(exists(select 1 from public.mark_submissions ms join public.teacher_accounts t on t.id=ms.teacher_id where ms.id=submission_id and t.user_id=auth.uid() and t.status='approved'));
create policy teacher_own_attendance on public.teacher_attendance for select to authenticated using(exists(select 1 from public.teacher_accounts t where t.id=teacher_id and t.user_id=auth.uid() and t.status='approved'));
create policy teacher_class_attendance on public.class_attendance for select to authenticated using(exists(select 1 from public.enrollments e where e.id=enrollment_id and public.has_class(e.class_id)));
create policy teacher_timetable on public.timetable for select to authenticated using(public.has_class_subject(class_subject_id));
create policy teacher_homework on public.homework for select to authenticated using(public.has_class_subject(class_subject_id));
-- Enrollment roster RPC exposes only academic identifiers/names, never guardian/contact details.
create function public.class_roster(p_class uuid) returns table(enrollment_id uuid,student_code text,roll text,name_bn text,name_en text,status text) language plpgsql stable security definer set search_path='' as $$begin
 if not(public.is_admin() or public.has_class(p_class)) then raise exception 'Not authorized'; end if;
 return query select e.id,s.student_code,e.roll,s.name_bn,s.name_en,e.status from public.enrollments e join public.students s on s.id=e.student_id where e.class_id=p_class order by e.roll;
end $$;
create function public.school_role() returns text language sql stable security definer set search_path='' as $$select case when public.is_super_admin() then 'super_admin' when public.is_admin() then 'admin' when public.is_teacher() then 'teacher' else coalesce((select status from public.teacher_accounts where user_id=auth.uid()),'none') end$$;
create function public.update_teacher_status(p_teacher uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_admin() or p_status not in('approved','rejected','suspended','pending') then raise exception 'Not authorized';end if;
 update public.teacher_accounts set status=p_status where id=p_teacher;
 if not found then raise exception 'Teacher not found';end if;
end $$;
create function public.update_teacher_profile(p_profile jsonb) returns void language plpgsql security definer set search_path='' as $$begin
 update public.teacher_accounts set full_name=trim(p_profile->>'full_name'),phone=p_profile->>'phone',designation=trim(p_profile->>'designation'),gender=left(coalesce(p_profile->>'gender',''),40),qualification=left(coalesce(p_profile->>'qualification',''),500),biography=left(coalesce(p_profile->>'biography',''),2000),joining_date=nullif(p_profile->>'joining_date','')::date,photo_path=coalesce(p_profile->>'photo_path',photo_path) where user_id=auth.uid();
 if not found then raise exception 'Teacher account required';end if;
end $$;
create function public.reserve_admin_invitation(p_email text) returns uuid language plpgsql security definer set search_path='' as $$declare v uuid;begin
 if not public.is_super_admin() then raise exception 'Super Admin required';end if;
 if length(p_email)>254 or position('@' in p_email)<2 or exists(select 1 from auth.users where lower(email)=lower(trim(p_email))) then raise exception 'Use a new valid email address';end if;
 insert into public.admin_invitations(email,invited_by) values(lower(trim(p_email)),auth.uid()) returning id into v;return v;
end $$;
create function public.complete_admin_invitation(p_id uuid,p_user uuid,p_success boolean) returns void language plpgsql security definer set search_path='' as $$begin
 update public.admin_invitations set user_id=case when p_success then p_user else null end,status=case when p_success then 'sent' else 'failed' end where id=p_id and status='sending';
end $$;
create function public.accept_admin_invitation() returns void language plpgsql security definer set search_path='' as $$declare invitation public.admin_invitations;begin
 select * into invitation from public.admin_invitations where user_id=auth.uid() and status='sent' and expires_at>now() for update;
 if not found or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and lower(email)=invitation.email) then raise exception 'Valid verified invitation required';end if;
 if public.is_super_admin() or exists(select 1 from public.teacher_accounts where user_id=auth.uid()) then raise exception 'Role conflict';end if;
 insert into public.secondary_admins(user_id,invitation_id) values(auth.uid(),invitation.id);
 update public.admin_invitations set status='accepted' where id=invitation.id;
end $$;
create function public.revoke_secondary_admin(p_invitation uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_super_admin() then raise exception 'Super Admin required';end if;
 update public.secondary_admins set active=false where invitation_id=p_invitation;
 update public.admin_invitations set status='revoked' where id=p_invitation and status in('sending','sent','accepted');
end $$;
-- Marks are changed only through transactional functions; no direct browser writes.
create function public.save_marks(p_exam_subject uuid,p_rows jsonb,p_submit boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare es public.exam_subjects; st public.exam_settings; tid uuid; sid uuid; item jsonb; c record; score numeric; parts jsonb; v numeric; roster_count integer;begin
 select * into es from public.exam_subjects where id=p_exam_subject;
 perform pg_advisory_xact_lock(hashtextextended('school-exam:'||es.exam_id::text,0));
 select * into es from public.exam_subjects where id=p_exam_subject for update;
 perform 1 from public.teacher_assignments where class_subject_id=es.class_subject_id for update;
 if not found or not(public.is_admin() or public.has_class_subject(es.class_subject_id)) then raise exception 'Assigned approved teacher required';end if;
 select * into st from public.exam_settings where exam_id=es.exam_id for update;
 if not found or not st.entry_open or st.deadline<now() then raise exception 'Marks entry closed';end if;
 select t.id into tid from public.teacher_accounts t join public.teacher_assignments a on a.teacher_id=t.id where a.class_subject_id=es.class_subject_id and a.active and t.status='approved' and (public.is_admin() or t.user_id=auth.uid());
 if tid is null then raise exception 'Assign an approved subject teacher first';end if;
 select id into sid from public.mark_submissions where exam_subject_id=es.id for update;
 if sid is not null and exists(select 1 from public.mark_submissions where id=sid and (status<>'draft' or teacher_id<>tid)) then raise exception 'Submission locked; administrator must reopen or transfer';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>1000 then raise exception 'Invalid marks batch';end if;
 if (select count(distinct value->>'enrollment_id') from jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows) then raise exception 'Duplicate student';end if;
 if (select coalesce(sum(full_marks),0) from public.assessment_components where exam_subject_id=es.id)<>es.full_marks then raise exception 'Component maximums must equal subject full marks';end if;
 if sid is null then insert into public.mark_submissions(exam_subject_id,teacher_id) values(es.id,tid) returning id into sid;end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  if not exists(select 1 from public.enrollments e join public.exams x on x.class_id=e.class_id where e.id=(item->>'enrollment_id')::uuid and x.id=es.exam_id) then raise exception 'Student not in examination class';end if;
  parts=item->'components'; score=0;
  if jsonb_typeof(parts) is distinct from 'object' or (select count(*) from jsonb_object_keys(parts))<>(select count(*) from public.assessment_components where exam_subject_id=es.id) then raise exception 'Complete assessment components required';end if;
  for c in select * from public.assessment_components where exam_subject_id=es.id loop
   if jsonb_typeof(parts->c.id::text) is distinct from 'number' then raise exception 'Numeric component marks required';end if;
   v=(parts->>c.id::text)::numeric;
   if v<0 or v>c.full_marks then raise exception 'Marks outside component maximum';end if;score=score+v;
  end loop;
  insert into public.subject_marks(submission_id,enrollment_id,components,score) values(sid,(item->>'enrollment_id')::uuid,parts,score) on conflict(submission_id,enrollment_id) do update set components=excluded.components,score=excluded.score;
 end loop;
 if p_submit then
  select count(*) into roster_count from public.enrollments e join public.exams x on x.class_id=e.class_id where x.id=es.exam_id and e.status in('active','promoted');
  if roster_count=0 or roster_count<>(select count(*) from public.subject_marks where submission_id=sid) then raise exception 'Complete the entire roster before submission';end if;
  update public.mark_submissions set status='submitted',submitted_at=now() where id=sid;
 end if;
 insert into public.mark_history(submission_id,actor_id,action,revision,snapshot) select sid,auth.uid(),case when p_submit then 'submitted' else 'draft_saved' end,revision,(select jsonb_agg(to_jsonb(m)) from public.subject_marks m where submission_id=sid) from public.mark_submissions where id=sid;
 return sid;
end $$;
create function public.review_marks(p_submission uuid,p_reopen boolean default false) returns void language plpgsql security definer set search_path='' as $$declare s public.mark_submissions;begin
 if not public.is_admin() then raise exception 'Admin required';end if;
 select * into s from public.mark_submissions where id=p_submission;
 perform pg_advisory_xact_lock(hashtextextended('school-exam:'||(select exam_id from public.exam_subjects where id=s.exam_subject_id)::text,0));
 select * into s from public.mark_submissions where id=p_submission for update;
 if not found then raise exception 'Submission missing';end if;
 if exists(select 1 from public.result_sheets r join public.exam_subjects es on es.exam_id=r.exam_id where es.id=s.exam_subject_id and r.published) then raise exception 'Unpublish results before reopening';end if;
 if not p_reopen and s.status<>'submitted' then raise exception 'Submitted marks required';end if;
 update public.mark_submissions set status=case when p_reopen then 'draft' else 'reviewed' end,reviewed_by=case when p_reopen then null else auth.uid() end,reviewed_at=case when p_reopen then null else now() end,revision=revision+case when p_reopen then 1 else 0 end,teacher_id=case when p_reopen then coalesce((select a.teacher_id from public.teacher_assignments a join public.exam_subjects es on es.class_subject_id=a.class_subject_id where es.id=s.exam_subject_id and a.active),teacher_id) else teacher_id end where id=s.id;
 insert into public.mark_history(submission_id,actor_id,action,revision,snapshot) values(s.id,auth.uid(),case when p_reopen then 'reopened' else 'reviewed' end,s.revision,'{}');
end $$;
create function public.record_class_attendance(p_enrollment uuid,p_date date,p_status text) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.enrollments where id=p_enrollment and (public.is_admin() or public.has_class(class_id))) then raise exception 'Assigned class required';end if;
 insert into public.class_attendance(enrollment_id,attendance_date,status,recorded_by) values(p_enrollment,p_date,p_status,auth.uid()) on conflict(enrollment_id,attendance_date) do update set status=excluded.status,recorded_by=auth.uid();
end $$;
create function public.promote_student(p_student uuid,p_class uuid,p_roll text) returns void language plpgsql security definer set search_path='' as $$declare old_class uuid;begin
 if not public.is_admin() then raise exception 'Admin required';end if;
 select class_id into old_class from public.students where id=p_student for update;
 if not found or not exists(select 1 from public.classes n join public.classes o on o.id=old_class where n.id=p_class and n.academic_year>o.academic_year and n.level>=o.level and n.level<=o.level+1) then raise exception 'Select next academic year and same/next class';end if;
 update public.enrollments set status='promoted' where student_id=p_student and class_id=old_class;
 insert into public.enrollments(student_id,class_id,roll) values(p_student,p_class,p_roll);
 update public.students set class_id=p_class,roll=p_roll where id=p_student;
end $$;
create function private.enroll_student() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.enrollments(student_id,class_id,roll) values(new.id,new.class_id,new.roll) on conflict(student_id,class_id) do update set roll=excluded.roll;return new;end $$;
create trigger enroll_new_student after insert on public.students for each row execute function private.enroll_student();
-- Private teacher photographs: authenticated owner or administrators only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('teacher-private','teacher-private',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy private_teacher_photos on storage.objects for all to authenticated using(bucket_id='teacher-private' and (public.is_admin() or split_part(name,'/',1)=auth.uid()::text)) with check(bucket_id='teacher-private' and (public.is_admin() or (split_part(name,'/',1)=auth.uid()::text and exists(select 1 from public.teacher_accounts where user_id=auth.uid()))));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('student-photos','student-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy student_photos_admin_only on storage.objects for all to authenticated using(bucket_id='student-photos' and public.is_admin()) with check(bucket_id='student-photos' and public.is_admin());
-- Explicit execution grants; service-only invitation finalization cannot be called by browsers.
revoke all on function public.is_super_admin(),public.is_teacher(),public.has_class_subject(uuid),public.has_class(uuid),public.school_role(),public.class_roster(uuid),public.update_teacher_status(uuid,text),public.update_teacher_profile(jsonb),public.reserve_admin_invitation(text),public.complete_admin_invitation(uuid,uuid,boolean),public.accept_admin_invitation(),public.revoke_secondary_admin(uuid),public.save_marks(uuid,jsonb,boolean),public.review_marks(uuid,boolean),public.record_class_attendance(uuid,date,text),public.promote_student(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.is_super_admin(),public.is_teacher(),public.has_class_subject(uuid),public.has_class(uuid),public.school_role(),public.class_roster(uuid),public.update_teacher_status(uuid,text),public.update_teacher_profile(jsonb),public.reserve_admin_invitation(text),public.accept_admin_invitation(),public.revoke_secondary_admin(uuid),public.save_marks(uuid,jsonb,boolean),public.review_marks(uuid,boolean),public.record_class_attendance(uuid,date,text),public.promote_student(uuid,uuid,text) to authenticated;
grant execute on function public.complete_admin_invitation(uuid,uuid,boolean) to service_role;
-- Managed marks replace direct legacy result editing; legacy rows remain readable.
revoke insert,update,delete on public.results from authenticated;
commit;
