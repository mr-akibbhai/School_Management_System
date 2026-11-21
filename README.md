# Primary School Website & Management System

React + TypeScript + Tailwind + Supabase. Bengali-first, English toggle. Complete local source for public pages and a protected administrator workspace. **Not live or production-certified yet.** The school backend is connected; owner invitation, email setup and production acceptance remain pending. See [current integration status](docs/INTEGRATION_STATUS.md).

## Run locally

Use Node 22.12+ (or a compatible newer LTS release) and npm. From this directory:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Open the URL Vite prints. With no credentials the app explicitly displays setup placeholders; it does not simulate saved records. Configure a new checkout using `.env.example`. This checkout already has ignored `.env.local`. Turnstile is optional and deferred; no Cloudflare account is required. Restart Vite after environment changes. Never put a service-role or secret key in a variable prefixed with `VITE_`.

```powershell
npm run build
npm test
npm run test:db
npm run check:edge
npm run test:edge
npm audit
```

The admin URL is `/admin/login`, locally normally `http://127.0.0.1:5173/admin/login`. No default username or password is created. Follow the secure setup guide to invite your own account and set your own password.

## Documents

- [Architecture and database](docs/ARCHITECTURE.md)
- [Supabase, authentication, deployment and domain setup](docs/SETUP.md)
- [বাংলা অ্যাডমিন ব্যবহার নির্দেশিকা](docs/ADMIN_MANUAL_BN.md)
- [Ownership, backup and recovery](docs/OWNERSHIP_AND_BACKUPS.md)
- [Testing report and release acceptance](docs/TESTING.md)
- [Development progress](DEVELOPMENT_PROGRESS.md)

Your original brief requests 26 management areas. They are represented by reusable admin modules and dedicated profile/password, file and activity-log screens. Homepage and About content use categorized CMS records, not individually hardcoded school facts. Academic years are fields on classes/examinations. Approving an admission does not silently create a student; enter the admitted student in Student Management after verification.

The selected source repository is [mr-akibbhai/School_Management_System](https://github.com/mr-akibbhai/School_Management_System), with the application at the repository root on `main`. No domain/service has been purchased, no account created, and no hosting deployment performed. Supabase is connected only to School_Management_System (nfoohhydncflcbegrxbz); SMTP and sole-owner invitation remain pending. Use a **new school Supabase project**, never the old SMSA project. Keep this directory and its lockfile as your independent source copy.

Before committing changes, stage the intended files and run `node scripts/check-secrets.mjs`. This scans staged file contents without printing credential values. Keep `.env` files and server secrets out of Git.
