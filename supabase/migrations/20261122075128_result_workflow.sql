begin;
create function private.validate_grading_scheme() returns trigger language plpgsql set search_path='' as $$declare b jsonb;begin
 if jsonb_array_length(new.bands)<1 or jsonb_array_length(new.bands)>30 or not exists(select 1 from jsonb_array_elements(new.bands) x where (x->>'minimum')::numeric=0) then raise exception 'Provide grade bands including minimum zero';end if;
 if (select count(distinct (x->>'minimum')::numeric) from jsonb_array_elements(new.bands) x)<>jsonb_array_length(new.bands) then raise exception 'Duplicate grade thresholds';end if;
 for b in select value from jsonb_array_elements(new.bands) loop
  if jsonb_typeof(b->'minimum') is distinct from 'number' or (b->>'minimum')::numeric<0 or (b->>'minimum')::numeric>100 or length(coalesce(b->>'grade','')) not between 1 and 20 or (new.use_gpa and (jsonb_typeof(b->'gpa') is distinct from 'number' or (b->>'gpa')::numeric<0 or (b->>'gpa')::numeric>10)) then raise exception 'Invalid grading band';end if;
 end loop;return new;
end $$;
create trigger validate_grades before insert or update on public.grading_schemes for each row execute function private.validate_grading_scheme();
create function private.check_exam_subject() returns trigger language plpgsql set search_path='' as $$begin
 if not exists(select 1 from public.exams e join public.classes c on c.id=e.class_id join public.class_subjects cs on cs.class_id=c.id where e.id=new.exam_id and cs.id=new.class_subject_id and c.academic_year=e.academic_year) then raise exception 'Exam class/year and subject class must match';end if;
 if TG_OP='UPDATE' and exists(select 1 from public.mark_submissions where exam_subject_id=old.id) then raise exception 'Configuration locked after marks entry; create a new examination instead';end if;
 return new;end $$;
create trigger validate_exam_subject before insert or update on public.exam_subjects for each row execute function private.check_exam_subject();
create function private.check_component_edit() returns trigger language plpgsql set search_path='' as $$begin
 if exists(select 1 from public.mark_submissions where exam_subject_id=new.exam_subject_id) or (TG_OP='UPDATE' and exists(select 1 from public.mark_submissions where exam_subject_id=old.exam_subject_id)) then raise exception 'Assessment configuration locked after entry';end if;return new;end $$;
create trigger lock_assessment before insert or update on public.assessment_components for each row execute function private.check_component_edit();
create function public.calculate_exam_results(p_exam uuid) returns integer language plpgsql security definer set search_path='' as $$
declare cfg public.exam_settings; scheme public.grading_schemes; e public.exams; enrollment record; subjects_count integer; items jsonb; item jsonb; band jsonb; total numeric; maximum numeric; percentage numeric; passed boolean; gpa numeric; n integer=0;begin
 if not public.is_admin() then raise exception 'Admin required';end if;
 perform pg_advisory_xact_lock(hashtextextended('school-exam:'||p_exam::text,0));
 select * into e from public.exams where id=p_exam for update;
 select * into cfg from public.exam_settings where exam_id=p_exam for update;
 if not found then raise exception 'Exam configuration missing';end if;
 select * into scheme from public.grading_schemes where id=cfg.grading_scheme_id;
 if exists(select 1 from public.result_sheets where exam_id=p_exam and published) then raise exception 'Unpublish before recalculating';end if;
 select count(*) into subjects_count from public.exam_subjects where exam_id=p_exam;
 if subjects_count=0 or exists(select 1 from public.exam_subjects es left join public.mark_submissions ms on ms.exam_subject_id=es.id where es.exam_id=p_exam and (ms.status is distinct from 'reviewed')) then raise exception 'All subjects must be submitted and reviewed';end if;
 for enrollment in select * from public.enrollments where class_id=e.class_id and status in('active','promoted') loop
  select jsonb_agg(jsonb_build_object('subject',s.name_bn,'subject_en',s.name_en,'score',m.score,'maximum',es.full_marks,'pass_marks',es.pass_marks) order by s.code),sum(m.score),sum(es.full_marks),bool_and(m.score>=es.pass_marks) into items,total,maximum,passed from public.exam_subjects es join public.class_subjects cs on cs.id=es.class_subject_id join public.subjects s on s.id=cs.subject_id join public.mark_submissions ms on ms.exam_subject_id=es.id join public.subject_marks m on m.submission_id=ms.id and m.enrollment_id=enrollment.id where es.exam_id=p_exam;
  if items is null or jsonb_array_length(items)<>subjects_count then raise exception 'Missing student marks';end if;
  percentage=round(total/maximum*100,2);gpa=0;
  for item in select value from jsonb_array_elements(items) loop
   select value into band from jsonb_array_elements(scheme.bands) where (value->>'minimum')::numeric <= (item->>'score')::numeric/(item->>'maximum')::numeric*100 order by (value->>'minimum')::numeric desc limit 1;
   gpa=gpa+coalesce((band->>'gpa')::numeric,0);
  end loop;
  select value into band from jsonb_array_elements(scheme.bands) where (value->>'minimum')::numeric<=percentage order by (value->>'minimum')::numeric desc limit 1;
  insert into public.result_sheets(exam_id,enrollment_id,summary) values(p_exam,enrollment.id,jsonb_build_object('exam',e.name_bn,'exam_en',e.name_en,'academic_year',e.academic_year,'class',(select level from public.classes where id=e.class_id),'marks',items,'total',total,'maximum',maximum,'percentage',percentage,'grade',band->>'grade','passed',passed,'gpa',case when scheme.use_gpa then round(gpa/subjects_count,2) else null end,'grading_scheme',scheme.name,'grading_config',jsonb_build_object('bands',scheme.bands,'use_gpa',scheme.use_gpa),'source_versions',(select jsonb_agg(jsonb_build_array(ms.id,ms.revision,ms.reviewed_at) order by ms.id) from public.mark_submissions ms join public.exam_subjects es on es.id=ms.exam_subject_id where es.exam_id=p_exam))) on conflict(exam_id,enrollment_id) do update set summary=excluded.summary;
  n=n+1;
 end loop;
 if n=0 then raise exception 'No enrolled students';end if;
 with ranked as(select id,dense_rank() over(order by (summary->>'passed')::boolean desc,(summary->>'percentage')::numeric desc) as merit from public.result_sheets where exam_id=p_exam) update public.result_sheets r set summary=r.summary||jsonb_build_object('merit_position',ranked.merit) from ranked where ranked.id=r.id;
 update public.exam_settings set entry_open=false where exam_id=p_exam;
 return n;
end $$;
create function public.publish_exam_results(p_exam uuid,p_publish boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_admin() then raise exception 'Admin required';end if;
 perform pg_advisory_xact_lock(hashtextextended('school-exam:'||p_exam::text,0));
 perform 1 from public.exams where id=p_exam for update;
 if p_publish and (not exists(select 1 from public.result_sheets where exam_id=p_exam) or exists(select 1 from public.exam_subjects es left join public.mark_submissions ms on ms.exam_subject_id=es.id where es.exam_id=p_exam and ms.status is distinct from 'reviewed')) then raise exception 'Reviewed and calculated results required';end if;
 if p_publish and exists(select 1 from public.result_sheets r join public.exam_settings cfg on cfg.exam_id=r.exam_id join public.grading_schemes g on g.id=cfg.grading_scheme_id where r.exam_id=p_exam and (r.summary->'source_versions' is distinct from (select jsonb_agg(jsonb_build_array(ms.id,ms.revision,ms.reviewed_at) order by ms.id) from public.mark_submissions ms join public.exam_subjects es on es.id=ms.exam_subject_id where es.exam_id=p_exam) or r.summary->'grading_config' is distinct from jsonb_build_object('bands',g.bands,'use_gpa',g.use_gpa))) then raise exception 'Recalculate results after marks or grading changes';end if;
 update public.result_sheets set published=p_publish,published_at=case when p_publish then now() else null end where exam_id=p_exam;
 update public.exam_settings set entry_open=false where exam_id=p_exam;
end $$;
create or replace function public.lookup_result(p_student_code text,p_access_code text) returns jsonb language sql security definer set search_path='' as $$select coalesce((select (r.summary-'source_versions'-'grading_config')||jsonb_build_object('published_at',r.published_at) from public.result_sheets r join public.enrollments en on en.id=r.enrollment_id join public.students s on s.id=en.student_id where s.student_code=p_student_code and r.access_code=p_access_code and r.published and r.published_at<=now()),(select jsonb_build_object('exam',e.name_bn,'exam_en',e.name_en,'academic_year',e.academic_year,'class',c.level,'marks',r.marks,'grade',r.grade,'published_at',r.publish_at) from public.results r join public.students s on s.id=r.student_id join public.exams e on e.id=r.exam_id join public.classes c on c.id=e.class_id where s.student_code=p_student_code and r.access_code=p_access_code and r.published and r.publish_at<=now()),'{}'::jsonb)$$;
revoke all on function public.calculate_exam_results(uuid),public.publish_exam_results(uuid,boolean) from public,anon,authenticated;
grant execute on function public.calculate_exam_results(uuid),public.publish_exam_results(uuid,boolean) to authenticated;
commit;
