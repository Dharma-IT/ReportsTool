# Stripe Dashboard connection on Render

The online connection is separate from the local saved session. Neither
`scripts/stripe-login.mjs`, `scripts/stripe-phones.mjs`, nor `.auth/stripe-profile`
is changed or used by the online service. Localhost retains the original button
and crawler. Render uses `api/_lib/stripe-online.ts` and an independent profile.

## Render setup

Upgrading compute alone does not install Chromium or attach a disk.

1. Provide Chromium and Linux dependencies. `Dockerfile.render` installs the
   browser matching the locked Playwright version. On a Docker Render service,
   set Dockerfile Path to `./Dockerfile.render`. If the existing native Node
   service cannot change runtime, create a Docker service using the same repo
   and environment, then update the frontend's `VITE_API_BASE_URL` and the
   backend's `server.allowedHosts` for its hostname. Keep existing API secrets
   server-side. Do not copy `.env.local` or the local `.auth` directory.
   A native Node deployment can instead be used if its image already supplies
   Playwright's OS dependencies and its build installs Chromium. Verify those
   dependencies on that service before enabling online Stripe.
2. Attach a persistent disk to the service at `/var/data`. A 1 GB disk is a
   starting point; monitor browser-profile growth. Keep one service instance.
3. Set server environment variables:
   - `STRIPE_ONLINE_ENABLED=true`
   - `STRIPE_ONLINE_DATA_DIR=/var/data/stripe-online`
   - `STRIPE_ONLINE_ADMIN_KEY`: the online connection password. Defaults to
     `1234` when unset; an explicit Render value overrides that default.
   Keep the existing `STRIPE_SECRET_KEY` and `HUBSPOT_ACCESS_TOKEN` settings.
4. Deploy the backend and rebuild/deploy the frontend. If Render serves the
   frontend directly, the existing Vite start command serves the updated UI.

## Connect and recover

Open AC Automation on the deployed app and click **Connect Stripe online**.
Enter the administrator key. Click **Open Stripe login**. The embedded image is
a live view of a separate browser running on Render, refreshed every two seconds.
Click a Stripe field in the image, enter its value in the masked text box above,
and click **Send text**. Use Enter, Tab, Select all, Backspace and scroll controls
as needed. Complete MFA in this browser. Device-bound passkeys cannot be forwarded
through screenshots; use an alternative method Stripe offers, such as an
authenticator code. Never disable MFA to make this work.

When the correct account's Dashboard is available, click **Save online session**.
The server verifies access to Payments and closes the browser to flush its
profile before marking it ready. Close the dialog and click **Apply**.

API and HubSpot lookup behavior remains intact. Only unresolved payment phones
are sent to the online crawler. It opens one payment tab at a time and processes
up to three payments per request with a shared 55-second processing deadline.
Recovered phones and unsuccessful attempts are saved to the persistent disk in
`online-phone-progress.json`. The frontend automatically continues with the next
batch while keeping existing rows visible. Successful phones are reused across
requests and restarts, so Apply does not keep starting at the first payment.
Unresolved pages get two attempts, with never-attempted payments checked first;
unsuccessful results can be retried after one hour. Saving a new online Stripe
login clears this cache. Some records may still have no recoverable phone.
Recovery runs inside successive Apply requests, not a background schedule: keep
the page open. If interrupted, another Apply resumes using saved progress. The UI
limits a single run to 100 batches; Apply can continue larger imports.

The online browser is exclusive: while login or a crawl is active, other callers
receive a busy message rather than sharing the browser profile. Interactive login
closes after ten minutes without an input action. Closing the dialog closes the
browser; session files stay on the disk. Expired Stripe logins require reconnecting.
Current status uses a saved marker; each save verifies live Dashboard access, and
the crawler invalidates the marker when redirected to login.

All interactive endpoints require the administrator key in an Authorization
header and POST bodies. The UI keeps the key in memory, clears it on save/close,
and never puts it in a URL or browser storage. Browser images and entered text
are not written to logs. The existing report endpoint retains its existing
access model; this does not add authentication to all reporting routes.

## Verification before regular use

- Confirm local Connect Stripe, its saved profile, and phone recovery still work.
- Connect on Render with MFA and compare known Dashboard-only phone recoveries
  against local output, including the correct Stripe account and live/test mode.
- Restart/redeploy the backend and verify the online session survives on disk.
- Verify expired sessions, simultaneous Apply requests, and interrupted login
  produce useful messages while API/HubSpot contacts still load.
- Monitor Render memory and request duration with real imports.

Cloud Stripe login and bot challenges must be tested on the actual Render service.
Do not treat the paid compute upgrade as proof that Stripe will allow the login.
