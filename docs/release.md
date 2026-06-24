# Release

This project is designed to be easy to run from source and safe to publish as an open-source Bun package.

## Preflight

Run the full release gate:

```sh
bun run check:release
```

This runs:

- unit tests
- TypeScript typecheck
- Markdown link validation
- MCP stdio smoke test
- high-risk secret scan
- package dry-run

Dependency scanning is handled through Dependabot once the repository is on GitHub. `bun pm scan` requires an external Bun security scanner configuration and is not enabled by default.

## Local Auth State

Release commands must not depend on a live Nanny Lane session. The MCP smoke test only initializes the server and lists tools; it does not call Nanny Lane.

Before publishing, check ignored files:

```sh
git status --short --ignored
```

Expected local-only entries may include:

```text
!! node_modules/
```

There should be no staged `.env`, `.cookies/`, `.tmp/`, browser cookie exports, screenshots, or real account fixtures.

## Package Contents

Preview the package:

```sh
bun run pack:dry-run
```

The package should include source, docs, tests, release metadata, and examples. It should not include local auth files, dependency folders, logs, coverage, or generated tarballs.

## Repository Metadata

Before publishing to a registry, set the final GitHub repository URL in `package.json` if the package will be registry-published. Keep placeholder or incorrect repository metadata out of releases.

Useful fields after the repository exists:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<owner>/nannylane-mcp.git"
  },
  "bugs": {
    "url": "https://github.com/<owner>/nannylane-mcp/issues"
  },
  "homepage": "https://github.com/<owner>/nannylane-mcp#readme"
}
```

## Versioning

Update:

- `package.json`
- `CHANGELOG.md`
- MCP server version in `src/server.ts`

Then re-run:

```sh
bun run check:release
```

## Publish

After verifying package contents:

```sh
npm publish --access public
```

This package is Bun-targeted. The command above only publishes the package; users still need Bun to run the shipped TypeScript entrypoints.

## Post-Release Smoke

From a clean directory:

```sh
bunx nannylane-mcp --version
bunx nannylane-mcp-login --help
```

For MCP use, configure the installed `nannylane-mcp` bin or run from a cloned checkout as shown in [MCP Setup](mcp-setup.md).

## Security Review

Before announcing a release:

- Confirm `nannylane_send_message` defaults to `dryRun: true`.
- Confirm no live account data appears in docs, tests, issues, changelog, or release notes.
- Confirm browser-cookie import docs clearly state local-only and account-control expectations.
- Confirm any newly added endpoint is documented in [Endpoint Map](endpoint-map.md).
