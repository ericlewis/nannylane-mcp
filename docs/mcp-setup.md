# MCP Setup

This server uses MCP stdio transport. An MCP client launches Bun, Bun runs `src/server.ts`, and JSON-RPC messages flow over standard input/output.

## Source Checkout Config

```json
{
  "command": "bun",
  "args": ["/absolute/path/to/nannylane-mcp/src/server.ts"]
}
```

This works when the cookie file exists at:

```text
~/.config/nannylane-mcp/cookie
```

## Installed Package Config

After installing the package in an environment visible to your MCP client:

```json
{
  "command": "nannylane-mcp"
}
```

If the client cannot find global package bins, use an absolute bin path or the source-checkout config above.

## Custom Cookie File

```json
{
  "command": "bun",
  "args": ["/absolute/path/to/nannylane-mcp/src/server.ts"],
  "env": {
    "NANNYLANE_COOKIE_FILE": "/Users/you/.config/nannylane-mcp/cookie"
  }
}
```

## Inline Cookie

Inline cookies are supported, but they are easier to leak:

```json
{
  "command": "bun",
  "args": ["/absolute/path/to/nannylane-mcp/src/server.ts"],
  "env": {
    "NANNYLANE_COOKIE": "cookie_name=value; another_cookie=value"
  }
}
```

Prefer `NANNYLANE_COOKIE_FILE`.

## Using An Absolute Bun Path

Some desktop MCP clients launch servers with a minimal environment. If `bun` is not on that PATH, find it:

```sh
which bun
```

Then use that path as the command:

```json
{
  "command": "/Users/you/.bun/bin/bun",
  "args": ["/absolute/path/to/nannylane-mcp/src/server.ts"]
}
```

## Server Startup Without Auth

The server intentionally starts without credentials. This lets MCP clients discover tools before setup is complete.

When auth is missing, tool calls that contact Nanny Lane fail with an auth configuration error. This is expected.

## Local Smoke Test

You can manually verify MCP startup:

```sh
printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | bun run src/server.ts
```

You should see `serverInfo.name` set to `nannylane-mcp` and the Nanny Lane tool list.

You can also inspect just the package scripts outside an MCP client:

```sh
bun run check
bun run check:release
bun run start
```

`bun run start` waits for MCP JSON-RPC on standard input, so it appears idle when run directly.

## Common MCP Client Issues

`bun: command not found`
: Use the absolute path to Bun or install Bun in the environment where your MCP client launches servers.

Server exits immediately
: Run `bun run src/server.ts` directly in a terminal to see configuration or TypeScript runtime errors.

Tools list, but calls fail
: Run `bun run login:safari` or `bun run login:chrome`, then retry.

Wrong account
: Browser import uses whichever local browser profile contains matching Nanny Lane cookies. Use `--browser-profile` for Chrome-family browsers, or manually provide a cookie file for a specific account.
