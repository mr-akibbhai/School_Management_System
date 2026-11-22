# Initial owner activation

Verified 22 November 2026 (Asia/Dhaka) on School_Management_System, project reference nfoohhydncflcbegrxbz.

The initial owner is now activated. Supabase built-in Auth email sent the invitation to the owner address, which matched the signed-in Supabase project-team account. The owner personally accepted the link and chose the password. No password or invitation token was handled, generated, logged or stored by the agent.

## Verified evidence

- A single Auth user was created for the exact owner-requested email; invited_at was populated.
- Email confirmation, a successful Auth sign-in and password-set status were verified through metadata; password contents/hashes were never printed.
- Exactly one protected super_admin membership exists in the original singleton admins table and points to that Auth UUID.
- Zero active secondary Admins were created.
- All public tables retain RLS. Browser roles cannot change owner role/UUID or delete the owner row. No policy or grant was weakened.
- The authenticated Chrome school-management workspace displayed SUPER ADMIN at /admin/school. Existing user edits were left untouched.
- A bootstrap audit event INITIAL_SUPER_ADMIN_PROVISIONED records the trusted project-owner provisioning operation. There is no public owner-registration endpoint.

## Invitation callback fix

Source commit d029cf5 fixes the actual SDK mismatch: dashboard invitations use an implicit invitation callback, while the application normally uses PKCE. The client selects invitation parsing only for a complete invite callback containing both required callback credentials and no error marker. Ordinary visits and app-initiated recovery retain PKCE. Supabase still validates the Auth user, and database permissions still determine the role; no role is accepted from URL parameters.

Seven callback tests plus the four existing frontend tests passed (11 total), and the TypeScript/Vite production build passed. The fix was deployed successfully before sending the invitation. The real owner invitation/password/dashboard workflow then completed successfully.

## Remaining email scope

This one-time built-in invitation does not enable general school email. Supabase's default service restricts delivery to project-team addresses and is rate-limited/best-effort. Resend/custom SMTP and the SCHOOL_EMAIL_ENABLED gate remain pending for external teacher and secondary-admin invitations. Do not add organization members merely to bypass mail restrictions. [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).

The primary owner no longer needs another invitation. Use the existing account or normal recovery; never create a duplicate owner. Private verification identifiers and screenshots are retained outside Git; no owner email, Auth UUID, password or token is embedded in this public report. SMSA was not accessed.
