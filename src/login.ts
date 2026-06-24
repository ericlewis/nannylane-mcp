#!/usr/bin/env bun

import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { cookieHeaderFromBrowser, normalizeBrowserName, type SupportedBrowser } from "./browser-cookies";
import { defaultCookieFile } from "./config";
import { WWW_ORIGIN } from "./nannylane";

const DEFAULT_LOCALE = "en-us";
const LOGIN_PATH = "/login?next=%2Fdashboard%2Ffamily%2Fplans";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15";

type LoginArgs = {
  cookie?: string;
  cookieFile: string;
  locale: string;
  noOpen: boolean;
  validateOnly: boolean;
  cookiesFromBrowser?: SupportedBrowser;
  browserProfile?: string;
  browserCookieDb?: string;
};

if (import.meta.main) {
  await main();
}

export function normalizeCookieHeader(value: string): string {
  let cookie = value.trim();

  const headerMatch = cookie.match(/^-H\s+['"]Cookie:\s*(.+)['"]$/i);
  if (headerMatch) {
    cookie = headerMatch[1].trim();
  }

  cookie = cookie.replace(/^Cookie:\s*/i, "").trim();

  if ((cookie.startsWith("'") && cookie.endsWith("'")) || (cookie.startsWith('"') && cookie.endsWith('"'))) {
    cookie = cookie.slice(1, -1).trim();
  }

  return cookie;
}

async function main(): Promise<void> {
  const args = parseArgs(Bun.argv.slice(2));

  if (!args.noOpen && !args.validateOnly && !args.cookiesFromBrowser) {
    await openLoginPage(args.locale);
  }

  const cookie = normalizeCookieHeader(args.cookie ?? (await resolveCookieInput(args)));
  if (!cookie) {
    throw new Error("No cookie header provided.");
  }

  const validation = await validateCookie(cookie, args.locale);
  if (!validation.ok) {
    throw new Error(`Cookie validation failed: ${validation.reason}`);
  }

  if (args.validateOnly) {
    console.log(`Cookie is valid for ${validation.viewerSummary}.`);
    return;
  }

  writeCookieFile(args.cookieFile, cookie);
  console.log(`Saved Nanny Lane cookie to ${args.cookieFile}`);
  console.log("Use this in your MCP config:");
  console.log(JSON.stringify({ NANNYLANE_COOKIE_FILE: args.cookieFile }, null, 2));
}

function parseArgs(argv: string[]): LoginArgs {
  const args: LoginArgs = {
    cookieFile: defaultCookieFile(),
    locale: process.env.NANNYLANE_LOCALE?.trim() || DEFAULT_LOCALE,
    noOpen: false,
    validateOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--cookie":
        args.cookie = requiredValue(argv, ++index, arg);
        break;
      case "--cookie-file":
        args.cookieFile = requiredValue(argv, ++index, arg);
        break;
      case "--cookies-from-browser":
        args.cookiesFromBrowser = normalizeBrowserName(requiredValue(argv, ++index, arg));
        break;
      case "--browser-profile":
        args.browserProfile = requiredValue(argv, ++index, arg);
        break;
      case "--browser-cookie-db":
        args.browserCookieDb = requiredValue(argv, ++index, arg);
        break;
      case "--locale":
        args.locale = requiredValue(argv, ++index, arg);
        break;
      case "--no-open":
        args.noOpen = true;
        break;
      case "--validate-only":
        args.validateOnly = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

async function promptForCookie(): Promise<string> {
  const readline = createInterface({ input, output });
  try {
    console.log("Log in to Nanny Lane in your browser, then copy the authenticated Cookie header.");
    console.log("Paste the Cookie header here. The input may be visible on screen while you paste.");
    return await readline.question("Cookie header: ");
  } finally {
    readline.close();
  }
}

async function resolveCookieInput(args: LoginArgs): Promise<string> {
  if (args.cookiesFromBrowser) {
    return cookieHeaderFromBrowser({
      browser: args.cookiesFromBrowser,
      profile: args.browserProfile,
      cookieDbPath: args.browserCookieDb,
    });
  }

  return promptForCookie();
}

async function openLoginPage(locale: string): Promise<void> {
  const url = `${WWW_ORIGIN}/${locale}${LOGIN_PATH}`;
  const command = browserOpenCommand(url);
  if (!command) {
    console.log(`Open this URL to log in: ${url}`);
    return;
  }

  try {
    const subprocess = Bun.spawn(command, {
      stderr: "ignore",
      stdout: "ignore",
    });
    subprocess.unref();
  } catch {
    console.log(`Open this URL to log in: ${url}`);
  }
}

function browserOpenCommand(url: string): string[] | undefined {
  switch (process.platform) {
    case "darwin":
      return ["open", url];
    case "win32":
      return ["cmd", "/c", "start", "", url];
    case "linux":
    case "freebsd":
    case "openbsd":
      return ["xdg-open", url];
    default:
      return undefined;
  }
}

async function validateCookie(cookie: string, locale: string): Promise<{ ok: true; viewerSummary: string } | { ok: false; reason: string }> {
  const response = await fetch(`${WWW_ORIGIN}/${locale}/dashboard/recommendations`, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Cookie: cookie,
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    return { ok: false, reason: `Nanny Lane returned HTTP ${response.status}` };
  }

  if (response.url.includes("/login")) {
    return { ok: false, reason: "request was redirected to login" };
  }

  const html = await response.text();
  if (!html.includes('"viewer"') || !html.includes('"user"')) {
    return { ok: false, reason: "dashboard response did not include an authenticated viewer" };
  }

  return { ok: true, viewerSummary: "an authenticated dashboard session" };
}

function writeCookieFile(cookieFile: string, cookie: string): void {
  const directory = dirname(cookieFile);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  writeFileSync(cookieFile, `${cookie}\n`, { mode: 0o600 });
  chmodSync(cookieFile, 0o600);
}

function printHelp(): void {
  console.log(`Nanny Lane MCP login helper

Usage:
  bun run login
  bun run login:chrome
  bun run login:safari
  bun run login -- --cookie "cookie=value; other=value"
  bun run login -- --cookies-from-browser chrome
  bun run login -- --cookie-file ~/.config/nannylane-mcp/cookie

Options:
  --cookie <value>       Use this Cookie header instead of prompting.
  --cookie-file <path>   Destination cookie file. Defaults to NANNYLANE_COOKIE_FILE or ~/.config/nannylane-mcp/cookie.
  --cookies-from-browser <browser>
                         Import Nanny Lane cookies from a local browser. Supports macOS chrome, chromium, brave, edge, safari.
  --browser-profile <name>
                         Browser profile to read. Defaults to Default.
  --browser-cookie-db <path>
                         Explicit Chromium cookies SQLite DB path.
  --locale <locale>      Locale prefix. Defaults to en-us.
  --no-open              Do not open the browser login page.
  --validate-only        Validate the provided cookie without writing it.
`);
}
