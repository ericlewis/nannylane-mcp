import type { NannyLaneConfig } from "./config";

export const WWW_ORIGIN = "https://www.nannylane.com";
export const API_ORIGIN = "https://api.nannylane.com";
export const PEEKABOO_ORIGIN = "https://peekaboo.nannylane.com";

export const CONVERSATIONS_PAGE_LISTINGS_HASH =
  "40694ea01e9fa4c292cbdabf492c9e410cde3f1a252899b13671f3e4ba41bdc5";

type Fetcher = typeof fetch;

export class NannyLaneRequestError extends Error {
  constructor(
    message: string,
    readonly details: {
      status: number;
      url: string;
      bodySnippet: string;
      hint?: string;
    },
  ) {
    super(message);
    this.name = "NannyLaneRequestError";
  }
}

export class NannyLaneUnexpectedResponseError extends Error {
  constructor(
    message: string,
    readonly details: {
      url: string;
      contentType?: string;
      bodySnippet: string;
      hint?: string;
    },
  ) {
    super(message);
    this.name = "NannyLaneUnexpectedResponseError";
  }
}

export type ConversationFilters = {
  requestsOnly?: boolean;
  archivedOnly?: boolean;
  hiringStages?: string[];
};

export type ConversationsOptions = {
  first?: number;
  after?: string;
  filters?: ConversationFilters;
};

export type PersistedQueryOptions = {
  operationName: string;
  sha256Hash: string;
  variables?: Record<string, unknown>;
};

export type GraphqlOptions = {
  operationName?: string;
  variables?: Record<string, unknown>;
  query: string;
};

export type NextDataOptions = {
  route: string;
  buildId?: string;
};

export type BucketingOptions = {
  sessionId?: string;
  userId?: string;
  userKey?: string;
  pathname?: string;
  search?: string;
};

export type NannySearchOptions = {
  citySlug?: string;
  stateSlug?: string;
  first?: number;
  query?: QueryParams;
};

export type QueryParams = Record<string, string | number | boolean | null | undefined | Array<string | number | boolean>>;

export type NannyListingSummary = {
  rank: number;
  listingId: string;
  profileId?: string;
  displayName?: string;
  cityState?: string;
  rate?: string;
  experience?: number;
  availability: string[];
  credentials: string[];
  languages: string[];
  ageGroups: string[];
  summary?: string;
  listingPath: string;
  listingUrl: string;
};

export type ListingProfileOptions = {
  slug?: string;
  path?: string;
  url?: string;
  includeRaw?: boolean;
};

export type NannyListingProfile = Omit<Partial<NannyListingSummary>, "listingPath" | "listingUrl"> & {
  listingPath: string;
  listingUrl: string;
  finalUrl?: string;
  redirected?: boolean;
  note?: string;
  accessIssue?: NannyLaneAccessIssue;
  raw?: unknown;
};

export type NannyLaneAccessIssue = {
  code:
    | "listing_payload_missing"
    | "next_data_missing"
    | "redirected_to_login"
    | "redirected_to_plans"
    | "redirected_to_dashboard"
    | "redirected";
  message: string;
  requestedUrl: string;
  finalUrl?: string;
  upgradeUrl?: string;
  suggestedActions: string[];
};

export type ConversationSummary = {
  rank: number;
  id?: string;
  listingId?: string;
  displayName?: string;
  lastMessageText?: string;
  lastMessageAt?: string;
  hiringStage?: string;
  unread?: boolean;
  raw?: unknown;
};

export type MessageThreadSummary = {
  listingId?: string;
  userListingInterest?: unknown;
  messages: Array<{
    id?: string;
    text?: string;
    createdAt?: string;
    contentType?: string;
    senderId?: string;
    senderName?: string;
  }>;
  pageInfo?: unknown;
  raw?: unknown;
};

export type SendMessageOptions = {
  listingId: string;
  text: string;
  dryRun?: boolean;
};

export class NannyLaneClient {
  private buildIdCache?: string;

  constructor(
    private readonly config: NannyLaneConfig,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  async conversations(options: ConversationsOptions = {}): Promise<unknown> {
    const variables = {
      first: options.first ?? 24,
      ...(options.after ? { after: options.after } : {}),
      filters: {
        requestsOnly: options.filters?.requestsOnly ?? false,
        archivedOnly: options.filters?.archivedOnly ?? false,
        hiringStages: options.filters?.hiringStages ?? [],
      },
    };

    return this.persistedGraphqlQuery({
      operationName: "ConversationsPageListings",
      sha256Hash: CONVERSATIONS_PAGE_LISTINGS_HASH,
      variables,
    });
  }

  async persistedGraphqlQuery(options: PersistedQueryOptions): Promise<unknown> {
    const url = new URL("/graphql", API_ORIGIN);
    url.searchParams.set("operationName", options.operationName);
    url.searchParams.set("variables", JSON.stringify(options.variables ?? {}));
    url.searchParams.set(
      "extensions",
      JSON.stringify({
        clientLibrary: {
          name: "@apollo/client",
          version: "4.1.6",
        },
        persistedQuery: {
          version: 1,
          sha256Hash: options.sha256Hash,
        },
      }),
    );

    return this.requestJson(url, {
      method: "GET",
      headers: {
        ...this.commonHeaders(),
        Accept: "application/graphql-response+json,application/json;q=0.9",
        "Content-Type": "application/json",
        Origin: WWW_ORIGIN,
        Referer: `${WWW_ORIGIN}/`,
        "apollographql-client-name": "nl-next (Client)",
        "apollographql-client-version": "4.8.19",
        "x-requested-with": "GraphQL",
      },
    });
  }

  async graphqlQuery(options: GraphqlOptions): Promise<unknown> {
    return this.graphql({
      operationName: options.operationName,
      variables: options.variables ?? {},
      query: options.query,
    });
  }

  async conversationsPageData(): Promise<unknown> {
    return this.nextData({ route: "/dashboard/conversations" });
  }

  async familyProfilePageData(): Promise<unknown> {
    return this.nextData({ route: "/dashboard/family/profile" });
  }

  async dashboardPageData(route: string): Promise<unknown> {
    return this.nextData({ route });
  }

  async nextData(options: NextDataOptions): Promise<unknown> {
    const buildId = options.buildId ?? this.config.buildId ?? (await this.discoverBuildId());
    const localizedRoute = normalizeLocalizedRoute(options.route, this.config.locale);
    const url = new URL(nextDataPath(buildId, localizedRoute), WWW_ORIGIN);

    return this.requestJson(url, {
      method: "GET",
      headers: {
        ...this.commonHeaders(),
        Accept: "*/*",
        Referer: `${WWW_ORIGIN}/${localizedRoute}`,
        "x-nextjs-data": "1",
      },
    });
  }

  async discoverBuildId(route = "/dashboard/conversations"): Promise<string> {
    if (this.buildIdCache) {
      return this.buildIdCache;
    }

    const localizedRoute = normalizeLocalizedRoute(route, this.config.locale);
    const response = await this.request(`${WWW_ORIGIN}/${localizedRoute}`, {
      method: "GET",
      headers: {
        ...this.commonHeaders(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: `${WWW_ORIGIN}/`,
      },
    });

    const html = await response.text();
    const buildId = extractBuildId(html);
    if (!buildId) {
      throw new Error("Could not discover Next.js build id. Set NANNYLANE_BUILD_ID from a fresh browser capture.");
    }

    this.buildIdCache = buildId;
    return buildId;
  }

  async bucketing(options: BucketingOptions = {}): Promise<unknown> {
    const sessionId = options.sessionId ?? this.config.peekabooSessionId;
    if (!sessionId) {
      throw new Error("NANNYLANE_PEEKABOO_SESSION_ID or a sessionId argument is required for bucketing.");
    }

    const userKey = options.userKey ?? this.config.peekabooUserKey ?? userIdToPeekabooKey(options.userId ?? this.config.userId);
    if (!userKey) {
      throw new Error("NANNYLANE_USER_ID, NANNYLANE_PEEKABOO_USER_KEY, userId, or userKey is required for bucketing.");
    }

    const pathname = options.pathname ?? `/${this.config.locale}/dashboard/conversations`;
    const search = options.search ?? "";
    const url = new URL(`/bucketing/${encodeURIComponent(userKey)}`, PEEKABOO_ORIGIN);

    return this.requestJson(url, {
      method: "POST",
      headers: {
        ...this.commonHeaders(),
        Accept: "*/*",
        "Content-Type": "application/json",
        Origin: WWW_ORIGIN,
        Referer: `${WWW_ORIGIN}/`,
        "x-domain": "www.nannylane.com",
        "x-host": "www.nannylane.com",
        "x-href": `${WWW_ORIGIN}${pathname}${search}`,
        "x-pathname": pathname,
        "x-search": search,
      },
      body: JSON.stringify({ sessionId }),
    });
  }

  async findNannies(options: NannySearchOptions = {}): Promise<NannyListingSummary[]> {
    const citySlug = options.citySlug ?? "atlanta";
    const stateSlug = (options.stateSlug ?? "ga").toLowerCase();
    const first = options.first ?? 9;
    const url = directoryUrl({ locale: this.config.locale, stateSlug, citySlug, query: options.query });
    const response = await this.request(url, {
      method: "GET",
      headers: {
        ...this.commonHeaders(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: `${WWW_ORIGIN}/`,
      },
    });
    const html = await response.text();
    const nextData = extractNextData(html);
    const edges = nextData?.props?.pageProps?.directoryKeyword?.listings?.edges;

    if (!Array.isArray(edges)) {
      throw new Error("Could not find nanny listings in Nanny Lane directory page data.");
    }

    return edges.slice(0, first).map(({ node }: { node: Record<string, unknown> }, index: number) =>
      summarizeListing(node, index + 1, this.config.locale),
    );
  }

  async directoryPageData(options: NannySearchOptions = {}): Promise<unknown> {
    const citySlug = options.citySlug ?? "atlanta";
    const stateSlug = (options.stateSlug ?? "ga").toLowerCase();
    const url = directoryUrl({ locale: this.config.locale, stateSlug, citySlug, query: options.query });
    const response = await this.request(url, {
      method: "GET",
      headers: {
        ...this.commonHeaders(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: `${WWW_ORIGIN}/`,
      },
    });
    const html = await response.text();
    const nextData = extractNextData(html);
    if (!nextData) {
      throw new Error("Could not extract Next.js data from Nanny Lane directory page.");
    }

    return nextData;
  }

  async listingProfile(options: ListingProfileOptions): Promise<NannyListingProfile> {
    const listingPath = listingProfilePath(options, this.config.locale);
    const requestedUrl = new URL(listingPath, WWW_ORIGIN).toString();
    const response = await this.request(requestedUrl, {
      method: "GET",
      headers: {
        ...this.commonHeaders(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: `${WWW_ORIGIN}/`,
      },
    });
    const html = await response.text();
    const fallback = {
      listingPath,
      listingUrl: requestedUrl,
      finalUrl: response.url,
      redirected: response.url !== requestedUrl,
    };
    const nextData = extractNextData(html);
    if (!nextData) {
      const accessIssue = listingAccessIssue({
        code: "next_data_missing",
        requestedUrl,
        finalUrl: response.url,
        upgradeUrl: this.upgradeUrl(),
      });
      return {
        ...fallback,
        note: accessIssue.message,
        accessIssue,
      };
    }

    const slug = slugFromListingPath(listingPath);
    const listing = findListingNode(nextData, slug);
    if (!listing) {
      const accessIssue = listingAccessIssue({
        requestedUrl,
        finalUrl: response.url,
        upgradeUrl: this.upgradeUrl(),
      });
      return {
        ...fallback,
        ...(options.includeRaw ? { raw: nextData } : {}),
        note: accessIssue.message,
        accessIssue,
      };
    }

    const summary = summarizeListing(listing, 1, this.config.locale);
    return {
      ...summary,
      finalUrl: response.url,
      redirected: response.url !== requestedUrl,
      ...(options.includeRaw ? { raw: listing } : {}),
    };
  }

  async conversationSummaries(options: ConversationsOptions = {}): Promise<ConversationSummary[]> {
    return summarizeConversations(await this.conversations(options));
  }

  async messages(listingId: string): Promise<unknown> {
    const query = `query MessagesQuery($listingId: ID!, $before: String) {
      listingWithMessages: listingById(id: $listingId) {
        id
        __typename
        messages(last: 10, before: $before) {
          __typename
          pageInfo {
            startCursor
            hasPreviousPage
          }
          edges {
            node {
              id
              __typename
              text
              createdAt
              contentType
              sender {
                id
                __typename
                profile {
                  id
                  __typename
                  displayName
                }
              }
            }
          }
        }
        userListingInterest {
          id
          __typename
          hiringStage
        }
      }
    }`;

    return this.graphql({
      operationName: "MessagesQuery",
      variables: { listingId },
      query,
    });
  }

  async messageThread(listingId: string): Promise<MessageThreadSummary> {
    return summarizeMessageThread(await this.messages(listingId));
  }

  async sendMessage(options: SendMessageOptions): Promise<unknown> {
    const text = options.text.trim();
    if (!text) {
      throw new Error("Message text is required.");
    }

    const variables = {
      input: {
        text,
        listingId: options.listingId,
      },
    };

    if (options.dryRun ?? true) {
      return {
        dryRun: true,
        operationName: "SendMessageMutation",
        variables,
        note: "No message was sent. Call with dryRun=false only after approving the exact recipient and text.",
      };
    }

    const mutation = `mutation SendMessageMutation($input: SendMessageInput!) {
      sendMessage(input: $input) {
        message {
          id
          __typename
          text
          createdAt
        }
        listing {
          id
          __typename
          displayName
          userListingInterest {
            id
            __typename
            declinedAt
          }
        }
        errors {
          allFields
          fields {
            name
            error
          }
        }
        __typename
      }
    }`;

    return this.graphql({
      operationName: "SendMessageMutation",
      variables,
      query: mutation,
    });
  }

  async plans(): Promise<unknown> {
    return this.nextData({ route: "/dashboard/family/plans" });
  }

  upgradeUrl(): string {
    return new URL(`/${this.config.locale}/dashboard/family/plans`, WWW_ORIGIN).toString();
  }

  private async graphql(body: Record<string, unknown>): Promise<unknown> {
    return this.requestJson(new URL("/graphql", API_ORIGIN), {
      method: "POST",
      headers: {
        ...this.commonHeaders(),
        Accept: "application/graphql-response+json,application/json;q=0.9",
        "Content-Type": "application/json",
        Origin: WWW_ORIGIN,
        Referer: `${WWW_ORIGIN}/`,
        "apollographql-client-name": "nl-next (Client)",
        "apollographql-client-version": "4.8.19",
        "x-requested-with": "GraphQL",
      },
      body: JSON.stringify(body),
    });
  }

  private async requestJson(input: string | URL, init: RequestInit): Promise<unknown> {
    const response = await this.request(input, init);
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    if (!contentType.includes("json")) {
      const bodySnippet = truncate(text);
      throw new NannyLaneUnexpectedResponseError(`Expected JSON from Nanny Lane, got ${contentType || "unknown content type"}.`, {
        url: response.url || String(input),
        contentType,
        bodySnippet,
        hint: responseHint({ url: response.url || String(input), contentType, bodySnippet }),
      });
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async request(input: string | URL, init: RequestInit): Promise<Response> {
    const response = await this.fetcher(input, {
      ...init,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text();
      const bodySnippet = truncate(body);
      throw new NannyLaneRequestError(`Nanny Lane request failed with HTTP ${response.status}.`, {
        status: response.status,
        url: response.url || String(input),
        bodySnippet,
        hint: responseHint({ url: response.url || String(input), bodySnippet }),
      });
    }

    return response;
  }

  private commonHeaders(): Record<string, string> {
    return {
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Cookie: this.config.cookie,
      Pragma: "no-cache",
      "User-Agent": this.config.userAgent,
    };
  }
}

function listingAccessIssue(options: {
  code?: NannyLaneAccessIssue["code"];
  requestedUrl: string;
  finalUrl?: string;
  upgradeUrl: string;
}): NannyLaneAccessIssue {
  const code = options.code ?? classifyListingAccessIssue(options.finalUrl, options.requestedUrl);
  const base = {
    code,
    requestedUrl: options.requestedUrl,
    finalUrl: options.finalUrl,
    upgradeUrl: options.upgradeUrl,
  };

  switch (code) {
    case "redirected_to_login":
      return {
        ...base,
        message: "Nanny Lane redirected the listing request to login, so the local cookie is probably expired or missing.",
        suggestedActions: ["Run bun run login:safari or bun run login:chrome.", "Open Nanny Lane in the browser and confirm you are logged in."],
      };
    case "redirected_to_plans":
      return {
        ...base,
        message: "Nanny Lane redirected the listing request to the family plans page, so the account may need an upgrade before viewing or messaging this listing.",
        suggestedActions: ["Open the upgradeUrl.", "Call nannylane_plans to inspect available plan data.", "Use nannylane_send_message with dryRun first if testing messaging access."],
      };
    case "redirected_to_dashboard":
      return {
        ...base,
        message: "Nanny Lane redirected the listing request to a dashboard page instead of returning listing data.",
        suggestedActions: ["Open finalUrl in the browser to inspect the account state.", "Refresh auth if the browser is not on the expected page."],
      };
    case "next_data_missing":
      return {
        ...base,
        message: "The listing page response did not include a Next.js data payload.",
        suggestedActions: ["Refresh auth and retry.", "Open finalUrl in the browser to check for a challenge, login page, or plan gate."],
      };
    case "listing_payload_missing":
      return {
        ...base,
        message: "The page loaded, but it did not expose a listing object in the observed Next.js payload.",
        suggestedActions: ["Open finalUrl in the browser.", "If finalUrl is an upgrade or dashboard page, inspect nannylane_plans.", "If this is still a listing page, use includeRaw=true and inspect raw page data."],
      };
    case "redirected":
    default:
      return {
        ...base,
        message: "Nanny Lane redirected the listing request before listing data was available.",
        suggestedActions: ["Open finalUrl in the browser.", "Refresh auth if needed.", "Inspect nannylane_plans if finalUrl is an upgrade page."],
      };
  }
}

function classifyListingAccessIssue(finalUrl: string | undefined, requestedUrl: string): NannyLaneAccessIssue["code"] {
  if (!finalUrl || finalUrl === requestedUrl) {
    return "listing_payload_missing";
  }

  const pathname = safePathname(finalUrl);
  if (pathname?.includes("/login")) {
    return "redirected_to_login";
  }
  if (pathname?.includes("/dashboard/family/plans")) {
    return "redirected_to_plans";
  }
  if (pathname?.includes("/dashboard")) {
    return "redirected_to_dashboard";
  }

  return "redirected";
}

function responseHint(options: { url: string; contentType?: string; bodySnippet?: string }): string | undefined {
  const pathname = safePathname(options.url);
  const snippet = options.bodySnippet ?? "";

  if (pathname?.includes("/login") || snippet.includes("/login")) {
    return "The request appears to have reached a login page. Refresh the cookie with bun run login:safari or bun run login:chrome.";
  }

  if (pathname?.includes("/dashboard/family/plans")) {
    return "The request appears to have reached the plans page. The account may need an upgrade for this action.";
  }

  if ((options.contentType ?? "").includes("text/html")) {
    return "Nanny Lane returned HTML instead of JSON. This often means a redirect, Cloudflare challenge, stale build id, or expired auth.";
  }

  return undefined;
}

function safePathname(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).pathname;
  } catch {
    return undefined;
  }
}

export function directoryUrl(options: {
  locale: string;
  stateSlug: string;
  citySlug: string;
  query?: QueryParams;
}): URL {
  const url = new URL(`/${normalizeLocale(options.locale)}/find/nanny/${options.stateSlug}/${options.citySlug}`, WWW_ORIGIN);
  appendQueryParams(url, options.query);
  return url;
}

export function listingProfilePath(options: ListingProfileOptions, locale: string): string {
  if (options.url) {
    const url = new URL(options.url);
    return normalizeAbsolutePath(url.pathname, locale);
  }

  if (options.path) {
    return normalizeAbsolutePath(options.path, locale);
  }

  if (options.slug) {
    return `/${normalizeLocale(locale)}/nanny-listing/${options.slug.replace(/^\/+/, "")}`;
  }

  throw new Error("listingProfile requires slug, path, or url.");
}

export function normalizeLocalizedRoute(route: string, locale: string): string {
  const trimmedRoute = route.trim().replace(/^\/+/, "").replace(/\.json$/, "");
  const normalizedLocale = locale.trim().replace(/^\/+|\/+$/g, "");

  if (!trimmedRoute) {
    return normalizedLocale;
  }

  if (trimmedRoute === normalizedLocale || trimmedRoute.startsWith(`${normalizedLocale}/`)) {
    return trimmedRoute;
  }

  return `${normalizedLocale}/${trimmedRoute}`;
}

export function summarizeConversations(value: unknown): ConversationSummary[] {
  const edges = findEdges(value, looksLikeConversationNode);
  return edges.map((edge, index) => summarizeConversationNode(edge.node, index + 1));
}

export function summarizeMessageThread(value: unknown): MessageThreadSummary {
  const root = asRecord((asRecord(value)?.data as unknown) ?? value);
  const listing = findObject(root, (record) => "messages" in record && ("listingWithMessages" in (asRecord(value)?.data ?? {}) || "userListingInterest" in record));
  const messagesConnection = asRecord(listing?.messages);
  const edges = Array.isArray(messagesConnection?.edges) ? messagesConnection.edges : [];

  return {
    listingId: asText(listing?.id),
    userListingInterest: listing?.userListingInterest,
    pageInfo: messagesConnection?.pageInfo,
    messages: edges
      .map((edge) => asRecord(asRecord(edge)?.node))
      .filter((node): node is Record<string, unknown> => Boolean(node))
      .map((node) => {
        const sender = asRecord(node.sender);
        const senderProfile = asRecord(sender?.profile);
        return {
          id: asText(node.id),
          text: asText(node.text),
          createdAt: asText(node.createdAt),
          contentType: asText(node.contentType),
          senderId: asText(sender?.id),
          senderName: asText(senderProfile?.displayName),
        };
      }),
    raw: value,
  };
}

export function nextDataPath(buildId: string, localizedRoute: string): string {
  return `/_next/data/${buildId}/${localizedRoute}.json`;
}

export function extractBuildId(html: string): string | undefined {
  return (
    html.match(/"buildId"\s*:\s*"([^"]+)"/)?.[1] ??
    html.match(/\/_next\/static\/([^/"]+)\//)?.[1] ??
    html.match(/\\\/_next\\\/static\\\/([^\\/"]+)\\\//)?.[1]
  );
}

export function userIdToPeekabooKey(userId: string | undefined): string | undefined {
  if (!userId) {
    return undefined;
  }

  const cleanUserId = userId.trim().replace(/^User-/, "");
  return Buffer.from(`User-${cleanUserId}`).toString("base64");
}

export function extractNextData(html: string): Record<string, any> | undefined {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (!match) {
    return undefined;
  }

  return JSON.parse(match[1]);
}

export function findListingNode(value: unknown, slug?: string): Record<string, any> | undefined {
  return findObject(value, (record) => {
    if (slug && record.slug !== slug) {
      return false;
    }

    return typeof record.id === "string" && typeof record.slug === "string" && ("profile" in record || "displayName" in record);
  }) as Record<string, any> | undefined;
}

export function slugFromListingPath(path: string): string | undefined {
  return path.match(/\/nanny-listing\/([^/?#]+)/)?.[1];
}

function summarizeListing(node: Record<string, any>, rank: number, locale: string): NannyListingSummary {
  const profile = node.profile ?? {};
  const address = profile.address ?? {};
  const city = address.city?.name ?? address.city;
  const state = address.state?.slug ?? address.state?.name ?? address.state;
  const listingPath = `/${normalizeLocale(locale)}/nanny-listing/${node.slug}`;

  return {
    rank,
    listingId: node.id,
    profileId: profile.id,
    displayName: asText(node.displayName),
    cityState: [city, state].filter(Boolean).join(", "),
    rate: formatRate(node),
    experience: typeof node.experience === "number" ? node.experience : undefined,
    availability: [
      node.fullTime ? "full-time" : undefined,
      node.partTime ? "part-time" : undefined,
      node.occasionalWork ? "occasional" : undefined,
    ].filter(Boolean) as string[],
    credentials: [
      node.cpr ? "CPR" : undefined,
      node.firstAid ? "first aid" : undefined,
      node.specialNeeds ? "special needs" : undefined,
    ].filter(Boolean) as string[],
    languages: Array.isArray(node.languageCodes) ? node.languageCodes : [],
    ageGroups: Array.isArray(node.experienceChildren)
      ? node.experienceChildren.map((child: Record<string, unknown>) => String(child.ageGroup)).filter(Boolean)
      : [],
    summary: clean(asText(node.redactedDescription)),
    listingPath,
    listingUrl: new URL(listingPath, WWW_ORIGIN).toString(),
  };
}

function summarizeConversationNode(node: Record<string, unknown>, rank: number): ConversationSummary {
  const listing = firstRecord(node, ["listing", "listingWithMessages", "job", "nannyListing"]);
  const profile = firstRecord(node, ["profile", "participantProfile", "otherProfile"]);
  const lastMessage = firstRecord(node, ["lastMessage", "mostRecentMessage", "message"]);
  const userListingInterest = asRecord(node.userListingInterest) ?? asRecord(listing?.userListingInterest);

  return {
    rank,
    id: asText(node.id),
    listingId: asText(listing?.id ?? node.listingId),
    displayName: asText(node.displayName ?? listing?.displayName ?? profile?.displayName),
    lastMessageText: asText(lastMessage?.text ?? node.lastMessageText),
    lastMessageAt: asText(lastMessage?.createdAt ?? node.lastMessageAt),
    hiringStage: asText(userListingInterest?.hiringStage ?? node.hiringStage),
    unread: typeof node.unread === "boolean" ? node.unread : undefined,
    raw: node,
  };
}

function looksLikeConversationNode(node: Record<string, unknown>): boolean {
  return (
    typeof node.id === "string" &&
    ("lastMessage" in node ||
      "mostRecentMessage" in node ||
      "lastMessageText" in node ||
      "userListingInterest" in node ||
      "listing" in node)
  );
}

function findEdges(value: unknown, predicate: (node: Record<string, unknown>) => boolean): Array<{ node: Record<string, unknown> }> {
  const matches: Array<{ node: Record<string, unknown> }> = [];
  visit(value, (candidate) => {
    const record = asRecord(candidate);
    const node = asRecord(record?.node);
    if (node && predicate(node)) {
      matches.push({ node });
    }
  });
  return matches;
}

function findObject(value: unknown, predicate: (record: Record<string, unknown>) => boolean): Record<string, unknown> | undefined {
  let found: Record<string, unknown> | undefined;
  visit(value, (candidate) => {
    if (found) {
      return;
    }

    const record = asRecord(candidate);
    if (record && predicate(record)) {
      found = record;
    }
  });
  return found;
}

function visit(value: unknown, visitor: (value: unknown) => void, seen = new Set<unknown>()): void {
  if (value == null || seen.has(value)) {
    return;
  }

  if (typeof value === "object") {
    seen.add(value);
  }

  visitor(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, visitor, seen);
    }
    return;
  }

  const record = asRecord(value);
  if (!record) {
    return;
  }

  for (const item of Object.values(record)) {
    visit(item, visitor, seen);
  }
}

function appendQueryParams(url: URL, query: QueryParams | undefined): void {
  if (!query) {
    return;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value == null) {
      continue;
    }

    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      url.searchParams.append(key, String(item));
    }
  }
}

function normalizeAbsolutePath(path: string, locale: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath.includes("/nanny-listing/")) {
    return cleanPath.startsWith(`/${normalizeLocale(locale)}/`) ? cleanPath : `/${normalizeLocale(locale)}${cleanPath.replace(/^\/[a-z]{2}-[a-z]{2}/, "")}`;
  }

  return `/${normalizeLocale(locale)}/nanny-listing/${cleanPath.replace(/^\/+/, "")}`;
}

function normalizeLocale(locale: string): string {
  return locale.trim().replace(/^\/+|\/+$/g, "") || "en-us";
}

function firstRecord(source: Record<string, unknown>, keys: string[]): Record<string, unknown> | undefined {
  for (const key of keys) {
    const value = asRecord(source[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, any> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : undefined;
}

function formatRate(node: Record<string, any>): string | undefined {
  if (node.hourlyRateMin && node.hourlyRateMax) {
    return `$${node.hourlyRateMin / 100}-${node.hourlyRateMax / 100}/hr`;
  }
  if (node.hourlyRate) {
    return `$${node.hourlyRate / 100}/hr`;
  }
  if (node.hourlyRateMin) {
    return `$${node.hourlyRateMin / 100}+/hr`;
  }
  if (node.hourlyRateMax) {
    return `up to $${node.hourlyRateMax / 100}/hr`;
  }

  return undefined;
}

function asText(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "plainText", "value", "content", "description"]) {
      if (key in record) {
        return asText(record[key]);
      }
    }

    return Object.values(record).map(asText).filter(Boolean).join(" ");
  }

  return undefined;
}

function clean(value: string | undefined): string | undefined {
  return value?.replace(/\s+/g, " ").trim().slice(0, 280);
}

function truncate(value: string, limit = 700): string {
  const squashed = value.replace(/\s+/g, " ").trim();
  if (squashed.length <= limit) {
    return squashed;
  }

  return `${squashed.slice(0, limit)}...`;
}
