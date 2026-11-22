# School integration status

Updated 22 November 2026 (Asia/Dhaka). School project only: School_Management_System, reference nfoohhydncflcbegrxbz. The old SMSA project was not accessed.

## Current verified state

The original website and CMS remain. The upgrade adds one protected Super Admin plus at most one invited secondary Admin, approved teacher accounts, class/subject permissions and a normalized examination workflow. Students and guardians have no accounts.

- 37 public tables, all RLS-enabled; the original 16 tables/data are preserved.
- Ten tracked migrations, with local filenames matching remote versions. No reset, table removal, truncation or existing-record deletion occurred. The owner explicitly approved making student birth_date nullable; past-date validation remains.
- Original six buckets retained. Two new private image buckets: teacher-private and student-photos. Eight total, three private. Private file viewing uses expiring signed URLs.
- Edge Functions active: public-api v7, upload v7, school-accounts v1 at verification. Gateway JWT checks are off because public actions are anonymous and protected actions validate Auth/session/roles inside the handlers.
- Hosted public signup remains disabled. Teacher self-registration uses the guarded server endpoint and an email invitation to verify the mailbox/choose a password; it creates a pending teacher record only after the Auth invitation succeeds. No student/admin public signup exists.
- Production Site URL is https://rabeya-wahed-biddaniketan.vercel.app. Its exact /admin/reset-password callback was added; the two local callbacks remain. The Edge origin allowlist now includes this exact production origin plus the two local port-5173 origins. No Vercel project/settings were replaced.
- Cloudflare remains optional/deferred. Validation, bounded requests, server rate limiting, honeypot/timing checks, Auth and RLS remain enforced.

## Account and email gates

The live project still has zero Auth users, zero owner memberships, zero teachers, zero secondary Admins and zero students. No synthetic school record or second administrator was created in production. The owner's earlier request to keep the initial invitation pending for Resend remains respected.

Resend has no verified sending domain. The school-accounts email gate, SCHOOL_EMAIL_ENABLED, defaults to false and is not enabled. Invitations and registration email therefore return an explicit SMTP-pending message before creating an Auth user. No credentials or sender address were invented. Supabase's default SMTP serves only project-team addresses and currently allows two messages/hour; it cannot support ordinary external teachers/Admin invitees in production. [Official SMTP limits](https://supabase.com/docs/guides/auth/auth-smtp).

After an owner-provided verified domain/sender and secure SMTP configuration, enable SCHOOL_EMAIL_ENABLED=true, complete the pending primary-owner invitation, and run real-mailbox acceptance. This is an infrastructure action, not an instruction for the owner to write SQL or code.

## Access and marks workflow

The original admins singleton table remains the protected owner record. Secondary Admin invitations and memberships use separate one-slot constraints. Only is_super_admin callers can reserve/send/revoke invitations; acceptance requires the exact invited Auth user, matching confirmed email and an unexpired invitation. Revocation changes membership immediately; organization owners retain platform-level control. No second Admin is created automatically.

Teachers have pending/approved/rejected/suspended statuses. Admin approval and class-subject assignment are required. Teachers cannot edit status/role/assignments. A minimal roster RPC returns enrollment ID, student code, roll and name only, never student DOB, guardian, address or phone. Own teacher profiles/photos are private; approved teachers see their own submissions/history and assigned classes.

Exam configuration includes class/year, type, deadline, entry switch, subject full/pass marks and named assessment components. One examination row represents one class; use the same name/type across applicable classes. Components must total the full mark. Academic identities/configuration lock where changes would repoint historical marks.

Marks are saved transactionally through save_marks, with assignment, approval, class, component, numeric bound, duplicate, deadline and submission-state checks. Drafts can contain completed student rows; a final submission must cover the full eligible roster. Submitted marks lock until an Admin reopens them. Admins can correct open drafts through the same validation. The Admin reviews submissions, calculates snapshots, then explicitly publishes. Publication rejects unreviewed or stale calculations. Exam-scoped locks serialize marks/review/publication. Direct legacy result writes are revoked; legacy records remain readable.

The school defines grade thresholds and optional GPA points; no school scale is seeded. Calculation produces subject marks, total, percentage, grade, subject pass/fail, optional mean subject GPA and dense merit rank (passes before failures; ties share rank). Grade/GPA thresholds and pass marks are independent and must match school policy. Changing marks/grading requires recalculation before publication. Public lookup requires both student code and a private random access code and returns only published academic data. Internal provenance and student/guardian PII are omitted.

Admin features include student details/photos, current enrollment, roll/year/section, promotion with historical enrollments, transfer/withdrawal records, teacher/class attendance, class reports, routines/homework, public class-subject catalog and the existing calendar/notices/CMS/media moderation. Print actions support tabulation/marksheets and the browser's Save as PDF; no external paid PDF service is used.

## Security findings and limitations

All new tables use explicit grants and RLS. Privileged SECURITY DEFINER functions have fixed empty search paths and perform role/assignment checks. Security Advisor reports two warning groups: 2 anonymous and 19 authenticated SECURITY DEFINER execution findings for callable catalog/authorization helpers and guarded RPCs. Performance Advisor reports 6 initplan warnings, 28 overlapping-policy warnings and 19 unused-index informational findings on the empty database. There are no missing-FK-index findings. These performance items remain tracked for profiling rather than weakening RLS. These warnings are documented, not represented as a clean audit. [Anonymous function advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated function advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Account status/invitation/acceptance/revocation changes produce semantic audit events without storing emails or payloads in the log. Marks revisions retain protected history. Uploads validate session/role, bucket, signatures/MIME and size. These checks are not malware scanning. Honeypot/timestamps are spam deterrents, not proof of a human. The rate counter depends on a trustworthy gateway forwarded-IP header. Private tables/keys are never exposed to the frontend.

Core public pages preserve Bengali/English navigation. New workflow labels are bilingual or English; full editorial translation and real-device/authenticated accessibility review remain acceptance work. Pre-primary admissions are not enabled without confirmation that the school offers them. Class teaching remains 1–5.

## Tests actually executed

| Check                                                     | Result                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Original isolated database suite                          | 54 checks passed                                                                                 |
| Full migration/role/marks/invitation upgrade suite        | 83 checks passed                                                                                 |
| Public API and upload Deno suite                          | 19 tests passed                                                                                  |
| School-account handler Deno suite                         | 12 tests passed                                                                                  |
| Frontend schema suite                                     | 4 tests passed                                                                                   |
| All three Edge entrypoint typechecks                      | Passed                                                                                           |
| TypeScript/Vite production build                          | Passed                                                                                           |
| New live anonymous/API/privacy/email-gate smoke suite     | 26 checks passed; live-upgrade-smoke.json                                                        |
| Historical live suite                                     | 21 checks passed; live-readonly-smoke.json                                                       |
| Connected local browser                                   | Teacher registration desktop/mobile 390×844; no horizontal overflow; protected route shows login |
| Real invitation/password/approved-user browser acceptance | Pending SMTP and initial owner invitation; not claimed passed                                    |

Positive synthetic accounts/marks/student fixtures exist only in isolated PGlite/fake handler tests. Live checks use reads/rejected requests and transient rate counters; no fake student/teacher account was created. Snapshot counts and migration evidence are in DATABASE_SETUP.md and upgrade-evidence.json.

## Release and ownership

The existing GitHub main branch is connected to the existing Vercel project, verified by its Vercel commit status. Tested source is pushed to that same repository; final commit/deployment evidence is reported with the task completion. No second repository, Vercel project, domain or paid service was created.

Backups/PITR were not upgraded or tested. Supabase Free automatic project backups are unavailable; independent encrypted database/Auth recovery planning and separate Storage-byte copies remain necessary. No recovery claim is made.

Remaining owner-dependent steps: verified Resend domain/sender and secure credentials, the pending initial Super Admin invitation/password, real teacher/secondary-admin mailbox acceptance, authenticated workflow and print/PDF review, final verified school content, and an isolated backup restoration rehearsal. Detailed operating steps are in ADMIN_MANUAL_BN.md. Do not add organization members to bypass email restrictions.
