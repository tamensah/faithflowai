# Neon Database Migration Runbook

This runbook is the source of truth for moving FaithFlow's PostgreSQL database from Render to Neon. The application architecture stays the same: Vercel hosts the two Next.js frontends, and Render hosts the Fastify API and scheduled jobs.

## Connection contract

Use two Neon connection strings for each environment:

| Variable | Endpoint | Used by |
| --- | --- | --- |
| `DATABASE_URL` | Pooled | API runtime and normal application traffic |
| `DATABASE_URL_UNPOOLED` | Direct | Prisma migration deploy and database administration |
| `DIRECT_URL` | Direct, optional alias | Local or CI override; Prisma prefers it when present |

Never expose either value in client-side variables, logs, commits, screenshots, or issue comments.

## Environment mapping

| Git branch | App environment | Neon target |
| --- | --- | --- |
| Feature branch | Ephemeral preview | Isolated Neon branch when database changes need preview validation |
| `develop` | Stable staging | Long-lived Neon `develop` branch |
| `main` | Production | Neon default branch |

Vercel production deployments track `main`; preview deployments track non-production branches. Render staging tracks `develop`; Render production tracks `main`.

## Migration workflow

1. Create a feature branch from current `develop`.
2. Add a Prisma migration with `pnpm db:migrate` against a disposable or development database.
3. Validate the schema with `pnpm db:validate`.
4. Create an isolated Neon branch from the intended parent.
5. Set its pooled URL as `DATABASE_URL` and direct URL as `DATABASE_URL_UNPOOLED`.
6. Apply checked-in migrations with `pnpm db:migrate:deploy`.
7. Confirm `pnpm db:migrate:status` reports the database is up to date.
8. Run API and browser smoke tests against the isolated branch.
9. Merge the feature PR to `develop`; deploy migrations to the Neon `develop` branch before the staging API starts.
10. Promote `develop` to `main` only after staging sign-off. The same checked-in migrations then run against the default Neon branch.

Do not use `prisma db push` in staging or production. It does not provide the reviewed migration history required for promotion and rollback decisions.

## Initial Render-to-Neon cutover

1. Record a source-database backup or snapshot and source row counts.
2. Create a fresh target database on an isolated Neon branch.
3. Apply every checked-in migration with `pnpm db:migrate:deploy`.
4. If source data exists, copy it with PostgreSQL-native tools using direct connections, then compare row counts and critical tenant records.
5. Run schema, API, auth, tenant-isolation, webhook-idempotency, and browser smoke checks.
6. Configure Render staging with the Neon staging pooled and direct URLs.
7. Validate staging before changing production configuration.
8. Configure Render production with the Neon default-branch pooled and direct URLs during the approved cutover window.
9. Keep the source database read-only and available through the rollback window.

The September 2026 recovery started from a Neon database containing a small, incompatible test schema and no production data. That schema must remain isolated for reference; it is not a valid migration baseline.

## Verification queries

Run read-only checks after every migration deploy:

```sql
SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Then run:

```bash
pnpm db:migrate:status
pnpm typecheck
pnpm build
pnpm lint
pnpm audit --prod
```

## Rollback

- Application regression: redeploy the prior Vercel or Render build while keeping schema compatibility.
- Failed forward migration: stop promotion and fix the migration on the feature branch.
- Production data incident: use a Neon snapshot or point-in-time branch, verify it, and switch connections through the provider controls.
- Never improvise destructive rollback SQL against production. Prefer a reviewed forward fix or a verified snapshot restore.
