# Contributing

This project wraps an unofficial, browser-observed API surface. Contributions should keep the code conservative, local-first, and safe to publish.

## Local Setup

```sh
bun install
cp .env.example .env
```

Use `NANNYLANE_COOKIE_FILE` with a cookie file outside the repository. Do not commit credentials or captured account data.

## Checks

Run these before opening a pull request:

```sh
bun run check
```

Also inspect the worktree:

```sh
git status --short --ignored
rg "remember_token|cf_clearance|_session_id|__cf_bm" -n . -g '!node_modules' -g '!bun.lock'
```

Generic documentation references are fine. Real captured values are not.

## Documentation

Update documentation with behavior changes:

- New or changed tools: `docs/tools.md`
- New endpoint shapes: `docs/endpoint-map.md`
- Auth or browser import changes: `docs/authentication.md` and `docs/browser-cookie-import.md`
- New failure modes: `docs/troubleshooting.md`
- Development or release workflow changes: `docs/development.md`

## Message-Sending Changes

Keep message-sending behavior explicit and reviewable. The public MCP tool should continue to default to `dryRun: true`.

Changes that make external side effects easier to trigger should include tests and documentation explaining the new guardrails.

## Tests And Fixtures

Use synthetic fixtures. Do not commit real account responses, browser captures, profile names, message text, cookies, or user/listing ids tied to real people.
