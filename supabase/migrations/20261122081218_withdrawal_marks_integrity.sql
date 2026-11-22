-- Preserve withdrawn draft history without blocking submission of the active roster.
begin;
create or replace function public.save_marks(p_exam_subject uuid,p_rows jsonb,p_submit boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
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
  if not exists(select 1 from public.enrollments e join public.exams x on x.class_id=e.class_id where e.id=(item->>'enrollment_id')::uuid and x.id=es.exam_id and e.status in('active','promoted')) then raise exception 'Student not in examination class';end if;
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
  if roster_count=0 or roster_count<>(select count(*) from public.subject_marks m join public.enrollments e on e.id=m.enrollment_id where m.submission_id=sid and e.status in('active','promoted')) then raise exception 'Complete the entire roster before submission';end if;
  update public.mark_submissions set status='submitted',submitted_at=now() where id=sid;
 end if;
 insert into public.mark_history(submission_id,actor_id,action,revision,snapshot) select sid,auth.uid(),case when p_submit then 'submitted' else 'draft_saved' end,revision,(select jsonb_agg(to_jsonb(m)) from public.subject_marks m where submission_id=sid) from public.mark_submissions where id=sid;
 return sid;
end $$;
commit;
