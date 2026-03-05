# FaithFlow Migration Assistant

Goal: migrate real church data safely (members, households, donations) with dry-run validation and rollback.

Audience: developers, implementation partners, and early adopters.

## Current import coverage

- Members import: supported in Admin -> Members (`member.importCsv`).
- Households import: currently handled through member import using `householdName` on each member row.
- Donations import: supported in Admin -> Finance -> Import donations (CSV) (`donation.importCsv`).

## Recommended migration flow

1. Export CSV files from your current ChMS.
2. Start from FaithFlow templates:
   - `docs/import_templates/members.csv`
   - `docs/import_templates/households.csv` (staging/template for normalizing household names before member import)
   - `docs/import_templates/donations.csv`
3. Normalize headers and date formats before upload.
4. Run **Dry-run** first to inspect warnings/errors.
5. Apply import only after dry-run summary is acceptable.
6. Record batch IDs and run rollback if needed.

## CSV requirements

- UTF-8 encoding.
- Comma-delimited values, quote cells containing commas.
- Dates in `YYYY-MM-DD` or ISO-8601 timestamp format.
- Phone numbers in E.164 format when possible (`+233...`, `+1...`).

## Members + households mapping

Required member fields:
- `firstName`
- `lastName`

Common optional member fields:
- `email`, `phone`, `preferredName`, `middleName`, `status`, `tags`, `notes`
- address fields: `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`, `country`
- date fields: `dateOfBirth`, `joinDate`, `baptismDate`, `confirmationDate`
- household assignment: `householdName`

Accepted member header aliases include:
- `first_name`, `firstname` -> `firstName`
- `last_name`, `lastname` -> `lastName`
- `household`, `household_name` -> `householdName`
- `address1`, `address_line_1` -> `addressLine1`
- `address2`, `address_line_2` -> `addressLine2`
- `zip`, `zipcode` -> `postalCode`
- `dob`, `date_of_birth` -> `dateOfBirth`

Household behavior:
- If `householdName` matches an existing household in the selected church, member links to it.
- If not found, FaithFlow creates household during apply import.
- Dry-run validates row shape but does not persist households.

Deduplication:
- Members are matched first by `email`, then by `phone`.
- Matching member rows are updated; non-matching rows are created.

## Donations mapping

Required donation field:
- `amount` (must be positive)

Common optional donation fields:
- `currency`, `donorName`, `donorEmail`, `donorPhone`
- member link fields: `memberEmail`, `memberPhone`
- giving allocation fields: `fundName`, `campaignName`
- `createdAt`

Accepted donation header aliases include:
- `fund` -> `fundName`
- `campaign` -> `campaignName`
- `date` -> `createdAt`

Donation linking behavior:
- FaithFlow attempts member match via `memberEmail`, then `memberPhone`.
- `fundName`/`campaignName` are upserted by name when missing.
- Invalid rows are skipped and returned in import error summary.

## Source export normalization checklist

- Remove totally blank rows.
- Ensure one header row only.
- Normalize currency to ISO code (`USD`, `GHS`, `NGN`).
- Remove Excel formulas; keep static values only.
- Ensure duplicated members have consistent email/phone.
- For households, prefer a single canonical household name per family.

## Rollback semantics (beta)

- Rollback deletes entities created by the selected batch.
- Rollback does not fully revert updated entities to prior state yet.
- Keep a backup CSV and dry-run reports for traceability.

## Common issues and fixes

- "Church not found": verify Clerk org/church context in top switcher.
- "Staff access required": imports are admin/staff-only operations.
- "Invalid amount": donation amount must be numeric and > 0.
- Large file rejected: split into smaller chunks (current safe target: <= 2,000 member rows per run).
