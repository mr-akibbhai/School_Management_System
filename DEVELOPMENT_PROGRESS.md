# Development progress

Updated: 22 November 2026 (Asia/Dhaka).

## Current milestone

Local application source and database/security foundation implemented. User has existing accounts and explicitly plans to connect them later. No live Supabase connection or deployment is claimed. This is not yet a production acceptance sign-off.

## Implemented

- React, TypeScript, Tailwind, shared responsive design, Lucide icons and Bengali typography.
- All requested public page routes, bilingual navigation and persisted language preference.
- Database-backed school settings, CMS records, profiles, notices, news/events, gallery and academic/download documents; no permanent mock backend.
- Home section visibility/reordering, content categories, principal message, classes and academic-year fields.
- Protected administrator shell and CRUD editors for requested management areas, record preview, publication controls, scheduled notices, search, private messages and append-only activity logs.
- Student, admission, examination, subject marks, private published results and attendance infrastructure.
- Auth login/logout/recovery/password/profile flows; secure first-admin invitation script with no default password.
- Anonymous admission/contact forms and tracking/result lookup wired to server functions with input validation, Turnstile verification and rate limits.
- Six separate storage buckets, authenticated upload function with file validation, file library and private-document signed links.
- SQL policies/triggers enforce admin role, private student records, scheduled publication and score/class integrity.
- Favicon, browser metadata, build-time sitemap/robots generation, Vercel SPA routing and security headers.
- Setup/deployment/environment documentation, Bengali admin manual, ownership/backup checklist and explicit testing report.

## Database changes

Local verification: production build passed; 4 form/schema test cases passed; 45 PostgreSQL authorization/privacy/integrity checks passed; both Edge Functions passed Deno typechecking; npm audit reported zero findings. Browser checks covered public routes, setup-mode protected routing, language persistence, desktop layout and 390 px mobile navigation. See `docs/TESTING.md` for limits and the pending live acceptance matrix.

1. `202611220001_school.sql`: application schema, single admin membership, RLS/grants, audit/validation triggers, private request limits and service-only public-operation functions.
2. `202611220002_storage.sql`: six buckets with size/MIME limits and administrator policies.
3. `202611220003_home_layout.sql`: editable home-section list and admin-profile audit trigger.

All migrations are intended for a fresh project and tracked in order. Do not manually reapply them to an existing database. Do not use development test fixtures as production data.

## Pending before production release

- Connect the owner's Supabase project, apply migrations and deploy Edge Functions.
- Configure production SMTP, Turnstile hostname restrictions, function secrets, exact frontend origins and Auth callback allowlist.
- Invite the sole owner-selected admin and verify email/password setup and recovery in the real browser.
- Test every admin module with the real Auth/PostgREST/Storage/Edge runtime, including CRUD, publication, uploads and unauthorized users.
- Enter verified school details, required translations, grading/admission policy and consented images; remove all placeholders.
- Verify production security headers/CSP, social sharing previews and crawler behavior. Client-side metadata alone does not guarantee social previews; server-rendered/prerendered per-route metadata remains a release enhancement.
- Run real-device Android/iOS/tablet checks and an accessibility/keyboard audit of authenticated modals and forms.
- Configure independent backups and perform an isolated restore rehearsal.
- Push the source to the owner's GitHub and deploy to their selected hosting account/domain, then run the live acceptance checklist.

## Known limitations

- With no credentials the app shows a setup state, not a simulated working database; forms and login cannot complete.
- UI labels include some English enum names in the Bengali dashboard; school-authored content has separate Bangla/English fields with Bangla fallback.
- Public media bucket URLs remain accessible even after a referencing content record is unpublished; delete/replace the actual object for removal. Private documents belong only in the private bucket.
- Upload validation checks signatures and MIME, not full malware scanning. No automatic image transcoding/compression pipeline is implemented.
- Approval of an application does not automatically enroll a student; administrator verifies and creates the student record explicitly.
- No bulk marks/attendance import, auto-calculated GPA, automated email responses or billing subsystem; these were not assumed as school policy.
- Public content refreshes on app load, window focus and admin saves. Realtime push updates to other open browsers are not implemented.
- Record/file lists use the platform's default page-size limits; server pagination should be added before larger deployments (over 1,000 records/files).
- Modal deletion dialogs require further keyboard focus-trap testing during acceptance.

## Deployment status

Not deployed. No paid services purchased and no account credentials invented or exposed. Live account connection intentionally awaits the owner. Source destination: `https://github.com/mr-akibbhai/School_Management_System`, branch `main`, with the application at the repository root. Upload preparation includes an expanded `.gitignore` and a staged-file credential scanner. The old SMSA Supabase project is outside the scope of this school project and must not be connected or modified.

## Next steps

Use `docs/SETUP.md` with a staging Supabase project. Complete `docs/TESTING.md` against the real connected system. Resolve any integration errors, then publish only under the owner's accounts and verify the production URL. Preserve this progress file across phases.
