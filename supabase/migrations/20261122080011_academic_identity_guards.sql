begin;
-- Academic identity changes must create new history rows, never repoint old marks/results.
create function private.guard_academic_identity() returns trigger language plpgsql set search_path='' as $$begin
 if TG_TABLE_NAME='enrollments' then
  if new.student_id<>old.student_id or new.class_id<>old.class_id then raise exception 'Enrollment identity is immutable; promote or create a new enrollment';end if;
 elsif TG_TABLE_NAME='exams' then
  if (new.class_id<>old.class_id or new.academic_year<>old.academic_year) and exists(select 1 from public.exam_subjects where exam_id=old.id) then raise exception 'Exam class/year locked after subject configuration';end if;
 elsif TG_TABLE_NAME='class_subjects' then
  if new.class_id<>old.class_id or new.subject_id<>old.subject_id then raise exception 'Create a new class-subject record instead';end if;
 end if;return new;
end $$;
create trigger immutable_enrollment before update on public.enrollments for each row execute function private.guard_academic_identity();
create trigger immutable_exam_class before update on public.exams for each row execute function private.guard_academic_identity();
create trigger immutable_class_subject before update on public.class_subjects for each row execute function private.guard_academic_identity();
create or replace function public.has_class_subject(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_teacher() and exists(select 1 from public.teacher_assignments a join public.teacher_accounts t on t.id=a.teacher_id join public.class_subjects cs on cs.id=a.class_subject_id join public.subjects s on s.id=cs.subject_id where a.class_subject_id=p_id and a.active and s.active and t.user_id=auth.uid() and t.status='approved')$$;
commit;
