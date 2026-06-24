import type { NannyLaneConfig } from "./config";

export const WWW_ORIGIN = "https://www.nannylane.com";
export const API_ORIGIN = "https://api.nannylane.com";
export const PEEKABOO_ORIGIN = "https://peekaboo.nannylane.com";

export const CONVERSATIONS_PAGE_LISTINGS_HASH =
  "40694ea01e9fa4c292cbdabf492c9e410cde3f1a252899b13671f3e4ba41bdc5";

type Fetcher = typeof fetch;

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
};

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

  async conversationsPageData(): Promise<unknown> {
    return this.nextData({ route: "/dashboard/conversations" });
  }

  async familyProfilePageData(): Promise<unknown> {
    return this.nextData({ route: "/dashboard/family/profile" });
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
    const url = new URL(`/${this.config.locale}/find/nanny/${stateSlug}/${citySlug}`, WWW_ORIGIN);
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
      throw new Error(`Expected JSON, got ${contentType || "unknown content type"}: ${truncate(text)}`);
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
      throw new Error(`Nanny Lane request failed with HTTP ${response.status}: ${truncate(body)}`);
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

function summarizeListing(node: Record<string, any>, rank: number, locale: string): NannyListingSummary {
  const profile = node.profile ?? {};
  const address = profile.address ?? {};
  const city = address.city?.name ?? address.city;
  const state = address.state?.slug ?? address.state?.name ?? address.state;
  const listingPath = `/${locale}/nanny-listing/${node.slug}`;

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
