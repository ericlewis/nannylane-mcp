#!/usr/bin/env bun

const expectedTools = [
  "nannylane_conversations",
  "nannylane_next_data",
  "nannylane_dashboard_page_data",
  "nannylane_conversations_page_data",
  "nannylane_family_profile_page_data",
  "nannylane_inbox_summary",
  "nannylane_persisted_graphql",
  "nannylane_graphql",
  "nannylane_peekaboo_bucketing",
  "nannylane_directory_page_data",
  "nannylane_find_nannies",
  "nannylane_listing_profile",
  "nannylane_messages",
  "nannylane_message_thread",
  "nannylane_send_message",
  "nannylane_plans",
  "nannylane_upgrade_url",
];

const messages = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: {
        name: "nannylane-mcp-smoke",
        version: "0.0.0",
      },
    },
  },
  {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  },
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  },
];

const child = Bun.spawn(["bun", "run", "src/server.ts"], {
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
});

const input = messages.map((message) => JSON.stringify(message)).join("\n") + "\n";
child.stdin.write(input);
child.stdin.end();

const [stdout, stderr, exitCode] = await Promise.all([
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
  child.exited,
]);

if (exitCode !== 0) {
  console.error(stderr || stdout);
  throw new Error(`MCP server exited with code ${exitCode}.`);
}

const responses = stdout
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const initializeResponse = responses.find((response) => response.id === 1);
if (initializeResponse?.result?.serverInfo?.name !== "nannylane-mcp") {
  throw new Error("MCP initialize response did not include serverInfo.name=nannylane-mcp.");
}

const toolsResponse = responses.find((response) => response.id === 2);
const toolNames = toolsResponse?.result?.tools?.map((tool: { name: string }) => tool.name);
if (!Array.isArray(toolNames)) {
  throw new Error("MCP tools/list response did not include a tools array.");
}

const missingTools = expectedTools.filter((toolName) => !toolNames.includes(toolName));
if (missingTools.length) {
  throw new Error(`MCP tools/list is missing expected tools: ${missingTools.join(", ")}`);
}

console.log(`MCP smoke passed with ${toolNames.length} tools.`);
