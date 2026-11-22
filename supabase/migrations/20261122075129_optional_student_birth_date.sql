-- Owner explicitly approved this nullability relaxation on 22 November 2026.
-- No dates, records, tables or past-date validation checks are removed.
begin;
alter table public.students alter column birth_date drop not null;
commit;
