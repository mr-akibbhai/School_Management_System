begin;
alter table public.settings add column home_sections jsonb not null default '["hero","quick","notices","highlights","principal","teachers","gallery","news","contact"]'::jsonb check(jsonb_typeof(home_sections)='array');
create function private.audit_admin_profile() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.activity_logs(actor_id,action,table_name,record_id) values(auth.uid(),TG_OP,'admins',coalesce(new.user_id,old.user_id)); return coalesce(new,old); end $$;
create trigger admin_profile_audit after insert or update or delete on public.admins for each row execute function private.audit_admin_profile();
commit;
