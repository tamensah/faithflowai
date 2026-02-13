# FaithFlow Migration Assistant

Goal: help a church migrate real data safely (members, households, and donations) with dry-run + rollback.

This doc is written for developers and early adopters.

## Import flow (recommended)

1. Export CSV from your current ChMS.
2. Download FaithFlow templates:
   - `docs/import_templates/members.csv`
   - `docs/import_templates/households.csv`
   - `docs/import_templates/donations.csv`
3. Normalize headers to match the template (FaithFlow also supports common aliases, but templates reduce surprises).
4. In admin:
   - Members + households: Admin -> Members
   - Donations: Admin -> Finance -> Import donations (CSV)
5. Run **Dry-run** first.
6. Apply import.
7. If you spot mistakes, use **Rollback** (batch id based).

## CSV requirements

- UTF-8 encoding preferred.
- Commas as separators; wrap strings containing commas in quotes.
- Dates: `YYYY-MM-DD` or ISO-8601 timestamps.
- Phone numbers: include country code when possible (e.g. `+233...`, `+1...`).

## Notes on matching

- Members imports support de-duplication by email/phone.
- Donations imports try to link to a member via `memberEmail` or `memberPhone` when present.
- Donations imports can upsert Funds/Campaigns by name (`fundName`, `campaignName`).

## Rollback semantics (beta)

- Rollback deletes CREATED records for a batch.
- Rollback does not yet revert UPDATED records (if a future import adds updates).

## Common issues

- "Church not found": ensure you selected the right organization/church in Clerk, then retry.
- "Staff access required": only staff/admin can run imports.
- "Invalid amount": donation rows with non-positive amounts are skipped.

