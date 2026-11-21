# School database setup report

Historical database-only snapshot. For subsequent hardening, reconciled migration filenames, deployed functions and current pending items, see [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md).

Verified: 22 November 2026, Asia/Dhaka.

## Result and scope

All three authorized school migrations were applied successfully, sequentially through the project-scoped `supabase_school` MCP connection.

- Project: **School_Management_System**
- Reference: **nfoohhydncflcbegrxbz**
- API URL: `https://nfoohhydncflcbegrxbz.supabase.co`
- Source: `https://github.com/mr-akibbhai/School_Management_System`
- Verified GitHub commit: `aa0301c0486aa97e19aad07841c1a5c6e465e695`

The old SMSA project was not accessed. No Vercel deployment, user invitation, SMTP/CAPTCHA configuration, Edge Function deployment, or student-data entry was performed in this database-only step. No credentials were invented, logged or added to Git. This report and its evidence are local project files; they have not been pushed to GitHub in this step.

## Safety checks

Git fetch confirmed that local `HEAD` and GitHub `origin/main` matched. Each migration's Git blob matched its GitHub counterpart. Read-only preflight inspection found no public/private application tables, prior migrations, Storage buckets or Storage object policies. The existing `public.rls_auto_enable()` event-trigger helper was inspected and left unchanged.

The migrations contain no DROP, TRUNCATE, column removal, type narrowing or destructive ALTER. ALTER statements enable RLS or add the `settings.home_sections` column. No existing rows were removed. The `consume_rate_limit` function contains intentional cleanup of counters older than one day; creating the function does not execute that cleanup. Its execution is restricted to the server role. Foreign-key cascade/restrict clauses define future behavior; they deleted no data during setup.

Before the remote changes, the existing PGlite suite passed 45 authorization, integrity, privacy and rate-limit checks against the same migration files. These are local PostgreSQL tests, distinct from the live metadata/role verification below.

## Applied migrations and history mapping

| GitHub source file | Recorded remote version | Remote name | Result |
|---|---|---|---|
| `202611220001_school.sql` | `20261121214713` | `school` | Applied |
| `202611220002_storage.sql` | `20261121214718` | `storage` | Applied |
| `202611220003_home_layout.sql` | `20261121214730` | `home_layout` | Applied |

Supabase MCP assigned the recorded versions automatically. Their timestamp prefix is UTC; the work occurred on 22 November in Bangladesh. The original source files remain unchanged. **Do not blindly run `supabase db push` against these original filenames:** the source filename versions and MCP-assigned remote versions must first be reconciled so the migrations are not proposed a second time. Future tooling work should align the local migration filenames/history without rerunning the SQL or deleting history. The exact source SHA-256 hashes and applied-version mapping are in `database-setup-evidence.json`.

## Schema verification

All **16 public tables** exist and have RLS enabled:

- Identity and settings: `admins`, `settings`.
- Public CMS: `content`, `people`, `notices`, `events`, `gallery`, `academic_documents`.
- Private school records: `classes`, `students`, `admissions`, `exams`, `results`, `attendance`, `contact_messages`, `activity_logs`.

The additional `private.rate_limits` table exists. It has no RLS policy by design in the supplied migration; it is protected by the private-schema permission boundary and service-only SECURITY DEFINER function. Both `anon` and `authenticated` lack USAGE on that schema. No existing RLS protection was disabled.

Verified **7 foreign keys**:

| Source | Target | Delete behavior |
|---|---|---|
| `admins.user_id` | `auth.users.id` | CASCADE |
| `students.class_id` | `classes.id` | RESTRICT |
| `exams.class_id` | `classes.id` | RESTRICT |
| `results.student_id` | `students.id` | RESTRICT |
| `results.exam_id` | `exams.id` | RESTRICT |
| `attendance.student_id` | `students.id` | RESTRICT |
| `attendance.class_id` | `classes.id` | RESTRICT |

Verified **29 indexes**: 28 on public application tables and the private rate-limit primary key. These include every planned primary/unique index and the three explicit indexes `notices_publication`, `students_class`, and `results_exam`.

Verified the single-admin and singleton-settings constraints; class/section/year uniqueness; unique student ID and class/roll; unique result/student/exam and private result code; unique attendance/student/day; enum/range/consent constraints; and the non-null JSON home-section list. Read-only checks confirmed that Bangladesh phone formats with local, country-code and plus-country-code prefixes are accepted, while an invalid number is rejected.

All **17 application triggers** exist and are enabled: 14 table audit triggers, the admin-profile audit trigger, result validation and attendance validation. Their definitions enforce score/class integrity and record audit events. Live write-trigger execution with synthetic students was not performed in this step.

## Security policies and read checks

Verified **25 policies**: 24 on public application tables and one Storage object policy. `storage.objects` retains RLS enabled.

- Administrator operations require `is_admin()` and the sole membership row. A signed-in user cannot insert admin memberships or update their role; only their permitted display-name column is editable.
- Public CMS access requires publication. Notices also require `publish_at <= now()`.
- Classes, students, admissions, exams, results, attendance and contact submissions have no public read policy.
- `submit_admission`, `track_admission`, `lookup_result` and `consume_rate_limit` cannot be executed by `anon` or `authenticated`; `service_role` can execute them. Their search paths are pinned.
- The result lookup exposes only the exact published result matching student ID/private code; its approved function definition checks publication time and omits student/guardian PII.
- The tracking lookup returns status/submission time only, rather than applicant information.
- Authenticated users cannot insert, update or delete activity logs. Triggers write the log.
- `is_admin()` is intentionally callable as a boolean membership check and returned false for the tested non-admin contexts.

Live checks used read-only transactions with `SET LOCAL ROLE`. Anonymous users could not SELECT the admin table. Anonymous and authenticated non-admin contexts returned zero visible students, admissions, results and messages; anonymous Storage object reads returned zero visible objects. Privilege checks confirmed the schema/function boundaries above. The tables are empty, so these role checks plus policy inspection are not a populated-data end-to-end privacy test.

Initial data remains minimal: one placeholder settings record; zero admins, students, admissions or results. Admissions are closed. No identity or school policy was invented.

## Storage configuration

| Bucket | Public | Limit | Accepted MIME types |
|---|---|---|---|
| `branding` | Yes | 5 MiB | JPEG, PNG, WebP |
| `teachers` | Yes | 5 MiB | JPEG, PNG, WebP |
| `gallery` | Yes | 25 MiB | JPEG, PNG, WebP, MP4, WebM |
| `admission-documents` | **No** | 10 MiB | PDF, JPEG, PNG |
| `academic-documents` | Yes | 10 MiB | PDF |
| `website-media` | Yes | 5 MiB | JPEG, PNG, WebP |

The `school_admin_storage` policy restricts authenticated object operations to administrators and these bucket IDs. Private admission documents need authorized/signed access. Public bucket files are accessible by URL even if the referencing content record is unpublished; never place confidential student documents in those buckets. Actual file upload/download tests await the upload function and a real administrator account.

## Advisor findings retained for follow-up

No security ERROR-level findings were returned, but the advisor is **not warning-free**.

1. Security: `is_admin()` and the pre-existing `rls_auto_enable()` each trigger anonymous and authenticated SECURITY DEFINER execution warnings, four findings in total. The membership helper's boolean-only behavior and fixed search path are intentional. The pre-existing event-trigger helper was not modified under the three-migration authorization. Review/minimize its callable privileges separately if appropriate. [Anonymous-function guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated-function guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
2. Performance: covering indexes are missing for `attendance.class_id` and `exams.class_id`. These indexes were not in the supplied migrations; add them through a reviewed follow-up migration. [Foreign-key index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
3. Performance: seven tables have separate admin and published-read policies for authenticated SELECT. This is intentional access composition, with an advisor-noted query overhead. Consolidation is a possible later optimization. [Policy guidance](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).
4. Performance: the three new explicit indexes are currently unused, expected on an empty application. Do not delete them based on this initial observation. [Unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

No additional hardening/optimization migration was applied beyond the three authorized source files.

## Remaining work and owner action

- Confirm the real Super Admin email before any invitation. No admin account or password exists yet.
- Configure the actual hosted Auth settings: disable public signup, set password policy and callback URLs, configure SMTP and test delivery/recovery. `supabase/config.toml` alone does not configure these hosted settings through the SQL migrations.
- Choose/authorize an SMTP provider and CAPTCHA provider; enter their actual secrets through a secure provider-owned flow. Do not paste passwords or secret keys into chat. No credentials were fabricated.
- Deploy `public-api` and `upload`, set exact allowed origins/CAPTCHA hostnames and server-side secrets, and verify anonymous-form and administrator-upload access.
- Connect the local frontend to this project's URL/publishable key in ignored environment files; no server secret belongs in frontend variables.
- Complete live login/logout/recovery, CRUD, publication, upload, private result, rate-limit and error-state tests with synthetic records after the owner/admin setup is authorized.
- Reconcile the MCP/local migration-history mapping before future CLI schema pushes; review the outstanding advisor findings.
- Enter verified school content, configure backups and test a restore. Keep admissions closed until acceptance testing is complete.
- Vercel/domain deployment remains pending and was not performed.

The database and Storage migration phase is complete. The application is not yet fully integrated or production-ready.
