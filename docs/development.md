# Development

## Requirements

- Bun 1.3 or newer.
- macOS for browser-cookie import.
- A Nanny Lane account for live endpoint testing.

## Install

```sh
bun install
```

## Scripts

`bun run start`
: Start the MCP server over stdio.

`bun run dev`
: Start the server with Bun watch mode.

`bun run login`
: Prompt for a cookie header, validate it, and write the local cookie file.

`bun run login:safari`
: Import Nanny Lane cookies from Safari.

`bun run login:chrome`
: Import Nanny Lane cookies from Chrome.

`bun test`
: Run unit tests.

`bun run typecheck`
: Run TypeScript without emitting files.

`bun run check`
: Run tests and typecheck.

`bun run check:docs`
: Validate local Markdown links.

`bun run check:secrets`
: Scan tracked source/docs for high-risk captured cookie/session patterns.

`bun run smoke:mcp`
: Start the MCP server over stdio and assert that the expected tool list is returned.

`bun run check:release`
: Run tests, typecheck, docs link validation, MCP smoke, secret scan, and package dry-run.

## Test Philosophy

Tests should use synthetic data. Do not commit real:

- cookie headers
- session ids
- user ids
- listing ids tied to a real account
- profile names from a logged-in account
- conversation text

Current tests cover:

- route normalization
- Next.js payload extraction
- build id extraction
- Peekaboo user-key encoding
- cookie-header normalization
- browser-name normalization
- stable cookie-header construction

## Adding Tools

When adding a tool:

1. Add client behavior to `src/nannylane.ts`.
2. Register the MCP tool in `src/server.ts`.
3. Keep output JSON structured and predictable.
4. Add tests for local parsing or transformation logic.
5. Document the tool in [Tools](tools.md).
6. Mark side effects clearly.

When the tool depends on a newly observed Nanny Lane request, also update [Endpoint Map](endpoint-map.md) with:

- host
- path or GraphQL operation
- auth requirement
- side-effect status
- where the request shape is implemented

## Side-Effect Policy

Read-only tools may call Nanny Lane directly.

External side effects require explicit inputs and conservative defaults. Message sending must keep `dryRun: true` as the default.

## Secret Hygiene

Before sharing or publishing:

```sh
rg "remember_token|cf_clearance|_session_id|__cf_bm|NANNYLANE_COOKIE" -n . -g '!node_modules' -g '!bun.lock'
```

Also check ignored files:

```sh
git status --short --ignored
```

Ignored local auth files should never be staged.

## Documentation Standards

Documentation should be safe to publish. Use synthetic ids, placeholder cookie names, and sanitized endpoint descriptions. Do not paste browser captures, response bodies from real accounts, or exact profile/message content into Markdown.

Every user-facing behavior should be documented in one of these places:

- Setup and auth behavior: [Authentication](authentication.md) or [MCP Setup](mcp-setup.md)
- Tool inputs and side effects: [Tools](tools.md)
- Common workflows: [Examples](examples.md)
- Internal request mapping: [Endpoint Map](endpoint-map.md)
- Failure recovery: [Troubleshooting](troubleshooting.md)

## Release Checklist

1. `bun run check:release`
2. Confirm `.env`, `.env.*`, `.cookies/`, `.tmp/`, `coverage/`, and `dist/` are ignored.
3. Review docs for real account values.
4. Confirm `nannylane_send_message` still defaults to dry-run behavior.
5. Follow [Release](release.md).
