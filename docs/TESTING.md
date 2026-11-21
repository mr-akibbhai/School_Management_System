# Testing report and release acceptance

Updated 22 November 2026: 4 frontend tests, 54 isolated database checks, 17 isolated Edge tests, both Edge typechecks and production build passed. All 21 live smoke checks passed. See INTEGRATION_STATUS.md and live-readonly-smoke.json. Owner Auth/admin acceptance remains pending. Visual checks below are historical setup-mode checks; the latest connected visual/mobile recheck encountered a browser localhost connection reset despite native HTTP 200.

## Observed passes

| Check                                        | Result                                                                       | Scope                                                                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript + Vite production build           | Passed                                                                       | Frontend bundle, not backend deployment                                                                                                        |
| Public submission/schema tests               | 4 test cases passed                                                          | Admission coercion/consent/date/phone/class validation, contact validation, unsafe URL rejection                                               |
| PostgreSQL migration/security checks         | 54 checks passed | PGlite runs actual PostgreSQL SQL/policies with a test Auth identity function and a minimal Storage schema, not the complete Supabase platform |
| Supabase Edge Function typecheck             | Passed for both functions using Deno                                         | Compilation/import/types, not remote runtime behavior                                                                                          |
| npm dependency audit                         | Zero findings after updates                                                  | Registry audit at execution time, not a security certification                                                                                 |
| Public page browser smoke checks             | Passed                                                                       | Home, About, Administration, Teachers, Academics, Admission, Notices, Results, Gallery, News, Downloads, Contact                               |
| Unknown route                                | Passed                                                                       | Custom 404 content renders                                                                                                                     |
| Direct protected route without service setup | Passed                                                                       | `/admin/students` renders login/setup; no admin data exposed                                                                                   |
| Language preference                          | Passed                                                                       | Bangla → English, persisted after navigation; switched back to Bangla                                                                          |
| Desktop preview                              | Passed                                                                       | Home observed at 1155 px viewport; no document horizontal overflow                                                                             |
| Mobile preview                               | Passed                                                                       | 390 × 844 viewport; menu opens, English and Bangla render, no document horizontal overflow                                                     |
| Missing service configuration                | Passed                                                                       | Clear setup banner and empty states; contact submission disabled                                                                               |
| Browser console                              | No errors observed                                                           | During the route/language/mobile checks above                                                                                                  |

The PostgreSQL checks cover anonymous private-table/RPC denial, non-admin write/self-promotion denial, one-admin enforcement, authorized class/student/exam/result writes, marks validation, immutable logs, restricted profile columns, scheduled notice/result visibility, exact private result lookup without student PII, tracking status without applicant PII, admission-open enforcement and rate-limit exhaustion. Storage policy tests use a minimal table scaffold and do not exercise the actual file-serving API.

Screenshot: `docs/screenshots/home-desktop.jpg`. The screenshot is a setup preview with explicit placeholders, not a live school deployment. Home layout controls were added after the initial screenshot and preserve its default section order.

## Reproduce

```text
npm ci
npm run build
npm test
npm run test:db
npm audit
deno check supabase/functions/public-api/index.ts supabase/functions/upload/index.ts
```

Use a compatible current Node version. Deno can be installed from its official distribution or run through the official `deno` npm package. Database tests create an isolated in-memory test database and do not touch user data. They are not a substitute for deploying migrations to a staging Supabase instance.

## Required connected-system acceptance

The original checklist follows. Database setup/history and documented live negative checks are complete; owner Auth/email, positive live CRUD/uploads and final deployment checks remain pending. Run with synthetic records in the owner's staging project first, then verify the final production configuration. Do not mark an item passed from the local tests above.

1. Existing database setup is complete; never rerun applied migrations. Review policies/roles/constraints and advisors after future changes. Confirm no exposed private schema or service key in the built JS.
2. Complete deferred Resend SMTP and approved production redirects (Turnstile optional); invite the owner, set a password, log in and log out. Reopen protected URLs after logout. Try a signed-in non-admin account. Test expired sessions and network failures.
3. In every admin management area, create a record, reload it, edit it, preview it and delete the synthetic record where deletion is supported. Verify database rows and audit events. Check foreign-key errors are understandable. Logs are deliberately read-only; settings/profile are singleton updates.
4. Change school names, logo, contact information, welcome/about/principal content, and homepage section order/visibility. Verify the public site reflects the saved values and undo the synthetic changes. Verify both languages and long Bengali content.
5. Publish/unpublish a notice; pin/unpin it; schedule another in the future. Verify search/category filtering, direct detail links and PDF attachment. Verify anonymous users cannot read future/draft rows via REST.
6. Submit a valid admission without signing in. Confirm one stored row and a tracking number. Track it; change review/approval/rejection status as admin; track again. Invalid fields, missing consent, expired CAPTCHA, wrong hostname, disallowed origin and closed admissions must fail without creating a row.
7. Submit contact message; verify storage and unread/read/resolved management. Confirm anonymous users cannot list messages. Test malformed/oversized bodies and rate limits.
8. Add classes, students, exam and marks. Test invalid score ranges, cross-class students, duplicate roll/result and zero subjects. Publish a result and look it up with its exact student ID/private code. Wrong code, another student's ID, draft and future result must return no result. Inspect response/network logs for PII leakage.
9. Add/edit attendance and attempt duplicate student/day and wrong class. Exercise routine/syllabus/calendar/download pages and filter by class.
10. Upload real JPEG/PNG/WebP/PDF and supported videos to correct buckets. Reject oversize/mismatched/HTML/SVG files. Verify admin-only upload/delete and private signed URLs. Confirm public documents are public only when intentionally placed there. Test file removal and image replacement; resolve resulting stale links.
11. Gallery category filtering, video playback, event/calendar dates, external map/Facebook links and every internal navigation link. Consent review for all published child photographs.
12. Password change with current password, incorrect-current-password failure, recovery email delivery, expired link, opened-in-another-browser behavior and lost-access owner procedure. Confirm first-admin setup refuses a second account.
13. Authenticated workspace at desktop/tablet/Android/iOS sizes. Keyboard navigation, form labels, visible focus, delete-dialog focus containment/Escape behavior, contrast, readable Bengali, slow network/loading/retry, print result sheet, empty lists and connection failure. Record issues and fix them before release.
14. Production CSP/security headers, custom domain HTTPS, direct nested routes, canonical URL, generated sitemap, robots exclusion and social crawler previews. The SPA's client-side metadata does not alone guarantee rich social cards.
15. Back up database/Auth strategy and all Storage objects. Restore into an isolated project and compare record/object counts, login, file access and result visibility.

A production-ready declaration requires these connected checks, verified school content, account ownership and a confirmed live URL. None is implied by a successful local build.
