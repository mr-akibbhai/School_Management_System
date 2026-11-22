begin;
-- Preserve enrollment history even when an administrator edits the existing student editor.
create or replace function private.enroll_student() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_OP='UPDATE' and old.class_id<>new.class_id then
  update public.enrollments set status=case when (select academic_year from public.classes where id=new.class_id)>(select academic_year from public.classes where id=old.class_id) then 'promoted' else 'transferred' end where student_id=new.id and class_id=old.class_id and status='active';
 end if;
 insert into public.enrollments(student_id,class_id,roll) values(new.id,new.class_id,new.roll) on conflict(student_id,class_id) do update set roll=excluded.roll;return new;
end $$;
create trigger enroll_updated_student after update of class_id,roll on public.students for each row execute function private.enroll_student();
create function private.log_account_transition() returns trigger language plpgsql security definer set search_path='' as $$declare event text;begin
 if TG_TABLE_NAME='teacher_accounts' then event='TEACHER_'||upper(new.status);
 elsif TG_TABLE_NAME='admin_invitations' then event='ADMIN_INVITATION_'||upper(new.status);
 else event=case when new.active then 'SECONDARY_ADMIN_ACTIVATED' else 'SECONDARY_ADMIN_REVOKED' end;
 end if;
 insert into public.activity_logs(actor_id,action,table_name,record_id) values(auth.uid(),event,TG_TABLE_NAME,new.id);return new;
end $$;
create trigger teacher_status_event after insert or update of status on public.teacher_accounts for each row execute function private.log_account_transition();
create trigger invitation_status_event after insert or update of status on public.admin_invitations for each row execute function private.log_account_transition();
create trigger secondary_access_event after insert or update of active on public.secondary_admins for each row execute function private.log_account_transition();
-- Public catalog exposes only active subject names and class/year labels, no people or student records.
create function public.public_academic_catalog() returns table(class_name_bn text,class_name_en text,level integer,section text,academic_year integer,subject_name_bn text,subject_name_en text) language sql stable security definer set search_path='' as $$select c.name_bn,c.name_en,c.level,c.section,c.academic_year,s.name_bn,s.name_en from public.classes c join public.class_subjects cs on cs.class_id=c.id join public.subjects s on s.id=cs.subject_id where s.active order by c.academic_year desc,c.level,c.section,s.code$$;
revoke all on function public.public_academic_catalog() from public;
grant execute on function public.public_academic_catalog() to anon,authenticated;
commit;
