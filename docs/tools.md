# Tool Reference

All tools return JSON as MCP text content. Outputs may contain personal data from Nanny Lane. Review before sharing logs or transcripts.

## `nannylane_conversations`

Lists dashboard conversations using Nanny Lane's `ConversationsPageListings` persisted GraphQL query.

Inputs:

```json
{
  "first": 24,
  "after": "optional cursor",
  "requestsOnly": false,
  "archivedOnly": false,
  "hiringStages": []
}
```

Notes:

- Requires authentication.
- Uses the captured persisted query hash in `src/nannylane.ts`.
- Useful for conversation inbox views and pagination.

## `nannylane_next_data`

Fetches a Next.js data route from `www.nannylane.com`.

Inputs:

```json
{
  "route": "/dashboard/conversations",
  "buildId": "optional Next.js build id"
}
```

Notes:

- `route` may include or omit the locale prefix.
- If `buildId` is absent, the client uses `NANNYLANE_BUILD_ID` or discovers it from dashboard HTML.
- A stale build id usually shows up as an HTML response or 404. Remove `NANNYLANE_BUILD_ID` to let the client rediscover it.

## `nannylane_dashboard_page_data`

Alias around the SDK `dashboardPageData()` helper.

Inputs:

```json
{
  "route": "/dashboard/family/profile"
}
```

Use this when you want dashboard page data but do not need to think about Next.js build-id mechanics.

## `nannylane_conversations_page_data`

Convenience wrapper for:

```text
/dashboard/conversations
```

Inputs: none.

## `nannylane_family_profile_page_data`

Convenience wrapper for:

```text
/dashboard/family/profile
```

Inputs: none.

## `nannylane_inbox_summary`

Returns normalized conversation summaries instead of raw GraphQL payloads.

Inputs:

```json
{
  "first": 24,
  "after": "optional cursor",
  "requestsOnly": false,
  "archivedOnly": false,
  "hiringStages": []
}
```

Output includes best-effort fields such as conversation id, listing id, display name, last message text/time, hiring stage, unread state, and the raw conversation node.

## `nannylane_persisted_graphql`

Calls an Apollo persisted GraphQL query on `api.nannylane.com`.

Inputs:

```json
{
  "operationName": "OperationName",
  "sha256Hash": "64-character-hex-hash",
  "variables": {}
}
```

Use this when a Nanny Lane page uses a persisted query and you know the operation name, variables, and hash.

## `nannylane_graphql`

Calls `api.nannylane.com/graphql` with a supplied GraphQL document.

Inputs:

```json
{
  "operationName": "OptionalOperationName",
  "variables": {},
  "query": "query OptionalOperationName { ... }",
  "allowMutation": false
}
```

Safety behavior:

- Query operations run directly.
- Mutation documents return a dry-run response unless `allowMutation: true`.
- Prefer dedicated tools such as `nannylane_send_message` when available because they have narrower guardrails.

## `nannylane_peekaboo_bucketing`

Calls the captured Peekaboo feature-bucketing endpoint.

Inputs:

```json
{
  "sessionId": "optional session id",
  "userId": "optional numeric user id",
  "userKey": "optional encoded user key",
  "pathname": "/en-us/dashboard/conversations",
  "search": ""
}
```

Notes:

- Requires either `sessionId` or `NANNYLANE_PEEKABOO_SESSION_ID`.
- Requires `userId`, `userKey`, `NANNYLANE_USER_ID`, or `NANNYLANE_PEEKABOO_USER_KEY`.
- Most workflows do not need this tool.

## `nannylane_directory_page_data`

Fetches raw Next.js page data from a public nanny directory page.

Inputs:

```json
{
  "citySlug": "atlanta",
  "stateSlug": "ga",
  "query": {}
}
```

Use this as an SDK escape hatch when normalized `nannylane_find_nannies` omits fields you need.

## `nannylane_find_nannies`

Reads Nanny Lane directory listings for a city and returns normalized summaries.

Inputs:

```json
{
  "citySlug": "atlanta",
  "stateSlug": "ga",
  "first": 9,
  "query": {}
}
```

Output shape:

```json
[
  {
    "rank": 1,
    "listingId": "opaque listing id",
    "profileId": "opaque profile id",
    "displayName": "Name",
    "cityState": "Atlanta, GA",
    "rate": "$20/hr",
    "experience": 6,
    "availability": ["full-time"],
    "credentials": ["CPR", "first aid"],
    "languages": ["ENG"],
    "ageGroups": ["INFANT", "TODDLER"],
    "summary": "Profile summary...",
    "listingPath": "/en-us/nanny-listing/example",
    "listingUrl": "https://www.nannylane.com/en-us/nanny-listing/example"
  }
]
```

Notes:

- Defaults to Atlanta, GA because that was the first target workflow.
- Uses public directory page data, but still sends the authenticated cookie when available.
- `listingId` is the id required by message-related tools.
- `listingUrl` is the safest field to open in a browser when reviewing the profile manually.
- `query` is passed through to the directory URL for observed filter parameters.

## `nannylane_listing_profile`

Fetches and normalizes a nanny listing page by slug, path, or URL.

Inputs:

```json
{
  "slug": "example-slug",
  "includeRaw": false
}
```

Alternative inputs:

```json
{
  "path": "/en-us/nanny-listing/example-slug"
}
```

or:

```json
{
  "url": "https://www.nannylane.com/en-us/nanny-listing/example-slug"
}
```

Set `includeRaw: true` to include the extracted listing object from the page payload.

If Nanny Lane redirects the page or omits listing data, the tool returns the requested URL, final URL, `redirected`, `note`, and `accessIssue` instead of failing. `accessIssue` includes a stable code and suggested next actions, such as refreshing auth or opening the upgrade URL.

## `nannylane_messages`

Reads the recent message thread for a listing id.

Inputs:

```json
{
  "listingId": "opaque listing id"
}
```

Notes:

- Read-only.
- Returns recent messages and `userListingInterest` if one exists.
- Useful before sending to check whether a conversation already exists.

## `nannylane_message_thread`

Reads the recent message thread for a listing id and returns normalized messages.

Inputs:

```json
{
  "listingId": "opaque listing id"
}
```

Use this when you want a smaller, easier-to-read message shape than `nannylane_messages`.

## `nannylane_send_message`

Prepares or sends a Nanny Lane message.

Inputs:

```json
{
  "listingId": "opaque listing id",
  "text": "Message body",
  "dryRun": true
}
```

Safety behavior:

- `dryRun` defaults to `true`.
- With `dryRun: true`, the tool returns the mutation payload and does not call Nanny Lane.
- With `dryRun: false`, it sends the message to Nanny Lane.

Operational policy:

- Review the exact recipient and exact message body before using `dryRun: false`.
- Keep message bodies free of secrets, payment data, or unnecessary personal information.
- Check `nannylane_messages` first when avoiding duplicate outreach matters.
- If Nanny Lane requires an upgraded plan before messaging, the mutation may return validation errors instead of sending.

## `nannylane_plans`

Fetches the authenticated family plans page data.

Inputs: none.

Use it to inspect subscription state and available plan products for the logged-in account.

## `nannylane_upgrade_url`

Returns the family plans/upgrade URL.

Inputs: none.

Output:

```json
{
  "url": "https://www.nannylane.com/en-us/dashboard/family/plans"
}
```
