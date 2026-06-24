import { Database } from "bun:sqlite";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createDecipheriv, pbkdf2Sync } from "node:crypto";

export type SupportedBrowser = "chrome" | "chromium" | "brave" | "edge" | "safari";

export type BrowserCookieOptions = {
  browser: SupportedBrowser;
  profile?: string;
  cookieDbPath?: string;
  domain?: string;
};

export type BrowserCookie = {
  host: string;
  name: string;
  value: string;
  path: string;
  expiresUtc?: number;
  secure: boolean;
  httpOnly: boolean;
};

type BrowserConfig = {
  appSupportPath: string;
  keychainService: string;
};

const CHROMIUM_BROWSER_CONFIGS: Record<Exclude<SupportedBrowser, "safari">, BrowserConfig> = {
  chrome: {
    appSupportPath: "Google/Chrome",
    keychainService: "Chrome Safe Storage",
  },
  chromium: {
    appSupportPath: "Chromium",
    keychainService: "Chromium Safe Storage",
  },
  brave: {
    appSupportPath: "BraveSoftware/Brave-Browser",
    keychainService: "Brave Safe Storage",
  },
  edge: {
    appSupportPath: "Microsoft Edge",
    keychainService: "Microsoft Edge Safe Storage",
  },
};

const DEFAULT_PROFILE = "Default";
const DEFAULT_DOMAIN = "nannylane.com";

export function normalizeBrowserName(value: string): SupportedBrowser {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "chrome":
    case "google-chrome":
    case "google chrome":
      return "chrome";
    case "chromium":
      return "chromium";
    case "brave":
    case "brave-browser":
    case "brave browser":
      return "brave";
    case "edge":
    case "msedge":
    case "microsoft-edge":
    case "microsoft edge":
      return "edge";
    case "safari":
      return "safari";
    default:
      throw new Error(`Unsupported browser "${value}". Supported browsers: chrome, chromium, brave, edge, safari.`);
  }
}

export async function cookieHeaderFromBrowser(options: BrowserCookieOptions): Promise<string> {
  const cookies = await cookiesFromBrowser(options);
  const header = buildCookieHeader(cookies);
  if (!header) {
    throw new Error(`No ${options.domain ?? DEFAULT_DOMAIN} cookies were found in ${options.browser}.`);
  }

  return header;
}

export async function cookiesFromBrowser(options: BrowserCookieOptions): Promise<BrowserCookie[]> {
  if (options.browser === "safari") {
    return cookiesFromSafari(options);
  }

  if (process.platform !== "darwin") {
    throw new Error("Browser cookie import currently supports macOS Chrome-family browsers only.");
  }

  const domain = options.domain ?? DEFAULT_DOMAIN;
  const config = CHROMIUM_BROWSER_CONFIGS[options.browser];
  const cookieDbPaths = options.cookieDbPath ? [options.cookieDbPath] : defaultCookieDbPaths(options.browser, options.profile);
  if (!cookieDbPaths.length) {
    throw new Error(`No ${options.browser} cookie databases were found.`);
  }

  const password = readKeychainPassword(config.keychainService);
  const rows = cookieDbPaths.flatMap((cookieDbPath) => readCookieRows(cookieDbPath, domain));

  return rows
    .map((row) => rowToCookie(row, password))
    .filter((cookie): cookie is BrowserCookie => Boolean(cookie?.value));
}

export function defaultCookieDbPath(browser: SupportedBrowser, profile = DEFAULT_PROFILE): string {
  if (browser === "safari") {
    return defaultSafariCookiePaths()[0] ?? join(homedir(), "Library", "Cookies", "Cookies.binarycookies");
  }

  const config = CHROMIUM_BROWSER_CONFIGS[browser];
  return join(homedir(), "Library", "Application Support", config.appSupportPath, profile, "Cookies");
}

export function defaultCookieDbPaths(browser: SupportedBrowser, profile?: string): string[] {
  if (profile) {
    const cookieDbPath = defaultCookieDbPath(browser, profile);
    return existsSync(cookieDbPath) ? [cookieDbPath] : [];
  }

  if (browser === "safari") {
    return defaultSafariCookiePaths();
  }

  const config = CHROMIUM_BROWSER_CONFIGS[browser];
  const browserDirectory = join(homedir(), "Library", "Application Support", config.appSupportPath);
  if (!existsSync(browserDirectory)) {
    return [];
  }

  return readdirSync(browserDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(browserDirectory, entry.name, "Cookies"))
    .filter((cookieDbPath) => existsSync(cookieDbPath));
}

export function defaultSafariCookiePaths(): string[] {
  return [
    join(homedir(), "Library", "Containers", "com.apple.Safari", "Data", "Library", "Cookies", "Cookies.binarycookies"),
    join(homedir(), "Library", "Cookies", "Cookies.binarycookies"),
  ].filter((cookiePath) => existsSync(cookiePath));
}

export function buildCookieHeader(cookies: BrowserCookie[]): string {
  const byName = new Map<string, BrowserCookie>();
  for (const cookie of cookies) {
    byName.set(cookie.name, cookie);
  }

  return [...byName.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

function readCookieRows(cookieDbPath: string, domain: string): Array<Record<string, unknown>> {
  const tempDirectory = mkdtempSync(join(tmpdir(), "nannylane-cookies-"));
  const tempDb = join(tempDirectory, basename(cookieDbPath));

  try {
    copyFileSync(cookieDbPath, tempDb);
    const database = new Database(tempDb, { readonly: true, strict: true });
    try {
      return database
        .query(
          `SELECT host_key, name, value, encrypted_value, path, expires_utc, is_secure, is_httponly
           FROM cookies
           WHERE host_key LIKE ?`,
        )
        .all(`%${domain}`) as Array<Record<string, unknown>>;
    } finally {
      database.close();
    }
  } finally {
    rmSync(tempDirectory, { force: true, recursive: true });
  }
}

function cookiesFromSafari(options: BrowserCookieOptions): BrowserCookie[] {
  if (process.platform !== "darwin") {
    throw new Error("Safari cookie import currently supports macOS only.");
  }

  const domain = options.domain ?? DEFAULT_DOMAIN;
  const cookiePaths = options.cookieDbPath ? [options.cookieDbPath] : defaultSafariCookiePaths();
  if (!cookiePaths.length) {
    throw new Error("Safari cookie database not found.");
  }

  return cookiePaths
    .flatMap((cookiePath) => readSafariBinaryCookies(cookiePath))
    .filter((cookie) => domainMatches(cookie.host, domain));
}

function readSafariBinaryCookies(cookiePath: string): BrowserCookie[] {
  const buffer = readFileSync(cookiePath);
  if (buffer.subarray(0, 4).toString("utf8") !== "cook" || buffer.length < 8) {
    throw new Error(`Not a Safari binary cookie file: ${cookiePath}`);
  }

  const pageCount = buffer.readUInt32BE(4);
  const pageSizesOffset = 8;
  const pagesOffset = pageSizesOffset + pageCount * 4;
  if (buffer.length < pagesOffset) {
    return [];
  }

  const pageSizes = Array.from({ length: pageCount }, (_, index) => buffer.readUInt32BE(pageSizesOffset + index * 4));
  let pageOffset = pagesOffset;
  const cookies: BrowserCookie[] = [];

  for (const pageSize of pageSizes) {
    const page = buffer.subarray(pageOffset, pageOffset + pageSize);
    cookies.push(...readSafariCookiePage(page));
    pageOffset += pageSize;
  }

  return cookies;
}

function readSafariCookiePage(page: Buffer): BrowserCookie[] {
  if (page.length < 8) {
    return [];
  }

  const cookieCount = page.readUInt32LE(4);
  const offsetsOffset = 8;
  const cookies: BrowserCookie[] = [];

  for (let index = 0; index < cookieCount; index += 1) {
    const offsetAddress = offsetsOffset + index * 4;
    if (offsetAddress + 4 > page.length) {
      break;
    }

    const cookieOffset = page.readUInt32LE(offsetAddress);
    const cookie = readSafariCookie(page, cookieOffset);
    if (cookie) {
      cookies.push(cookie);
    }
  }

  return cookies;
}

function readSafariCookie(page: Buffer, cookieOffset: number): BrowserCookie | undefined {
  const headerLength = 48;
  if (cookieOffset + headerLength > page.length) {
    return undefined;
  }

  const size = page.readUInt32LE(cookieOffset);
  if (size <= headerLength || cookieOffset + size > page.length) {
    return undefined;
  }

  const flags = page.readUInt32LE(cookieOffset + 8);
  const urlOffset = page.readUInt32LE(cookieOffset + 16);
  const nameOffset = page.readUInt32LE(cookieOffset + 20);
  const pathOffset = page.readUInt32LE(cookieOffset + 24);
  const valueOffset = page.readUInt32LE(cookieOffset + 28);
  const host = readSafariString(page, cookieOffset, size, urlOffset);
  const name = readSafariString(page, cookieOffset, size, nameOffset);
  const path = readSafariString(page, cookieOffset, size, pathOffset) || "/";
  const value = readSafariString(page, cookieOffset, size, valueOffset);

  if (!host || !name || !value) {
    return undefined;
  }

  return {
    host,
    name,
    value,
    path,
    secure: Boolean(flags & 1),
    httpOnly: Boolean(flags & 4),
  };
}

function readSafariString(page: Buffer, cookieOffset: number, cookieSize: number, stringOffset: number): string | undefined {
  const absoluteOffset = cookieOffset + stringOffset;
  const maxOffset = cookieOffset + cookieSize;
  if (absoluteOffset < cookieOffset || absoluteOffset >= maxOffset || absoluteOffset >= page.length) {
    return undefined;
  }

  let end = absoluteOffset;
  while (end < maxOffset && end < page.length && page[end] !== 0) {
    end += 1;
  }

  return page.subarray(absoluteOffset, end).toString("utf8");
}

function rowToCookie(row: Record<string, unknown>, password: string): BrowserCookie | undefined {
  const host = stringValue(row.host_key);
  const name = stringValue(row.name);
  const plainValue = stringValue(row.value);
  const encryptedValue = bufferValue(row.encrypted_value);
  const path = stringValue(row.path) || "/";

  if (!host || !name) {
    return undefined;
  }

  const value = plainValue || decryptChromeCookie(encryptedValue, password);
  if (!value) {
    return undefined;
  }

  return {
    host,
    name,
    value,
    path,
    expiresUtc: numberValue(row.expires_utc),
    secure: Boolean(numberValue(row.is_secure)),
    httpOnly: Boolean(numberValue(row.is_httponly)),
  };
}

function decryptChromeCookie(encryptedValue: Buffer | undefined, password: string): string | undefined {
  if (!encryptedValue?.length) {
    return undefined;
  }

  const payload =
    encryptedValue.subarray(0, 3).toString("utf8") === "v10" || encryptedValue.subarray(0, 3).toString("utf8") === "v11"
      ? encryptedValue.subarray(3)
      : encryptedValue;
  const key = pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1");
  const iv = Buffer.alloc(16, " ");

  try {
    const decipher = createDecipheriv("aes-128-cbc", key, iv);
    return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
  } catch {
    return undefined;
  }
}

function domainMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function readKeychainPassword(service: string): string {
  const result = Bun.spawnSync(["security", "find-generic-password", "-w", "-s", service], {
    stderr: "pipe",
    stdout: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(`Could not read "${service}" from macOS Keychain. Open the browser once, then try again.`);
  }

  return result.stdout.toString().trim();
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function bufferValue(value: unknown): Buffer | undefined {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  return undefined;
}
