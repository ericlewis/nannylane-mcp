export {
  defaultCookieFile,
  loadConfig,
  type NannyLaneConfig,
} from "./config";

export {
  buildCookieHeader,
  cookieHeaderFromBrowser,
  cookiesFromBrowser,
  defaultCookieDbPath,
  defaultCookieDbPaths,
  defaultSafariCookiePaths,
  normalizeBrowserName,
  type BrowserCookie,
  type BrowserCookieOptions,
  type SupportedBrowser,
} from "./browser-cookies";

export {
  API_ORIGIN,
  CONVERSATIONS_PAGE_LISTINGS_HASH,
  NannyLaneClient,
  NannyLaneRequestError,
  NannyLaneUnexpectedResponseError,
  PEEKABOO_ORIGIN,
  WWW_ORIGIN,
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
  type BucketingOptions,
  type ConversationFilters,
  type ConversationSummary,
  type ConversationsOptions,
  type GraphqlOptions,
  type ListingProfileOptions,
  type MessageThreadSummary,
  type NannyLaneAccessIssue,
  type NannyListingProfile,
  type NannyListingSummary,
  type NannySearchOptions,
  type NextDataOptions,
  type PersistedQueryOptions,
  type QueryParams,
  type SendMessageOptions,
} from "./nannylane";

import { loadConfig, type NannyLaneConfig } from "./config";
import { NannyLaneClient } from "./nannylane";

export function createNannyLaneClient(config: NannyLaneConfig = loadConfig()): NannyLaneClient {
  return new NannyLaneClient(config);
}
