# Browser Cookie Import

The login helper can import Nanny Lane cookies from local macOS browsers. This is similar in spirit to tools that reuse browser cookies, but it is intentionally narrow: it filters to `nannylane.com`, validates the resulting session, and writes a single local cookie file for this MCP server.

## Supported Browsers

```text
safari
chrome
chromium
brave
edge
```

Browser import currently targets macOS because Safari stores cookies in Apple's binary cookie format and Chrome-family browsers rely on macOS Keychain secrets for cookie decryption.

## Safari

Command:

```sh
bun run login:safari
```

What happens:

1. The helper checks the standard Safari cookie paths.
2. It reads `Cookies.binarycookies`.
3. It parses cookie pages and records locally.
4. It keeps only cookies whose host matches `nannylane.com` or a subdomain.
5. It builds a `Cookie` header.
6. It validates that header against the authenticated dashboard.
7. It writes the configured cookie file.

Default Safari paths checked:

```text
~/Library/Containers/com.apple.Safari/Data/Library/Cookies/Cookies.binarycookies
~/Library/Cookies/Cookies.binarycookies
```

## Chrome-Family Browsers

Command:

```sh
bun run login:chrome
```

Profile-specific command:

```sh
bun run login -- --cookies-from-browser chrome --browser-profile "Profile 1"
```

What happens:

1. The helper locates Chrome-family profile cookie databases.
2. It copies each SQLite database to a temporary directory before reading.
3. It queries rows where `host_key` matches `nannylane.com`.
4. It reads the browser safe-storage secret from macOS Keychain.
5. It decrypts encrypted cookie values when needed.
6. It builds a `Cookie` header.
7. It validates that header against the authenticated dashboard.
8. It writes the configured cookie file.

Default profile roots:

```text
~/Library/Application Support/Google/Chrome
~/Library/Application Support/Chromium
~/Library/Application Support/BraveSoftware/Brave-Browser
~/Library/Application Support/Microsoft Edge
```

## Explicit Cookie Database

For debugging, pass a specific Chrome-family SQLite database:

```sh
bun run login -- --cookies-from-browser chrome --browser-cookie-db "/path/to/Cookies"
```

This should point at the browser's `Cookies` SQLite database, not at the exported cookie file used by this MCP server.

## Validation

Import alone is not enough. The helper always validates the built header by requesting the logged-in dashboard. A cookie import can fail validation when:

- The browser is logged out.
- The session expired.
- Cloudflare requires a fresh browser challenge.
- The wrong browser profile was selected.
- The cookie store has not flushed recent login state to disk.

Use validate-only mode when testing:

```sh
bun run login -- --cookies-from-browser safari --validate-only
```

## Storage

Successful imports write:

```text
~/.config/nannylane-mcp/cookie
```

with restrictive permissions. Override the destination with:

```sh
bun run login -- --cookies-from-browser safari --cookie-file /private/path/nannylane-cookie
```

## Limitations

- Browser import is local-only and does not bypass site access controls.
- It does not automate login, MFA, payment, or upgrade flows.
- It does not read cookies for unrelated domains.
- It does not guarantee that Nanny Lane will accept the session for every endpoint.
- Chrome-family decryption may break if browser storage formats change.
