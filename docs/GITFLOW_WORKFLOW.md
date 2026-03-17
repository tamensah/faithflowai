# FaithFlow AI — Git & Deployment Workflow

This document is the source of truth for how code moves from a developer's machine to production. Every contributor and automation must follow this workflow. **Production (`main`) is never touched directly.**

---

## Environments

| Environment | Purpose | Branch | Admin URL | API |
|-------------|---------|--------|-----------|-----|
| **Local** | Development | any feature branch | `localhost:3001` | `localhost:3000` |
| **Preview** | Per-PR review | `feature/*` or `hotfix/*` | Ephemeral Vercel URL per PR | Local or staging API |
| **Staging** | Integration QA — must pass before prod | `develop` | `https://admin-staging-tamensahs-projects.vercel.app` | Render staging service |
| **Production** | Live SaaS platform | `main` | `https://admin-tamensahs-projects.vercel.app` | Render production service |

---

## Branch Model

```
feature/<ticket-or-name>
  └─► PR → develop ──────► staging (auto-deploy)
                               │
                         QA sign-off
                               │
                    PR → main ──► production (auto-deploy)

hotfix/<name>
  └─► PR → main ──► production
        └─► backport PR → develop (immediately after)
```

### Branch purposes

| Branch | Who commits | How changes arrive | Protections |
|--------|------------|-------------------|-------------|
| `feature/*` | Any contributor | Direct push | None |
| `hotfix/*` | On-call / lead | Direct push | None |
| `develop` | Automated (PR merge only) | PR from `feature/*` | Require PR, passing build |
| `main` | Automated (PR merge only) | PR from `develop` or `hotfix/*` | Require PR, require 1 approval, passing build |

---

## Day-to-Day Flow

### 1. Starting a feature

```bash
git checkout develop && git pull origin develop
git checkout -b feature/my-feature
```

### 2. Committing and pushing

```bash
git add <files>
git commit -m "feat: describe the change"
git push origin feature/my-feature
```

Vercel automatically builds an **ephemeral preview URL** for every push to a non-main branch. Use that URL for self-review before opening the PR.

### 3. Opening a PR to `develop`

- Target: `develop`
- Title: clear description of the change
- Include: what was changed, how to test, any migration steps
- Vercel preview must be **Ready** (green) before requesting review

### 4. PR merged → staging validates

Once the PR is merged to `develop`:
- Vercel auto-deploys to staging (`https://admin-staging-tamensahs-projects.vercel.app`)
- Run through the staging verification checklist (see below)
- If any issues found: fix on a new `feature/*` branch, PR back to `develop`

### 5. Promoting to production

When staging is okayed:
```bash
# Open a PR from develop → main on GitHub
# Title: "Release: <date or version>"
# Get 1 approval, confirm staging passed
# Merge → production auto-deploys
```

Never merge `develop → main` while there are active bugs or untested migrations on staging.

---

## Hotfix Flow

For critical production bugs that cannot wait for the normal cycle:

```bash
git checkout main && git pull origin main
git checkout -b hotfix/critical-fix

# Make and test the fix locally
git push origin hotfix/critical-fix

# Open PR directly against main
# Get approval, merge → production deploys

# Immediately backport to develop
git checkout develop && git pull origin develop
git checkout -b hotfix/backport-critical-fix
git cherry-pick <commit-sha>  # or merge the hotfix branch
git push origin hotfix/backport-critical-fix
# Open PR → develop
```

**Do not let `main` and `develop` diverge.** Every hotfix must be backported within the same working session.

---

## Database Migration Rules

Migrations are **destructive** if run in the wrong order. Follow this protocol strictly:

1. **Write the migration** locally: `pnpm db:migrate`
2. **Test on local DB** — confirm no data loss
3. **Merge to `develop`** — migration runs against staging DB before deploy
4. **Verify staging** — confirm the schema change is correct and rollable-forward
5. **Merge to `main`** — migration runs against production DB on deploy

> Never open a `develop → main` PR while a migration is pending review or untested on staging.

For destructive column drops or renames, always use a two-step approach:
- Step 1 (current release): add new column, keep old column, migrate data
- Step 2 (next release): drop old column once all reads/writes use the new one

---

## Staging Verification Checklist

Run this after every `develop` deploy and before opening the `develop → main` PR:

- [ ] Staging admin loads and auth works
- [ ] Tenant provisioning works (sign in as a new org)
- [ ] Any new feature works end-to-end on staging
- [ ] No TypeScript build errors (CI must be green)
- [ ] If a migration was included: schema verified in staging DB
- [ ] If comms were touched: test email/SMS dispatches correctly
- [ ] If billing was touched: test Stripe/Paystack checkout in test mode
- [ ] If streaming was touched: provider sync preview returns expected data

---

## Vercel Project Setup

Both `admin` and `web` Vercel projects follow the same pattern.

### Production branch

In Vercel Dashboard → Project Settings → Git:
- **Production Branch**: `main`
- All pushes to `main` deploy to production automatically

### Staging branch (permanent stable URL)

To have Vercel automatically update the staging alias on every `develop` push **without manual CLI aliasing**:

1. Go to **Vercel Dashboard → Project → Settings → Domains**
2. Add domain: `admin-staging-tamensahs-projects.vercel.app`
3. Set **Git Branch** to `develop`

Vercel will now update this alias automatically on every successful `develop` deploy. You no longer need to run `vercel alias` manually after each push.

> **Current state (2026-03-17):** The staging alias is manually managed via CLI until the dashboard domain assignment is made. After adding the domain in the dashboard, the manual step is eliminated.

### Preview deployments

Every push to any branch (including `feature/*` and PRs) automatically gets an ephemeral preview URL from Vercel. These expire after 30 days of inactivity.

---

## GitHub Branch Protection (Required Setup)

Set these in **GitHub → Settings → Branches → Add rule**:

### `main`
- ✅ Require a pull request before merging
- ✅ Require 1 approving review
- ✅ Require status checks to pass (Vercel build)
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings (even for admins)
- ✅ Restrict who can push: nobody (merges only via PR)

### `develop`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass (Vercel build)
- ✅ Do not allow bypassing the above settings

---

## Render API Environments

The Fastify API runs on Render, not Vercel. Render has **two separate services** — staging and production.

| Service | Render branch | Purpose |
|---------|--------------|---------|
| `faithflow-api-staging` | `develop` | Staging API for the staging frontend |
| `faithflow-api` | `main` | Production API |

**Always deploy the staging API first** when a PR introduces backend changes. The `develop → main` PR should only be opened after both the staging frontend and staging API are verified together.

Cron jobs (`render.cron.yaml`) run against the production API only. Staging uses a separate cron config (or manual task triggers via the health page).

---

## Commit Message Convention

```
type: short description (imperative, lowercase, no period)

Optional body explaining why.
```

Types: `feat`, `fix`, `security`, `refactor`, `docs`, `chore`, `test`

Examples:
```
feat: add KB article deflection to ticket creation form
fix: update health page for security-hardened router response
security: fix SSRF in streaming URL probe
chore: regenerate Prisma client for KBArticle model
docs: establish dev→staging→prod branch workflow
```

---

## Reference

- Deployment runbook (Render + Vercel setup, env vars, webhooks): `docs/DEPLOYMENT_MANUAL.md`
- Third-party provider credentials: `docs/THIRDPARTY_CONFIG.md`
- Scheduler profiles and cron cadence: `docs/SCHEDULER_PROFILES.md`
- Staging admin: https://admin-staging-tamensahs-projects.vercel.app
- Production admin: https://admin-tamensahs-projects.vercel.app
