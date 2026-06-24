# Endpoint Map

This map documents the sanitized request shapes implemented by the client. It intentionally omits real cookies, user ids, build ids, listing ids, and response data.

## Dashboard HTML

Host:

```text
www.nannylane.com
```

Routes:

```text
/{locale}/dashboard/recommendations
/{locale}/dashboard/conversations
```

Purpose:

- validate an authenticated cookie
- discover the current Next.js build id

Implementation:

```text
src/login.ts
src/nannylane.ts
```

Side effects: none.

## Next.js Data Routes

Host:

```text
www.nannylane.com
```

Route pattern:

```text
/_next/data/{buildId}/{locale}/{route}.json
```

Wrapped routes:

```text
/dashboard/conversations
/dashboard/family/profile
/dashboard/family/plans
any route passed to dashboardPageData() or nannylane_dashboard_page_data
```

Purpose:

- fetch dashboard page data as JSON
- inspect profile and plan state

Implementation:

```text
NannyLaneClient.nextData()
NannyLaneClient.conversationsPageData()
NannyLaneClient.familyProfilePageData()
NannyLaneClient.plans()
NannyLaneClient.dashboardPageData()
```

Side effects: none.

## Conversations Persisted Query

Host:

```text
api.nannylane.com/graphql
```

Operation:

```text
ConversationsPageListings
```

Purpose:

- list dashboard conversations
- support filters for requests, archived conversations, and hiring stages

Implementation:

```text
NannyLaneClient.conversations()
NannyLaneClient.persistedGraphqlQuery()
```

Side effects: none.

## Generic Persisted GraphQL

Host:

```text
api.nannylane.com/graphql
```

Inputs:

```text
operationName
sha256Hash
variables
```

Purpose:

- call an observed Apollo persisted query when the caller knows its hash

Implementation:

```text
NannyLaneClient.persistedGraphqlQuery()
```

Side effects: depends on the persisted query. Use only known read-only queries unless you have reviewed the operation.

## Generic GraphQL

Host:

```text
api.nannylane.com/graphql
```

Inputs:

```text
operationName
variables
query
```

Purpose:

- expose an SDK escape hatch for observed GraphQL operations
- let MCP callers run query documents directly

Implementation:

```text
NannyLaneClient.graphqlQuery()
nannylane_graphql
```

Side effects: query operations are read-only. Mutations can have side effects. The MCP wrapper refuses mutations unless `allowMutation` is explicitly true.

## Directory Listings

Host:

```text
www.nannylane.com
```

Route pattern:

```text
/{locale}/find/nanny/{stateSlug}/{citySlug}
```

Default:

```text
/en-us/find/nanny/ga/atlanta
```

Purpose:

- read public directory page HTML
- extract `__NEXT_DATA__`
- normalize listing summaries for MCP output
- optionally return raw directory page data

Implementation:

```text
NannyLaneClient.findNannies()
NannyLaneClient.directoryPageData()
```

Side effects: none.

## Listing Profile Pages

Host:

```text
www.nannylane.com
```

Route pattern:

```text
/{locale}/nanny-listing/{slug}
```

Purpose:

- read a public listing page
- extract `__NEXT_DATA__`
- normalize the listing object

Implementation:

```text
NannyLaneClient.listingProfile()
```

Side effects: none.

## Message Thread Query

Host:

```text
api.nannylane.com/graphql
```

Operation:

```text
MessagesQuery
```

Purpose:

- read recent messages for a listing id
- inspect existing `userListingInterest`

Implementation:

```text
NannyLaneClient.messages()
```

Side effects: none.

## Send Message Mutation

Host:

```text
api.nannylane.com/graphql
```

Operation:

```text
SendMessageMutation
```

Purpose:

- send a message to a listing when `dryRun` is explicitly set to `false`

Implementation:

```text
NannyLaneClient.sendMessage()
```

Side effects:

- none with `dryRun: true`
- sends a real Nanny Lane message with `dryRun: false`

Guardrails:

- MCP tool schema defaults `dryRun` to `true`
- client method also treats missing `dryRun` as true
- docs require review of exact recipient and body before live send

## Peekaboo Bucketing

Host:

```text
peekaboo.nannylane.com
```

Route pattern:

```text
/bucketing/{userKey}
```

Purpose:

- reproduce feature-bucketing checks observed in browser traffic

Implementation:

```text
NannyLaneClient.bucketing()
```

Side effects: none expected.

Notes:

- Requires a session id and encoded user key.
- Most workflows do not need this endpoint.
