# School integration status

Verified 22 November 2026 (Asia/Dhaka). This supersedes earlier pending-state notes. Production acceptance remains incomplete.

## Verified project and completed work

Project: **School_Management_System**, reference **nfoohhydncflcbegrxbz**, URL `https://nfoohhydncflcbegrxbz.supabase.co`. The project-scoped MCP uses OAuth. The old SMSA project was not accessed.

- Original migrations were not rerun. Local filenames now match remote history; original SQL hashes match the historical setup evidence.
- One additive hardening migration added covering indexes for `attendance.class_id` and `exams.class_id`, and revoked browser execution of `rls_auto_enable()`. The automatic RLS event trigger remains enabled. Changes were explained before application; no records were deleted or RLS disabled.
- All 16 public tables retain RLS. There are 30 public indexes plus the private rate-limit index, seven foreign keys, 17 application triggers and 25 application/Storage policies as audited. The six existing buckets are preserved; admission-documents remains private.
- Both Edge Functions, **public-api** and **upload**, are **ACTIVE, version 6** at final verification. Public-api accepts only narrow public actions. Upload independently validates the bearer session with Auth and checks `is_admin()` before processing files. Gateway JWT verification is intentionally off for these handlers; application authorization remains enforced.
- Ignored `.env.local` points to the exact school project using its modern publishable key. No service-role key or database password was copied locally or committed.
- Hosted Auth: signup and anonymous sign-in disabled; email/password and confirmation enabled; minimum password length configured as 12; secure email/password change enabled. Site URL is `http://127.0.0.1:5173`; exact reset callbacks for that origin and `http://localhost:5173` are allowlisted.
- Session persistence/refresh, invite/recovery routing, admin-membership checks, logout errors and server-error display were strengthened. Database reads page in batches of 500. The production bundle splits vendor code.

## Applied migration history

| Version | Name |
| --- | --- |
| 20261121214713 | school |
| 20261121214718 | storage |
| 20261121214730 | home_layout |
| 20261121220521 | covering_indexes_and_event_helper_permissions |

Do not replay these migrations. `scripts/check-migration-history.mjs` takes current non-secret MCP migration metadata on stdin and checks names, versions and original hashes without executing SQL. Original evidence intentionally retains original filenames as a historical record.

## Public forms and uploads

The owner deferred Cloudflare. Server `CAPTCHA_MODE=disabled`; frontend site key is blank and Auth CAPTCHA flag is false. No Cloudflare account is required now.

All public operations still require server-validated fields, a bounded JSON body, an empty honeypot and a form timestamp between 1.5 seconds and two hours old. Valid operations share a database-enforced limit of 20 requests per salted IP hash per hour. Raw IPs are not stored in that counter. Missing configuration fails closed. Honeypot/timing values can be reproduced by bots, so they reduce spam without proving a human is present. CORS constrains browser origins; it is not authentication. The gateway must supply a trustworthy forwarded IP.

Configured server names: `ALLOWED_ORIGINS`, `RATE_LIMIT_SALT`, `CAPTCHA_MODE`, and optional future `TURNSTILE_HOSTNAMES`. Origins currently allow only the two local port-5173 origins. Supabase supplies server-only runtime credentials. No Turnstile secret was invented or configured.

Upload enforces authentication/admin membership, bucket allowlists, request/file size limits, signature/MIME matching and generated paths. Private uploads return paths without public URLs; viewing uses signed URLs. File signature checks are not malware scanning.

To enable Turnstile later, configure a real server secret/hostnames and frontend site key, then set server `CAPTCHA_MODE=required`. Missing mode defaults to required. Auth CAPTCHA is separate: enable it on Supabase and set `VITE_AUTH_CAPTCHA_ENABLED=true` together. The owner has deferred both.

## Security audit

Missing covering indexes and event-helper execution warnings were resolved. Two Security Advisor warnings remain for intentional `is_admin()` SECURITY DEFINER execution by anon/authenticated roles. This helper returns only the caller's boolean membership and is needed by RLS/admin routing; it cannot assign roles. The live anonymous check returns false. References: [anonymous helper advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated helper advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Overlapping published-read/admin policies and unused indexes on empty tables were reviewed without weakening access rules. Ordinary authenticated clients cannot delete the sole membership, change its UUID/role or promote another account. Supabase organization owners retain platform-level control.

## Validation and limits

| Check | Observed result |
| --- | --- |
| Frontend validation tests | 4 passed |
| Isolated PostgreSQL/PGlite checks | 54 passed |
| Isolated Deno Edge handler tests | 17 passed |
| Both Edge entrypoint typechecks | Passed |
| TypeScript/Vite production build | Passed |
| Local/remote migration versions and original hashes | 4 matched |
| Live public API/Auth/Storage smoke checks | 21 passed; see live-readonly-smoke.json |
| Owner login, recovery and positive live admin CRUD/uploads | Pending invitation |
| Latest connected visual/mobile recheck | Incomplete: in-app browser localhost connection reset; native HTTP returned 200 |

Live checks cover public settings, anonymous private-table/RPC restrictions, disabled signup, private bucket listing, trusted/untrusted origins, invalid metadata, honeypot rejection, tracking without CAPTCHA and anonymous/forged-token upload denial. Tracking increments only a transient rate counter. No fake student, admission, message, upload or Auth account was created in production. Positive CRUD, upload, integrity and rate-exhaustion scenarios use local synthetic fixtures; these are not live owner acceptance. Earlier setup-mode visual checks/screenshots remain historical.

## Explicitly pending at the owner's request

- **Resend SMTP:** signed in, but no verified sending domain exists. No domain or paid service was purchased. Wait for an owner-provided domain and exact sender, then arrange secure credential entry.
- **Sole Super Admin invitation and membership:** not created. The owner explicitly chose to wait for Resend. Final read-only counts show zero Auth users and zero admins. The pending recipient remains in private task context, not public source. Do not use built-in email as a fallback.
- Invitation acceptance, user-selected password, login/logout/recovery and live admin acceptance require that account. Password entry belongs to the owner.
- Student self-registration, a separate student dashboard/profile/attendance login and a standalone subjects catalog are unsupported by the existing schema. Admin-managed student/attendance/subject-marks data and public private-code result lookup exist. Requirements are needed before adding a new role model/schema.
- School branding/contact details, translations, media consent and grading/admission policy require owner review.

## Hosting, backups and next actions

**No Vercel deployment occurred.** Build and existing Vercel configuration prepare the source. Production origin, Site URL, exact Auth redirects, function origins, environment values and acceptance checks await an approved hosting URL and explicit deployment approval.

The dashboard shows Supabase Free excludes automatic project backups and PITR is a paid add-on. Neither was purchased/enabled. No export or restoration was performed. Keep encrypted independent database/Auth recovery material and separately back up Storage object bytes; rehearse restoration only in an isolated authorized project. See OWNERSHIP_AND_BACKUPS.md.

Next owner-dependent step: a verified Resend domain/sender, secure SMTP setup, the one owner invitation, user-selected password and connected admin acceptance. Real-device/accessibility checks, backup restoration rehearsal and production configuration remain release gates. No manual SQL or coding is requested from the owner.
