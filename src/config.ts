import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type NannyLaneConfig = {
  cookie: string;
  locale: string;
  buildId?: string;
  peekabooSessionId?: string;
  userId?: string;
  peekabooUserKey?: string;
  timeoutMs: number;
  userAgent: string;
};

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): NannyLaneConfig {
  const cookie = resolveCookie(env);

  if (!cookie) {
    throw new Error(
      "NANNYLANE_COOKIE or NANNYLANE_COOKIE_FILE is required. Run `bun run login` or set an authenticated Cookie header in your MCP client env.",
    );
  }

  return {
    cookie,
    locale: env.NANNYLANE_LOCALE?.trim() || "en-us",
    buildId: emptyToUndefined(env.NANNYLANE_BUILD_ID),
    peekabooSessionId: emptyToUndefined(env.NANNYLANE_PEEKABOO_SESSION_ID),
    userId: emptyToUndefined(env.NANNYLANE_USER_ID),
    peekabooUserKey: emptyToUndefined(env.NANNYLANE_PEEKABOO_USER_KEY),
    timeoutMs: parsePositiveInteger(env.NANNYLANE_TIMEOUT_MS, 20_000),
    userAgent: env.NANNYLANE_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
  };
}

function resolveCookie(env: NodeJS.ProcessEnv): string | undefined {
  const inlineCookie = env.NANNYLANE_COOKIE?.trim();
  if (inlineCookie) {
    return inlineCookie;
  }

  const cookieFile = env.NANNYLANE_COOKIE_FILE?.trim() || defaultCookieFile(env);
  if (!existsSync(cookieFile)) {
    return undefined;
  }

  return readFileSync(cookieFile, "utf8").trim();
}

export function defaultCookieFile(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NANNYLANE_COOKIE_FILE?.trim()) {
    return env.NANNYLANE_COOKIE_FILE.trim();
  }

  const configHome = env.XDG_CONFIG_HOME?.trim() || join(env.HOME || ".", ".config");
  return join(configHome, "nannylane-mcp", "cookie");
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
