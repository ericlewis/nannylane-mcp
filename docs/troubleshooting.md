# Troubleshooting

## Auth Errors

### Missing Cookie

Symptom:

```text
NANNYLANE_COOKIE or NANNYLANE_COOKIE_FILE is required
```

Fix:

```sh
bun run login:safari
```

or:

```sh
bun run login:chrome
```

### Cookie Validates, But Tool Calls Fail Later

Cookies can expire or be invalidated. Refresh:

```sh
bun run login:safari
```

If using Chrome:

```sh
bun run login:chrome
```

### Login Helper Opens Browser But You Still Need To Paste Cookies

`bun run login` opens the page and prompts for a cookie header. It does not automate browser devtools.

Use browser import instead:

```sh
bun run login:safari
```

or:

```sh
bun run login:chrome
```

## Browser Import

### Chrome Import Finds No Cookies

Possible causes:

- You are logged in with Safari, not Chrome.
- Nanny Lane is open in another Chrome profile.
- Chrome has not flushed cookies to disk yet.
- The site session expired.

Try:

```sh
bun run login -- --cookies-from-browser chrome --browser-profile "Profile 1"
```

Or use Safari:

```sh
bun run login:safari
```

For deeper browser-import details, see [Browser Cookie Import](browser-cookie-import.md).

### Keychain Prompt Or Failure

Chrome-family imports use macOS Keychain safe-storage secrets. If Keychain access fails:

1. Open the browser once normally.
2. Unlock the macOS login keychain.
3. Retry `bun run login:chrome`.

### Safari Import Fails

Possible causes:

- Safari has no Nanny Lane session.
- Cookies are not present in the expected Safari cookie store.
- The session expired.

Fix:

1. Log in to Nanny Lane in Safari.
2. Retry:

```sh
bun run login:safari
```

## Cloudflare Or HTML Instead Of JSON

Symptom:

```text
Expected JSON, got text/html
```

Likely causes:

- Cloudflare challenge page.
- Expired `cf_clearance`.
- Logged-out redirect.
- Stale Next.js build id.

Fix:

1. Refresh auth with browser import.
2. Open Nanny Lane in the browser and make sure the account is logged in.
3. Retry the tool call.
4. If only `/_next/data` calls fail, unset `NANNYLANE_BUILD_ID` so the server can rediscover it.

SDK callers can catch `NannyLaneUnexpectedResponseError` and inspect `error.details.hint`, `error.details.url`, `error.details.contentType`, and `error.details.bodySnippet`.

## Messaging

### Dry Run Did Not Send

That is expected. `nannylane_send_message` defaults to:

```json
{ "dryRun": true }
```

Set `dryRun: false` only after reviewing the exact recipient and text.

### Real Send Fails

Possible causes:

- Account does not have messaging access.
- Listing id is stale.
- Listing is unavailable.
- Nanny Lane validation rejected the message.

First check:

```text
nannylane_messages
```

Then inspect the mutation result from `nannylane_send_message`.

### Listing Profile Returns An Access Issue

`nannylane_listing_profile` and `client.listingProfile()` intentionally return structured `accessIssue` data when Nanny Lane redirects a profile page or omits listing payload data.

Common codes:

```text
redirected_to_login
redirected_to_plans
redirected_to_dashboard
listing_payload_missing
next_data_missing
```

Use `suggestedActions`, `finalUrl`, and `upgradeUrl` to decide whether to refresh auth, open the page in the browser, or inspect plan data.

## MCP Startup

### Server Lists Tools Without Auth

Expected. Auth loads lazily per tool call.

### MCP Client Cannot Find Bun

Use an absolute Bun path in your MCP config, or ensure Bun is on the PATH used by your MCP client.

### Server Exits In MCP Client

Run directly:

```sh
bun run src/server.ts
```

Then send a `tools/list` smoke request as shown in [MCP Setup](mcp-setup.md).

## Development Checks

Run:

```sh
bun run check
```

Run a secret scan before sharing:

```sh
rg "remember_token|cf_clearance|_session_id|__cf_bm|NANNYLANE_COOKIE" -n . -g '!node_modules' -g '!bun.lock'
```

Expected matches should be generic docs or examples only. Real cookie values should not appear.
