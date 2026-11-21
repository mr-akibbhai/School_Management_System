# Ownership and recovery checklist

No account, repository or domain has been created or transferred by this execution. The source is stored in your local workspace. Complete this checklist in your own accounts during connection and release.

| Asset          | Owner-controlled evidence to retain                                 | Status                                          |
| -------------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| Source         | Local project, lockfile, private GitHub repository in your account  | Local source delivered; remote pending          |
| Hosting        | Your Vercel project, billing contact and project access             | Pending connection                              |
| PostgreSQL     | Your Supabase organization/project, database password               | Pending connection                              |
| Auth           | Your Supabase Auth configuration and admin mailbox                  | Pending connection                              |
| Storage        | Six buckets and object copies in your project                       | Migrations supplied; live application pending   |
| Domain         | Registrar login, renewal information and DNS access                 | Not purchased or changed                        |
| Super Admin    | Your sole invited email; password chosen by you                     | Not created                                     |
| Configuration  | Frontend environment values and protected server secrets            | Template supplied; values not requested in chat |
| Backup         | Encrypted database/auth/storage copies and tested restore procedure | Owner setup pending                             |
| Email/security | Your SMTP provider and Turnstile widget                             | Pending connection                              |

## Backup procedure

Source control is not a data backup. PostgreSQL backups do not contain Storage file bytes. A frontend deployment is not a database snapshot.

1. Keep source and migrations in your private GitHub repository. Keep an offline copy with the lockfile.
2. Use Supabase's supported database backup/export workflow for your selected plan, or use its CLI `db dump` workflow from a trusted machine. Export schema/roles as needed and data separately. Include application tables, the private rate-limit schema if required, and the Auth recovery strategy; the CLI's default dump does not automatically capture all managed Auth/Storage internals. Follow the current platform guide for your project type rather than assuming one generic `pg_dump` command is a full Supabase backup.
3. Separately copy the objects from all six Storage buckets, preserving each bucket name and object path. The private bucket contains student documents: encrypt backups and restrict access.
4. Keep an encrypted inventory of environment values, SMTP details, redirect origins, Turnstile configuration and account recovery codes. Do not put secrets in Git or this documentation.
5. Choose retention (for example seven daily and four weekly encrypted copies) and keep at least one copy outside the primary service account. Assign responsibility to a school staff member. This schedule is guidance; no automation has been created.
6. Test restoration into an isolated project before trusting the backup. Record date, backup identifiers, restored object counts and observed results.

## Restore rehearsal

Provision an empty project under your control; apply migration versions matching the backup, restore compatible application data in relationship order, and restore file bytes to the original paths. Recover/recreate the Auth user through the provider-supported process, then verify that the sole `admins.user_id` refers to the intended Auth UUID. Do not restore a role for an unknown account.

Managed Auth/Storage schemas need platform-specific restore instructions. Review the Supabase backup/restore guide for your plan before modifying them. Recreating an Auth user changes their UUID unless preserved by a supported restore method. Fixing only the email does not fix the admin membership reference.

Configure new secrets and callback origins; deploy functions and frontend; test RLS and private file access before adding real student records. Compare class/student/admission/result counts, open representative files, verify one published result and one private draft, perform login/logout/recovery, and only then point production traffic at the restored deployment.

## Lost access

- Lost school password: use the app's password recovery and the owner-controlled mailbox.
- Lost mailbox: recover through your SMTP/mail provider or your Supabase owner's authenticated dashboard workflow. Verify the intended user before changing the sole admin UUID.
- Lost hosting: redeploy the source to another account you own, reconnect environment values, then update DNS and origin/callback allowlists.
- Database outage: restore tested backups to a project you own and update frontend/function configuration. A new project URL requires a rebuild.
- Suspected leaked server key: rotate it in the owner dashboard, update the runtime, invalidate affected access and review logs. Never paste the key into chat.

The application is portable because you retain the source, SQL and configuration documentation. Routine content management is independent of a developer; infrastructure upgrades and security incidents still need competent maintenance.
