# Authentication

Nanny Lane does not expose OAuth credentials for this project. The server authenticates the same way a logged-in browser does: by sending a `Cookie` header to Nanny Lane.

Treat that cookie header like a password.

## Default Cookie Path

The server automatically checks this file when no cookie environment variable is set:

```text
~/.config/nannylane-mcp/cookie
```

The login helper creates it with restrictive permissions:

```text
directory: 0700
file:      0600
```

## Recommended Login Methods

### Safari Import

Use this when your active Nanny Lane session is in Safari:

```sh
bun run login:safari
```

This reads Safari's binary cookie store, extracts only `nannylane.com` cookies, validates them against the dashboard, and writes the default cookie file.

See [Browser Cookie Import](browser-cookie-import.md) for implementation details and limitations.

### Chrome Import

Use this when your active Nanny Lane session is in Chrome:

```sh
bun run login:chrome
```

This scans local Chrome profiles when no profile is specified. For a specific profile:

```sh
bun run login -- --cookies-from-browser chrome --browser-profile "Profile 1"
```

Chrome-family imports read a copied SQLite cookie database and use macOS Keychain to decrypt cookie values.

Supported browser names:

```sh
chrome
chromium
brave
edge
safari
```

See [Browser Cookie Import](browser-cookie-import.md) for profile discovery, Keychain behavior, and failure modes.

### Manual Paste

Use this when browser import is unavailable:

```sh
bun run login
```

The helper opens the login page, prompts for a cookie header, validates it, and writes the cookie file.

You can also pass the cookie directly:

```sh
bun run login -- --cookie "cookie_name=value; another_cookie=value"
```

Or validate without writing:

```sh
bun run login -- --validate-only --cookie "cookie_name=value; another_cookie=value"
```

## Manual File Creation

If you prefer to create the file yourself:

```sh
mkdir -p ~/.config/nannylane-mcp
chmod 700 ~/.config/nannylane-mcp
printf '%s\n' 'cookie_name=value; another_cookie=value' > ~/.config/nannylane-mcp/cookie
chmod 600 ~/.config/nannylane-mcp/cookie
```

## Environment Variables

`NANNYLANE_COOKIE`
: Inline authenticated cookie header. Convenient, but less safe than a file because env values can appear in process listings, logs, or shell history.

`NANNYLANE_COOKIE_FILE`
: Path to a file containing the cookie header. Recommended for MCP clients.

`NANNYLANE_BUILD_ID`
: Optional Next.js build id. If omitted, the server tries to discover the current id from the dashboard HTML.

`NANNYLANE_PEEKABOO_SESSION_ID`
: Optional session id for the Peekaboo bucketing endpoint.

`NANNYLANE_USER_ID`
: Optional numeric Nanny Lane user id. Used to derive a Peekaboo key when calling the bucketing endpoint.

`NANNYLANE_PEEKABOO_USER_KEY`
: Optional pre-encoded Peekaboo user key.

`NANNYLANE_LOCALE`
: Locale prefix. Defaults to `en-us`.

`NANNYLANE_TIMEOUT_MS`
: Request timeout in milliseconds. Defaults to `20000`.

`NANNYLANE_USER_AGENT`
: Optional user agent override.

## Login CLI Reference

```text
bun run login -- [options]

Options:
  --cookie <value>                Use an explicit Cookie header.
  --cookie-file <path>            Destination cookie file.
  --cookies-from-browser <name>   Import from chrome, chromium, brave, edge, or safari.
  --browser-profile <name>        Chrome-family profile name, for example "Profile 1".
  --browser-cookie-db <path>      Explicit Chrome-family Cookies SQLite database path.
  --locale <locale>               Locale prefix. Defaults to en-us.
  --no-open                       Do not open the Nanny Lane login page.
  --validate-only                 Validate but do not write the cookie file.
```

The helper validates by requesting the authenticated dashboard. It does not send the cookie to any service other than Nanny Lane.

## Auth Resolution Order

The server resolves credentials in this order:

1. `NANNYLANE_COOKIE`
2. `NANNYLANE_COOKIE_FILE`
3. `~/.config/nannylane-mcp/cookie`

If none exists, the MCP server still starts and lists tools. Tool calls that require Nanny Lane network access will return a missing-auth error.

## Refreshing Expired Sessions

Cookies can expire or be invalidated by browser logout, Cloudflare, or normal session rotation. Refresh with:

```sh
bun run login:safari
```

or:

```sh
bun run login:chrome
```

If validation fails, log in to Nanny Lane in the browser first, then retry.
