# Database setup and migration record

Project: School_Management_System (nfoohhydncflcbegrxbz), verified 22 November 2026. Only the project-scoped OAuth MCP was used. Never connect to SMSA.

## Applied versions

| Version        | Migration                                     |
| -------------- | --------------------------------------------- |
| 20261121214713 | school                                        |
| 20261121214718 | storage                                       |
| 20261121214730 | home_layout                                   |
| 20261121220521 | covering_indexes_and_event_helper_permissions |
| 20261122075126 | teacher_academics                             |
| 20261122075128 | result_workflow                               |
| 20261122075129 | optional_student_birth_date                   |
| 20261122075518 | account_audit_and_history                     |
| 20261122080011 | academic_identity_guards                      |
| 20261122081218 | withdrawal_marks_integrity                    |

All are already applied. Do not rerun or reset this project. Local filenames match remote history. Original three migration hashes remain unchanged; database-setup-evidence.json retains the original historical names intentionally.

## Additive upgrade

21 normalized tables supplement the original 16: teacher_accounts; admin_invitations; secondary_admins; academic_years; subjects; class_subjects; teacher_assignments; student_details; enrollments; grading_schemes; exam_settings; exam_subjects; assessment_components; mark_submissions; subject_marks; mark_history; result_sheets; teacher_attendance; class_attendance; timetable; homework.

The original singleton admins constraint remains intact. Secondary active membership and outstanding/accepted invitation each have a one-slot unique index. No role can be self-assigned. RLS is enabled on every public table. Marks/results and role transitions use guarded RPCs instead of direct browser writes. FK/unique/check/index and audit constraints preserve relationships, marks limits and history. See INTEGRATION_STATUS.md for the precise workflow.

The only DROP keyword in the upgrade is the owner's explicitly approved ALTER COLUMN birth_date DROP NOT NULL. No column, table, data or past-date check was dropped. No table was truncated or reset. No existing records were deleted. Existing student enrollments are backfilled from their current class/roll; the live student table was empty during application.

The six original Storage buckets remain; teacher-private and student-photos add private image storage. Three buckets are private, five public. Teacher photographs are restricted to the owner path/administrators; student photographs and admission documents are administrator-only. Signed URLs expire.

## Verification and future changes

Run npm run test:upgrade for all migrations and synthetic role/marks scenarios locally. It never connects to Supabase. scripts/check-migration-history.mjs receives fresh non-secret MCP migration metadata on stdin and validates versions/names and historical hashes without executing SQL. Preserve applied SQL; future changes belong in new migrations and must pass local tests first.

Final metadata contains 37 public tables, zero without RLS, eight buckets and zero live school accounts/student records. Evidence is in upgrade-evidence.json. Email and real-account acceptance remain pending; never mark them passed from local tests.
