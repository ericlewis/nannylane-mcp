# SDK

The package exposes an importable TypeScript SDK in addition to the MCP stdio server.

This is a Bun-targeted package. The public package export points at TypeScript source files, so consumers should run it in Bun or another environment that can execute TypeScript package entrypoints.

## Entry Point

```ts
import {
  NannyLaneClient,
  createNannyLaneClient,
  loadConfig,
} from "nannylane-mcp";
```

`createNannyLaneClient()` loads the same environment and cookie-file configuration as the MCP server:

```ts
const client = createNannyLaneClient();
```

For explicit configuration:

```ts
const client = new NannyLaneClient({
  cookie: "cookie_name=value",
  locale: "en-us",
  timeoutMs: 20_000,
  userAgent: "my-local-tool",
});
```

## Auth Helpers

```ts
import {
  cookieHeaderFromBrowser,
  defaultCookieFile,
  loadConfig,
} from "nannylane-mcp";
```

Useful helpers:

- `loadConfig()`
- `defaultCookieFile()`
- `cookieHeaderFromBrowser()`
- `cookiesFromBrowser()`
- `buildCookieHeader()`
- `normalizeBrowserName()`

Browser cookie import has the same constraints described in [Browser Cookie Import](browser-cookie-import.md).

## Client Methods

### Dashboard And Next.js Data

```ts
await client.nextData({ route: "/dashboard/family/profile" });
await client.dashboardPageData("/dashboard/family/profile");
await client.conversationsPageData();
await client.familyProfilePageData();
await client.plans();
client.upgradeUrl();
```

`nextData()` discovers the current Next.js build id unless one is provided through config or arguments.

### Conversations

```ts
await client.conversations({
  first: 24,
  filters: {
    requestsOnly: false,
    archivedOnly: false,
    hiringStages: [],
  },
});

await client.conversationSummaries({ first: 24 });
```

`conversations()` returns the raw persisted GraphQL payload. `conversationSummaries()` returns a best-effort normalized array.

### Directory And Listings

```ts
await client.findNannies({
  citySlug: "atlanta",
  stateSlug: "ga",
  first: 10,
});

await client.directoryPageData({
  citySlug: "atlanta",
  stateSlug: "ga",
  query: {
    fullTime: true,
  },
});

await client.listingProfile({
  url: "https://www.nannylane.com/en-us/nanny-listing/example-slug",
});
```

`query` is a passthrough for observed directory URL parameters. The SDK does not claim a stable Nanny Lane filter contract beyond parameters you have verified.

`listingProfile()` returns `finalUrl`, `redirected`, and `note` fields when Nanny Lane redirects the page or omits listing data, which can happen when the account needs an upgrade or the listing is not directly available.

When that happens, it also returns `accessIssue`:

```ts
{
  code: "redirected_to_plans",
  message: "Nanny Lane redirected the listing request to the family plans page...",
  requestedUrl: "https://www.nannylane.com/en-us/nanny-listing/example-slug",
  finalUrl: "https://www.nannylane.com/en-us/dashboard/family/plans",
  upgradeUrl: "https://www.nannylane.com/en-us/dashboard/family/plans",
  suggestedActions: [
    "Open the upgradeUrl.",
    "Call nannylane_plans to inspect available plan data."
  ]
}
```

### Messages

```ts
await client.messages("listing-id");
await client.messageThread("listing-id");

await client.sendMessage({
  listingId: "listing-id",
  text: "Hi, I would like to learn more about your availability.",
  dryRun: true,
});
```

`sendMessage()` defaults to `dryRun: true`. With dry run enabled, no Nanny Lane mutation is sent.

### GraphQL

```ts
await client.persistedGraphqlQuery({
  operationName: "OperationName",
  sha256Hash: "64-character-sha256-hash",
  variables: {},
});

await client.graphqlQuery({
  operationName: "QueryName",
  variables: {},
  query: "query QueryName { viewer { id } }",
});
```

`graphqlQuery()` is a raw SDK escape hatch. It can run mutations if you provide a mutation document. Prefer narrower SDK methods for known side-effecting workflows.

### Peekaboo Bucketing

```ts
await client.bucketing({
  sessionId: "session-id",
  userId: "123",
});
```

Most workflows do not need feature-bucketing calls.

## Pure Helpers

The SDK also exports pure helpers for tests and custom tools:

- `directoryUrl()`
- `listingProfilePath()`
- `slugFromListingPath()`
- `normalizeLocalizedRoute()`
- `nextDataPath()`
- `extractBuildId()`
- `extractNextData()`
- `findListingNode()`
- `summarizeConversations()`
- `summarizeMessageThread()`
- `userIdToPeekabooKey()`

## Guardrails

- Cookies are loaded locally and sent only to Nanny Lane endpoints.
- SDK methods do not bypass account access, site login, Cloudflare, plan restrictions, or endpoint validation.
- Message sending is dry-run by default.
- Raw GraphQL is intentionally powerful. Treat mutation documents as side effects.
- HTTP and unexpected-response failures throw `NannyLaneRequestError` or `NannyLaneUnexpectedResponseError` with structured `details` containing URL, status or content type, a short body snippet, and a hint when available.
