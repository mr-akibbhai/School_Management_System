-- Additive indexes and least-privilege cleanup; no rows or policies are removed.
begin;
create index if not exists attendance_class_id_idx on public.attendance(class_id);
create index if not exists exams_class_id_idx on public.exams(class_id);
-- This is a platform event-trigger helper, not an application RPC. Revocation
-- does not drop/disable the existing ensure_rls event trigger.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
 end if;
end $$;
commit;
