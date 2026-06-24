# Nanny Lane MCP

Unofficial Bun-based MCP server for authenticated Nanny Lane dashboard data.

This project lets an MCP client read Nanny Lane dashboard data, search public nanny directory listings, inspect message threads, fetch plan information, and prepare messages through a local server. Authentication is local-only: the server reads a browser `Cookie` header from environment variables or a private cookie file and never stores credentials in source.

## What This Is

- A local MCP stdio server written in TypeScript and run with Bun.
- A small Nanny Lane API/client wrapper for dashboard, GraphQL, Next.js data, listing, plan, and message endpoints.
- A login helper that can either accept a pasted cookie header or import Nanny Lane cookies from local macOS browsers.
- A safety-first message tool that defaults to dry-run behavior.

## What This Is Not

- Not an official Nanny Lane integration.
- Not an OAuth app.
- Not a credential broker.
- Not a hosted service.
- Not a tool that should be run against accounts you do not control.

## Documentation

- [Authentication](docs/authentication.md): login helper, browser-cookie import, manual cookie setup, and environment variables.
- [Browser Cookie Import](docs/browser-cookie-import.md): how Safari and Chrome-family cookie import work.
- [MCP Setup](docs/mcp-setup.md): how to run the server from MCP clients.
- [Tools](docs/tools.md): complete tool reference with inputs, side effects, and examples.
- [Examples](docs/examples.md): common MCP tool-call workflows.
- [Architecture](docs/architecture.md): project structure, request flow, and design decisions.
- [Endpoint Map](docs/endpoint-map.md): sanitized map of the Nanny Lane endpoints this server wraps.
- [Troubleshooting](docs/troubleshooting.md): common auth, Cloudflare, browser import, and MCP issues.
- [Development](docs/development.md): local checks, repo hygiene, and contribution workflow.
- [Release](docs/release.md): release checklist, package verification, and publishing notes.
- [Security](SECURITY.md): secret handling and side-effect policy.

## Quick Start

Install dependencies:

```sh
bun install
```

Authenticate from Safari on macOS:

```sh
bun run login:safari
```

Or authenticate from Chrome:

```sh
bun run login:chrome
```

The login helper validates the session and writes a private cookie file to:

```text
~/.config/nannylane-mcp/cookie
```

Run the MCP server:

```sh
bun run start
```

Run checks:

```sh
bun run check
```

Run full release checks:

```sh
bun run check:release
```

## MCP Client Config

From a source checkout, use an absolute path to `src/server.ts`:

```json
{
  "command": "bun",
  "args": ["/absolute/path/to/nannylane-mcp/src/server.ts"]
}
```

After package installation, use the shipped bin:

```json
{
  "command": "nannylane-mcp"
}
```

If you use the default login helper path, no environment variables are required. To use a custom cookie file:

```json
{
  "command": "bun",
  "args": ["/absolute/path/to/nannylane-mcp/src/server.ts"],
  "env": {
    "NANNYLANE_COOKIE_FILE": "/Users/you/.config/nannylane-mcp/cookie"
  }
}
```

## Available Tools

- `nannylane_conversations`
- `nannylane_next_data`
- `nannylane_conversations_page_data`
- `nannylane_family_profile_page_data`
- `nannylane_persisted_graphql`
- `nannylane_peekaboo_bucketing`
- `nannylane_find_nannies`
- `nannylane_messages`
- `nannylane_send_message`
- `nannylane_plans`

See [Tools](docs/tools.md) for exact input schemas and behavior.

## Example Workflows

Find public nanny listings in Atlanta:

```json
{
  "citySlug": "atlanta",
  "stateSlug": "ga",
  "first": 10
}
```

Read messages for one listing before deciding whether to send:

```json
{
  "listingId": "listing-id-from-find-nannies"
}
```

Prepare a message without sending it:

```json
{
  "listingId": "listing-id-from-find-nannies",
  "text": "Hi, I saw your profile and would like to learn more about your availability.",
  "dryRun": true
}
```

See [Examples](docs/examples.md) for complete request/response-style workflows.

## Safety Defaults

- Cookie files are expected outside the repository.
- `.env`, `.env.*`, `.cookies/`, `.tmp/`, `coverage/`, and `dist/` are ignored.
- `nannylane_send_message` defaults to `dryRun: true`.
- The server starts without credentials so MCP clients can list tools before auth is configured.
- Credential loading is lazy and happens only when a tool call needs to contact Nanny Lane.

## Open-Source Hygiene

Before publishing a fork or opening a pull request:

```sh
bun run check:release
```

The release check runs tests, typecheck, Markdown link validation, MCP startup smoke, high-risk secret scanning, and a dry-run package build.

## License

MIT. See [LICENSE](LICENSE).
