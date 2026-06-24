# Examples

These examples show tool inputs and expected workflow shape. Exact output depends on the logged-in account and current Nanny Lane data.

## List Conversations

Tool:

```text
nannylane_conversations
```

Input:

```json
{
  "first": 24,
  "requestsOnly": false,
  "archivedOnly": false,
  "hiringStages": []
}
```

Use this to inspect the conversation inbox. Paginate with the `after` cursor returned by Nanny Lane when more results are available.

## Fetch Dashboard Page Data

Tool:

```text
nannylane_next_data
```

Input:

```json
{
  "route": "/dashboard/family/profile"
}
```

The server discovers the current Next.js build id unless `NANNYLANE_BUILD_ID` or `buildId` is provided.

## Find Nannies In Atlanta

Tool:

```text
nannylane_find_nannies
```

Input:

```json
{
  "citySlug": "atlanta",
  "stateSlug": "ga",
  "first": 10
}
```

Review the returned `listingUrl`, `displayName`, `rate`, `availability`, and `summary` before taking action. The returned `listingId` is used by the message tools.

## Read A Listing's Messages

Tool:

```text
nannylane_messages
```

Input:

```json
{
  "listingId": "listing-id-from-find-nannies"
}
```

This is read-only. Use it to check whether a thread already exists and whether the account has a current `userListingInterest` for the listing.

## Prepare A Message Without Sending

Tool:

```text
nannylane_send_message
```

Input:

```json
{
  "listingId": "listing-id-from-find-nannies",
  "text": "Hi, I saw your profile and would like to learn more about your availability.",
  "dryRun": true
}
```

Expected behavior:

- No network mutation is sent.
- The tool returns the GraphQL operation name and variables that would be sent.
- You can review the exact message body before deciding whether to send.

## Send A Message

Tool:

```text
nannylane_send_message
```

Input:

```json
{
  "listingId": "listing-id-from-find-nannies",
  "text": "Hi, I saw your profile and would like to learn more about your availability.",
  "dryRun": false
}
```

Use this only after reviewing:

- the profile or listing URL
- the exact recipient context
- the exact message text
- account plan or messaging restrictions

Nanny Lane may reject the mutation if messaging requires an upgrade, the listing is unavailable, or validation fails.

## Inspect Plans

Tool:

```text
nannylane_plans
```

Input:

```json
{}
```

This fetches the authenticated family plans page data. Use the live site for purchases or account changes; this server only reads the plan data route.
