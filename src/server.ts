#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { loadConfig } from "./config";
import { NannyLaneClient } from "./nannylane";

const VERSION = "0.1.0";

if (Bun.argv.includes("--help") || Bun.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

if (Bun.argv.includes("--version") || Bun.argv.includes("-v")) {
  console.log(VERSION);
  process.exit(0);
}

const server = new McpServer({
  name: "nannylane-mcp",
  version: VERSION,
});

server.registerTool(
  "nannylane_conversations",
  {
    title: "Nanny Lane Conversations",
    description: "List Nanny Lane dashboard conversations using the captured ConversationsPageListings persisted GraphQL query.",
    inputSchema: {
      first: z.number().int().min(1).max(100).default(24),
      after: z.string().optional(),
      requestsOnly: z.boolean().default(false),
      archivedOnly: z.boolean().default(false),
      hiringStages: z.array(z.string()).default([]),
    },
  },
  async ({ first, after, requestsOnly, archivedOnly, hiringStages }) =>
    jsonResult(
      await getClient().conversations({
        first,
        after,
        filters: {
          requestsOnly,
          archivedOnly,
          hiringStages,
        },
      }),
    ),
);

server.registerTool(
  "nannylane_next_data",
  {
    title: "Nanny Lane Next Data",
    description: "Fetch a Nanny Lane dashboard route's Next.js JSON data via /_next/data/{buildId}/...",
    inputSchema: {
      route: z.string().min(1).describe("Route such as /dashboard/conversations or /en-us/dashboard/family/profile."),
      buildId: z.string().optional().describe("Optional Next.js build id. Defaults to env or auto-discovery."),
    },
  },
  async ({ route, buildId }) => jsonResult(await getClient().nextData({ route, buildId })),
);

server.registerTool(
  "nannylane_dashboard_page_data",
  {
    title: "Nanny Lane Dashboard Page Data",
    description: "Fetch a Nanny Lane dashboard route's Next.js JSON data. Alias for the SDK dashboardPageData helper.",
    inputSchema: {
      route: z.string().min(1).describe("Dashboard route such as /dashboard/family/profile."),
    },
  },
  async ({ route }) => jsonResult(await getClient().dashboardPageData(route)),
);

server.registerTool(
  "nannylane_conversations_page_data",
  {
    title: "Nanny Lane Conversations Page Data",
    description: "Fetch Next.js JSON data for /dashboard/conversations.",
    inputSchema: {},
  },
  async () => jsonResult(await getClient().conversationsPageData()),
);

server.registerTool(
  "nannylane_family_profile_page_data",
  {
    title: "Nanny Lane Family Profile Page Data",
    description: "Fetch Next.js JSON data for /dashboard/family/profile.",
    inputSchema: {},
  },
  async () => jsonResult(await getClient().familyProfilePageData()),
);

server.registerTool(
  "nannylane_inbox_summary",
  {
    title: "Nanny Lane Inbox Summary",
    description: "Return normalized conversation summaries from the Nanny Lane inbox.",
    inputSchema: {
      first: z.number().int().min(1).max(100).default(24),
      after: z.string().optional(),
      requestsOnly: z.boolean().default(false),
      archivedOnly: z.boolean().default(false),
      hiringStages: z.array(z.string()).default([]),
    },
  },
  async ({ first, after, requestsOnly, archivedOnly, hiringStages }) =>
    jsonResult(
      await getClient().conversationSummaries({
        first,
        after,
        filters: {
          requestsOnly,
          archivedOnly,
          hiringStages,
        },
      }),
    ),
);

server.registerTool(
  "nannylane_persisted_graphql",
  {
    title: "Nanny Lane Persisted GraphQL",
    description: "Call an Apollo persisted GraphQL query on api.nannylane.com with a supplied operation name, hash, and variables.",
    inputSchema: {
      operationName: z.string().min(1),
      sha256Hash: z.string().regex(/^[a-f0-9]{64}$/i),
      variables: z.record(z.unknown()).default({}),
    },
  },
  async ({ operationName, sha256Hash, variables }) =>
    jsonResult(
      await getClient().persistedGraphqlQuery({
        operationName,
        sha256Hash,
        variables,
      }),
    ),
);

server.registerTool(
  "nannylane_graphql",
  {
    title: "Nanny Lane GraphQL",
    description: "Call api.nannylane.com/graphql with a supplied GraphQL document. Mutations require allowMutation=true.",
    inputSchema: {
      operationName: z.string().optional(),
      variables: z.record(z.unknown()).default({}),
      query: z.string().min(1),
      allowMutation: z.boolean().default(false),
    },
  },
  async ({ operationName, variables, query, allowMutation }) => {
    if (/^\s*mutation\b/i.test(query) && !allowMutation) {
      return jsonResult({
        dryRun: true,
        operationName,
        variables,
        note: "No GraphQL mutation was sent. Call with allowMutation=true only after reviewing the exact operation and variables.",
      });
    }

    return jsonResult(await getClient().graphqlQuery({ operationName, variables, query }));
  },
);

server.registerTool(
  "nannylane_peekaboo_bucketing",
  {
    title: "Nanny Lane Peekaboo Bucketing",
    description: "Call the captured peekaboo.nannylane.com bucketing endpoint for the authenticated user.",
    inputSchema: {
      sessionId: z.string().optional(),
      userId: z.string().optional().describe("Numeric Nanny Lane user id. Encoded as User-{id}."),
      userKey: z.string().optional().describe("Already encoded Peekaboo key."),
      pathname: z.string().default("/en-us/dashboard/conversations"),
      search: z.string().default(""),
    },
  },
  async ({ sessionId, userId, userKey, pathname, search }) =>
    jsonResult(
      await getClient().bucketing({
        sessionId,
        userId,
        userKey,
        pathname,
        search,
      }),
    ),
);

server.registerTool(
  "nannylane_directory_page_data",
  {
    title: "Nanny Lane Directory Page Data",
    description: "Fetch raw Next.js data from a public Nanny Lane nanny directory page.",
    inputSchema: {
      citySlug: z.string().default("atlanta"),
      stateSlug: z.string().default("ga"),
      first: z.number().int().min(1).max(50).default(9).describe("Accepted for parity with find_nannies; raw data is not sliced."),
      query: z.record(z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.union([z.string(), z.number(), z.boolean()]))])).default({}),
    },
  },
  async ({ citySlug, stateSlug, first: _first, query }) => jsonResult(await getClient().directoryPageData({ citySlug, stateSlug, query })),
);

server.registerTool(
  "nannylane_find_nannies",
  {
    title: "Nanny Lane Find Nannies",
    description: "Find nanny listings from a Nanny Lane city directory page, defaulting to Atlanta, GA.",
    inputSchema: {
      citySlug: z.string().default("atlanta"),
      stateSlug: z.string().default("ga"),
      first: z.number().int().min(1).max(50).default(9),
      query: z.record(z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.union([z.string(), z.number(), z.boolean()]))])).default({}),
    },
  },
  async ({ citySlug, stateSlug, first, query }) => jsonResult(await getClient().findNannies({ citySlug, stateSlug, first, query })),
);

server.registerTool(
  "nannylane_listing_profile",
  {
    title: "Nanny Lane Listing Profile",
    description: "Fetch and normalize a Nanny Lane nanny listing page by slug, path, or URL.",
    inputSchema: {
      slug: z.string().optional(),
      path: z.string().optional(),
      url: z.string().url().optional(),
      includeRaw: z.boolean().default(false),
    },
  },
  async ({ slug, path, url, includeRaw }) => jsonResult(await getClient().listingProfile({ slug, path, url, includeRaw })),
);

server.registerTool(
  "nannylane_messages",
  {
    title: "Nanny Lane Messages",
    description: "Read the recent message thread for a listing id without sending anything.",
    inputSchema: {
      listingId: z.string().min(1),
    },
  },
  async ({ listingId }) => jsonResult(await getClient().messages(listingId)),
);

server.registerTool(
  "nannylane_message_thread",
  {
    title: "Nanny Lane Message Thread",
    description: "Read and normalize the recent message thread for a listing id without sending anything.",
    inputSchema: {
      listingId: z.string().min(1),
    },
  },
  async ({ listingId }) => jsonResult(await getClient().messageThread(listingId)),
);

server.registerTool(
  "nannylane_send_message",
  {
    title: "Nanny Lane Send Message",
    description: "Prepare or send a real Nanny Lane message. dryRun defaults to true; set dryRun=false only after approving exact recipients and text.",
    inputSchema: {
      listingId: z.string().min(1),
      text: z.string().min(1),
      dryRun: z.boolean().default(true),
    },
  },
  async ({ listingId, text, dryRun }) => jsonResult(await getClient().sendMessage({ listingId, text, dryRun })),
);

server.registerTool(
  "nannylane_plans",
  {
    title: "Nanny Lane Plans",
    description: "Fetch the authenticated family plans/upgrade page data.",
    inputSchema: {},
  },
  async () => jsonResult(await getClient().plans()),
);

server.registerTool(
  "nannylane_upgrade_url",
  {
    title: "Nanny Lane Upgrade URL",
    description: "Return the authenticated family plans/upgrade URL for opening in a browser.",
    inputSchema: {},
  },
  async () => jsonResult({ url: getClient().upgradeUrl() }),
);

const transport = new StdioServerTransport();
await server.connect(transport);

function getClient(): NannyLaneClient {
  return new NannyLaneClient(loadConfig());
}

function jsonResult(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function printHelp(): void {
  console.log(`nannylane-mcp ${VERSION}

Usage:
  nannylane-mcp
  bun run src/server.ts

Starts the Nanny Lane MCP server over stdio.

Authentication:
  Run nannylane-mcp-login or bun run login to create a local cookie file.
  The server also reads NANNYLANE_COOKIE or NANNYLANE_COOKIE_FILE.

Useful commands:
  nannylane-mcp --version
  nannylane-mcp-login --help
`);
}
