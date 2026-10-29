# Weekly Sales and Customer Service reports

Both reports follow the supplied Sales PDF sequence: Major Points, treatments, product revenue, seller revenue, six product comparisons, refunds, performance, average ticket, no-show by weekday, no-show by seller, and calls. Existing CS list details follow the shared sections. Lead Management and Customer Care retain their existing views.

## Definitions

- Period: calls and meetings starting Monday-Saturday in America/New_York. HubSpot date-only Paid date properties are compared as calendar dates.
- Revenue: HubSpot deal amounts on Paid date (all pipelines), assigned to the current HubSpot deal owner, including archived-owner lookup and known owner aliases. Associated line items supply product units and product revenue. Other products are included. Deal/line-item differences remain explicitly unallocated rather than being assigned to a product.
- New Treatments: non-repurchase Weight Loss Injection units, including Microdose as confirmed by the user. Repurchases are identified from deal source/imported source and associated contact source. Sales and CS counts are separate; CS sales do not contribute to Sales new treatments.
- Seller average and highest: completed business reporting weeks since September 28, 2026 through the selected week, including zero-sales weeks and excluding future weeks.
- Refunds: same cohort as the existing Refunds dashboard: refund amounts on deals whose Paid date is in the selected week, grouped by HubSpot deal owner. Refund counts count deals with nonzero refund value. This is not a refund-processing-date cash-flow report.
- Performance: injection units sold divided by finalized, answered Aircall calls with more than 60 seconds of connected time, matching Daily. Doxy does not enter this denominator. Agents with no valid calls have an undefined ratio and are excluded from the agent mean.
- Average ticket: agent revenue divided by paid deals with an amount. The Average bar is the mean of defined agent tickets; revenue divided by all paid deals is labelled separately as the team ticket.
- No-show: a canceled/no-show HubSpot outcome or a corresponding meeting title, including Canceled, Cancelled, Cancelado and Cancelada. A meeting is counted once. All scheduled meetings form the denominator. Weekday charts filter the selected team's owners. Unmarked meetings are not assumed to be missed; records with unknown outcomes are flagged.
- Calls: the shared API/webhook ledger for Aircall and the uploaded Weekly meeting history for Doxy. Total and channel bars are separate, not stacked together. Exact HH:MM:SS values and an active-agent average are provided. Combined time remains Pending until Doxy is uploaded.

## Refresh and storage

Weekly snapshots use version 9. Older snapshots are upgraded from HubSpot once. Refresh HubSpot rebuilds sales, meetings, source metrics, and historical seller revenue for the selected and comparison periods. The merge RPC preserves uploaded Doxy data and the other team's upload when refreshing or uploading concurrently. Aircall CSV corrections go directly to the shared ledger.

For a new installation, apply `scripts/create-weekly-report-merge.sql` in addition to the existing weekly/ledger schemas, or use the complete `supabase-schema.sql`. Existing live storage has this function installed. Runtime still uses the existing environment credentials.

Validation:

```powershell
node --test scripts/weekly-summary.test.mjs scripts/weekly-contact.test.mjs scripts/aircall-ledger.test.mjs scripts/aircall-ledger-api.test.mjs
node scripts/weekly-report-db-test.mjs
npm run build
```

The database merge test rolls back its synthetic data. Source audits and reference-PDF renders remain in the ignored migration-backups directory, not in the deployed client.

Revenue by Seller includes total Weight Loss Injection quantities (including repurchases) by seller and team total for last week versus two weeks ago, alongside existing new units and paid deals. Each individual product section also compares product quantities by seller and team total for the same two weeks. Both Sales and Customer Service use these quantity tables.
