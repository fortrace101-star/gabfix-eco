# Supabase Local-First Development & Deployment Guide

## 1. Official Documentation & Reference Links
* **Local Development Workflow:** https://supabase.com
* **Deployment & Branching Overview:** https://supabase.com
* **Managing Config & Secrets:** https://supabase.com
* **Managing Multiple Environments (CI/CD):** https://supabase.com/managing-environments
* **Common Pitfalls (Vibe Coder's Guide):** https://supabase.com

---

## 2. Phase 1: Local Setup & Development
```bash
# 1. Initialize Supabase in your repo
supabase init

# 2. Start local Docker stack (Postgres, Studio, Auth, Storage)
supabase start

# 3. Capture schema changes made in local Studio as a migration
supabase db diff -f <migration_name>

# 4. Verify migrations & seed data replay cleanly from scratch
supabase db reset
```

---

## 3. Phase 2: Pushing to Upstream (Remote Project)
*Rule: Keep your newly created remote project's database completely empty before linking.*

```bash
# 1. Log in and link to your remote project
supabase login
supabase link --project-ref <your-project-id>

# 2. Preview database migrations before applying
supabase db push --dry-run --remote

# 3. Push database schema migrations (excludes seed.sql by default)
supabase db push --remote

# 4. Push project config (Auth settings, Storage buckets, etc. from config.toml)
supabase config push

# 5. Deploy Edge Functions (if used)
supabase functions deploy

# 6. Push production secrets (if used)
supabase secrets set --env-file ./supabase/.env.production
```

---

## 4. What Syncs & How (Avoid Falling Through the Cracks)

| Component | Tracked Locally In | Command to Push Upstream | Common Pitfall to Avoid |
| :--- | :--- | :--- | :--- |
| **Database Schema** | `supabase/migrations/*.sql` | `supabase db push --remote` | Editing tables directly in the cloud Dashboard causes migration drift/conflicts. |
| **Auth & Settings** | `supabase/config.toml` | `supabase config push` | Changing settings in local Studio UI does not auto-update `config.toml`. Edit the file directly. |
| **Storage Buckets** | `supabase/config.toml` or SQL | `supabase config push` | Creating buckets only in the local UI won't migrate them unless declared in `config.toml` or SQL. |
| **Edge Functions** | `supabase/functions/` | `supabase functions deploy` | Functions do not deploy with `db push`; deploy them separately. |
| **Secrets / Keys** | Local `.env` (gitignored) | `supabase secrets set ...` | Secrets never sync automatically; set them explicitly for remote environments. |
| **Test Data** | `supabase/seed.sql` | *Local only* | Never pass `--include-seed` when pushing to production. |

---

## 5. Golden Rules Before Every Commit
1. **Test from zero:** Run `supabase db reset` locally. If it builds cleanly from scratch locally, it will deploy cleanly upstream.
2. **Enforce RLS immediately:** Always include `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;` in the same migration file that creates the table.
3. **Never mix UI and CLI edits in production:** Once linked, treat your local `migrations/` and `config.toml` as the single source of truth.
