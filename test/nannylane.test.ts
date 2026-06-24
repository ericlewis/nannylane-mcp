import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCookieHeader, normalizeBrowserName } from "../src/browser-cookies";
import { defaultCookieFile, loadConfig, type NannyLaneConfig } from "../src/config";
import { normalizeCookieHeader } from "../src/login";
import { NannyLaneClient, NannyLaneUnexpectedResponseError } from "../src/nannylane";
import {
  directoryUrl,
  extractBuildId,
  extractNextData,
  findListingNode,
  listingProfilePath,
  nextDataPath,
  normalizeLocalizedRoute,
  slugFromListingPath,
  summarizeConversations,
  summarizeMessageThread,
  userIdToPeekabooKey,
} from "../src/nannylane";
import { createNannyLaneClient } from "../src/index";

describe("route helpers", () => {
  test("normalizes dashboard routes with locale", () => {
    expect(normalizeLocalizedRoute("/dashboard/conversations", "en-us")).toBe("en-us/dashboard/conversations");
    expect(normalizeLocalizedRoute("/en-us/dashboard/conversations", "en-us")).toBe("en-us/dashboard/conversations");
    expect(normalizeLocalizedRoute("dashboard/family/profile.json", "en-us")).toBe("en-us/dashboard/family/profile");
  });

  test("builds Next.js data paths", () => {
    expect(nextDataPath("BUILD123", "en-us/dashboard/conversations")).toBe(
      "/_next/data/BUILD123/en-us/dashboard/conversations.json",
    );
  });

  test("builds directory URLs with query passthrough", () => {
    expect(
      directoryUrl({
        locale: "en-us",
        stateSlug: "ga",
        citySlug: "atlanta",
        query: {
          page: 2,
          fullTime: true,
          ignored: null,
          ageGroups: ["INFANT", "TODDLER"],
        },
      }).toString(),
    ).toBe("https://www.nannylane.com/en-us/find/nanny/ga/atlanta?page=2&fullTime=true&ageGroups=INFANT&ageGroups=TODDLER");
  });

  test("normalizes listing profile inputs", () => {
    expect(listingProfilePath({ slug: "sample-slug" }, "en-us")).toBe("/en-us/nanny-listing/sample-slug");
    expect(listingProfilePath({ path: "/nanny-listing/sample-slug" }, "en-us")).toBe("/en-us/nanny-listing/sample-slug");
    expect(listingProfilePath({ url: "https://www.nannylane.com/en-us/nanny-listing/sample-slug" }, "en-us")).toBe(
      "/en-us/nanny-listing/sample-slug",
    );
    expect(slugFromListingPath("/en-us/nanny-listing/sample-slug")).toBe("sample-slug");
  });
});

describe("capture helpers", () => {
  test("extracts build id from __NEXT_DATA__", () => {
    expect(extractBuildId('<script id="__NEXT_DATA__" type="application/json">{"buildId":"BUILD123abc"}</script>')).toBe(
      "BUILD123abc",
    );
  });

  test("extracts Next.js payloads", () => {
    expect(extractNextData('<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"ok":true}}}</script>')).toEqual({
      props: { pageProps: { ok: true } },
    });
  });

  test("finds listing nodes inside page payloads", () => {
    expect(
      findListingNode(
        {
          props: {
            pageProps: {
              listing: {
                id: "listing-1",
                slug: "sample-slug",
                displayName: "Sample Nanny",
              },
            },
          },
        },
        "sample-slug",
      ),
    ).toEqual({
      id: "listing-1",
      slug: "sample-slug",
      displayName: "Sample Nanny",
    });
  });

  test("extracts build id from static asset urls", () => {
    expect(extractBuildId('<script src="/_next/static/BUILD123abc/_buildManifest.js"></script>')).toBe(
      "BUILD123abc",
    );
  });

  test("encodes peekaboo user ids", () => {
    expect(userIdToPeekabooKey("123")).toBe("VXNlci0xMjM=");
    expect(userIdToPeekabooKey("User-123")).toBe("VXNlci0xMjM=");
  });
});

describe("login helpers", () => {
  test("normalizes pasted Cookie headers", () => {
    expect(normalizeCookieHeader("Cookie: a=1; b=2")).toBe("a=1; b=2");
    expect(normalizeCookieHeader("-H 'Cookie: a=1; b=2'")).toBe("a=1; b=2");
    expect(normalizeCookieHeader('"a=1; b=2"')).toBe("a=1; b=2");
  });

  test("uses env cookie path before config defaults", () => {
    expect(defaultCookieFile({ NANNYLANE_COOKIE_FILE: "/tmp/nl-cookie" })).toBe("/tmp/nl-cookie");
  });

  test("loads inline cookies before file defaults", () => {
    const config = loadConfig({
      NANNYLANE_COOKIE: "a=1",
      NANNYLANE_COOKIE_FILE: "/tmp/does-not-need-to-exist",
      NANNYLANE_TIMEOUT_MS: "1234",
    });

    expect(config.cookie).toBe("a=1");
    expect(config.timeoutMs).toBe(1234);
  });

  test("loads the default cookie file from HOME", () => {
    const home = mkdtempSync(join(tmpdir(), "nannylane-config-test-"));
    const cookieFile = join(home, ".config", "nannylane-mcp", "cookie");
    try {
      mkdirSync(join(home, ".config", "nannylane-mcp"), { recursive: true });
      writeFileSync(cookieFile, "from-file=1\n");

      expect(loadConfig({ HOME: home }).cookie).toBe("from-file=1");
    } finally {
      rmSync(home, { force: true, recursive: true });
    }
  });

  test("throws when no cookie source exists", () => {
    const home = mkdtempSync(join(tmpdir(), "nannylane-config-test-"));
    try {
      expect(() => loadConfig({ HOME: home })).toThrow("NANNYLANE_COOKIE or NANNYLANE_COOKIE_FILE is required");
    } finally {
      rmSync(home, { force: true, recursive: true });
    }
  });

  test("normalizes supported browser names", () => {
    expect(normalizeBrowserName("Google Chrome")).toBe("chrome");
    expect(normalizeBrowserName("brave-browser")).toBe("brave");
    expect(normalizeBrowserName("msedge")).toBe("edge");
    expect(normalizeBrowserName("safari")).toBe("safari");
  });

  test("builds stable cookie headers from browser cookies", () => {
    expect(
      buildCookieHeader([
        { host: ".nannylane.com", name: "b", value: "2", path: "/", secure: true, httpOnly: false },
        { host: ".nannylane.com", name: "a", value: "1", path: "/", secure: true, httpOnly: false },
      ]),
    ).toBe("a=1; b=2");
  });
});

describe("message sending guardrails", () => {
  test("defaults sendMessage to dry-run without calling fetch", async () => {
    const client = new NannyLaneClient(testConfig(), (() => {
      throw new Error("fetch should not be called for dry-run messages");
    }) as unknown as typeof fetch);

    await expect(client.sendMessage({ listingId: "listing-1", text: "  Hello there  " })).resolves.toEqual({
      dryRun: true,
      operationName: "SendMessageMutation",
      variables: {
        input: {
          listingId: "listing-1",
          text: "Hello there",
        },
      },
      note: "No message was sent. Call with dryRun=false only after approving the exact recipient and text.",
    });
  });

  test("rejects empty message text before network calls", async () => {
    const client = new NannyLaneClient(testConfig(), (() => {
      throw new Error("fetch should not be called for invalid messages");
    }) as unknown as typeof fetch);

    await expect(client.sendMessage({ listingId: "listing-1", text: "   ", dryRun: false })).rejects.toThrow(
      "Message text is required.",
    );
  });
});

describe("SDK normalizers", () => {
  test("summarizes conversation edges", () => {
    expect(
      summarizeConversations({
        data: {
          viewer: {
            conversations: {
              edges: [
                {
                  node: {
                    id: "conversation-1",
                    listing: {
                      id: "listing-1",
                      displayName: "Sample Nanny",
                      userListingInterest: {
                        hiringStage: "INTERVIEWING",
                      },
                    },
                    lastMessage: {
                      text: "Hello",
                      createdAt: "2026-06-23T00:00:00Z",
                    },
                    unread: true,
                  },
                },
              ],
            },
          },
        },
      }),
    ).toEqual([
      {
        rank: 1,
        id: "conversation-1",
        listingId: "listing-1",
        displayName: "Sample Nanny",
        lastMessageText: "Hello",
        lastMessageAt: "2026-06-23T00:00:00Z",
        hiringStage: "INTERVIEWING",
        unread: true,
        raw: {
          id: "conversation-1",
          listing: {
            id: "listing-1",
            displayName: "Sample Nanny",
            userListingInterest: {
              hiringStage: "INTERVIEWING",
            },
          },
          lastMessage: {
            text: "Hello",
            createdAt: "2026-06-23T00:00:00Z",
          },
          unread: true,
        },
      },
    ]);
  });

  test("summarizes message threads", () => {
    expect(
      summarizeMessageThread({
        data: {
          listingWithMessages: {
            id: "listing-1",
            userListingInterest: {
              hiringStage: "MESSAGING",
            },
            messages: {
              pageInfo: {
                hasPreviousPage: false,
              },
              edges: [
                {
                  node: {
                    id: "message-1",
                    text: "Hello",
                    createdAt: "2026-06-23T00:00:00Z",
                    contentType: "TEXT",
                    sender: {
                      id: "user-1",
                      profile: {
                        displayName: "Sample Sender",
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      }),
    ).toMatchObject({
      listingId: "listing-1",
      userListingInterest: {
        hiringStage: "MESSAGING",
      },
      pageInfo: {
        hasPreviousPage: false,
      },
      messages: [
        {
          id: "message-1",
          text: "Hello",
          createdAt: "2026-06-23T00:00:00Z",
          contentType: "TEXT",
          senderId: "user-1",
          senderName: "Sample Sender",
        },
      ],
    });
  });

  test("creates SDK clients from explicit config", () => {
    expect(createNannyLaneClient(testConfig())).toBeInstanceOf(NannyLaneClient);
  });
});

describe("SDK client methods", () => {
  test("posts raw GraphQL documents", async () => {
    let seenInput: string | URL | Request | undefined;
    let seenInit: RequestInit | undefined;
    const client = new NannyLaneClient(testConfig(), (async (input: string | URL | Request, init?: RequestInit) => {
      seenInput = input;
      seenInit = init;
      return new Response(JSON.stringify({ data: { ok: true } }), {
        headers: {
          "content-type": "application/json",
        },
      });
    }) as unknown as typeof fetch);

    await expect(
      client.graphqlQuery({
        operationName: "TestQuery",
        variables: {
          id: "1",
        },
        query: "query TestQuery($id: ID!) { node(id: $id) { id } }",
      }),
    ).resolves.toEqual({ data: { ok: true } });

    expect(String(seenInput)).toBe("https://api.nannylane.com/graphql");
    expect(JSON.parse(String(seenInit?.body))).toEqual({
      operationName: "TestQuery",
      variables: {
        id: "1",
      },
      query: "query TestQuery($id: ID!) { node(id: $id) { id } }",
    });
  });

  test("returns listing profile fallback when page payload has no listing", async () => {
    const client = new NannyLaneClient(testConfig(), (async () =>
      new Response('<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"viewer":{}}}}</script>', {
        headers: {
          "content-type": "text/html",
        },
      })) as unknown as typeof fetch);

    await expect(client.listingProfile({ slug: "sample-slug", includeRaw: true })).resolves.toMatchObject({
      listingPath: "/en-us/nanny-listing/sample-slug",
      listingUrl: "https://www.nannylane.com/en-us/nanny-listing/sample-slug",
      redirected: true,
      accessIssue: {
        code: "listing_payload_missing",
        message: "The page loaded, but it did not expose a listing object in the observed Next.js payload.",
        requestedUrl: "https://www.nannylane.com/en-us/nanny-listing/sample-slug",
        upgradeUrl: "https://www.nannylane.com/en-us/dashboard/family/plans",
        suggestedActions: [
          "Open finalUrl in the browser.",
          "If finalUrl is an upgrade or dashboard page, inspect nannylane_plans.",
          "If this is still a listing page, use includeRaw=true and inspect raw page data.",
        ],
      },
      raw: {
        props: {
          pageProps: {
            viewer: {},
          },
        },
      },
      note: "The page loaded, but it did not expose a listing object in the observed Next.js payload.",
    });
  });

  test("throws structured JSON response errors with hints", async () => {
    const client = new NannyLaneClient(testConfig(), (async () =>
      new Response("<html>login</html>", {
        headers: {
          "content-type": "text/html",
        },
      })) as unknown as typeof fetch);

    try {
      await client.nextData({ route: "/dashboard/family/profile", buildId: "BUILD123" });
      throw new Error("expected nextData to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(NannyLaneUnexpectedResponseError);
      expect((error as NannyLaneUnexpectedResponseError).details).toMatchObject({
        contentType: "text/html",
        bodySnippet: "<html>login</html>",
        hint: "Nanny Lane returned HTML instead of JSON. This often means a redirect, Cloudflare challenge, stale build id, or expired auth.",
      });
    }
  });
});

function testConfig(): NannyLaneConfig {
  return {
    cookie: "a=1",
    locale: "en-us",
    timeoutMs: 1000,
    userAgent: "test-agent",
  };
}
