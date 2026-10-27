# Aircall reporting

Daily and Weekly use `aircall_reporting_calls`, keyed by Aircall call ID. Weekly covers calls starting Monday through Saturday in `America/New_York`. Each call retains its full duration on its start date. Doxy on Weekly comes only from that week's uploaded meeting history.

## Capture and reconciliation

- The existing `/api/aircall/webhook` validates the webhook token and saves raw events. A database trigger updates the reporting ledger in the same transaction. Failed storage returns an error so the delivery is not acknowledged prematurely.
- `call.ended` finalizes a call. Older provisional events cannot regress finalized data. Duplicate deliveries update the same call.
- Successful internal transfer events determine the final recipient. Late transfer deliveries rebuild an already finalized webhook record. Failed transfers do not change ownership.
- API records fill missing calls and missing fields. Missing API agent details never erase captured webhook identities. Final API timestamps resolve differences of up to one second, validated against the platform export. Larger timing differences and unverified agent changes remain flagged, with comparison evidence retained.
- Row-level CSV corrections are authoritative and protected from later API/webhook overwrites. Administrative Aircall corrections apply to both Daily and Weekly. The report UI only accepts Doxy uploads, affecting the selected Weekly team.
- Known attempts count once, including in-progress calls. Talk time and valid-call averages include finalized calls only. Pending, unassigned, conflicting, and failed-sync conditions appear as report warnings.

Daily Fetch reconciles the requested range with the API. Saved Daily views refresh call metrics from the ledger while preserving saved sales and Doxy fields. Newly recovered agents with no saved sales figures show Pending until Fetch rebuilds the sales section.

The report server reconciles the preceding 24 hours at startup and every 30 minutes while running. Set `AIRCALL_BACKGROUND_SYNC=false` for local UI checks. The API client respects rate limits, bounds retries, and persists each retrieved page before requesting the next one. Partial failures preserve captured records and record the sync failure. After extended downtime, run the date-range catch-up tool below.

## Setup and maintenance

Runtime uses the existing Supabase URL/service-role key, Aircall API ID/token, and webhook token. The administration tool additionally needs `SUPABASE_ACCESS_TOKEN`. Credentials remain in environment configuration.

For a new installation, apply `scripts/create-aircall-ledger.sql` and `scripts/create-weekly-report-merge.sql`, or the complete `supabase-schema.sql`. Tables and RPC functions are service-role only; browser clients receive report aggregates.

```powershell
node scripts/aircall-ledger-admin.mjs migrate
node scripts/aircall-ledger-admin.mjs backfill 2026-09-28
node scripts/aircall-ledger-admin.mjs fill-phones 2026-09-28
node scripts/aircall-ledger-admin.mjs backfill-transfers 2026-09-28
node scripts/sync-aircall-history.mjs 2026-09-28 2026-10-27
node scripts/recheck-aircall-conflicts.mjs 2026-09-28
```

Use `functions` instead of `migrate` when changing only merge functions on an active database. It avoids table/trigger DDL during webhook ingestion. Date-range API catch-up resumes completed days and preserves partial pages. The September 28 start includes the first October reporting week. API catch-up includes Sundays in the ledger; Weekly filters them out.

Use `scripts/reconcile-aircall-ledger.mjs` for independently verified historical corrections. Keep raw event history. A record unavailable in both the API and finalized webhook history remains incomplete until an export or another authoritative record supplies it; an API success alone does not prove historical completeness.

## Validation

```powershell
node --test scripts/weekly-contact.test.mjs scripts/aircall-ledger.test.mjs scripts/aircall-ledger-api.test.mjs
node scripts/aircall-ledger-db-test.mjs
npm run build
```

The database test exercises actual trigger delivery, out-of-order events, transfers, API precision corrections, missing identities, conflicts, and export protection inside a transaction that is rolled back.
