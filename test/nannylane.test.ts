import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCookieHeader, normalizeBrowserName } from "../src/browser-cookies";
import { defaultCookieFile, loadConfig, type NannyLaneConfig } from "../src/config";
import { normalizeCookieHeader } from "../src/login";
import { NannyLaneClient } from "../src/nannylane";
import {
  extractBuildId,
  extractNextData,
  nextDataPath,
  normalizeLocalizedRoute,
  userIdToPeekabooKey,
} from "../src/nannylane";

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

function testConfig(): NannyLaneConfig {
  return {
    cookie: "a=1",
    locale: "en-us",
    timeoutMs: 1000,
    userAgent: "test-agent",
  };
}
