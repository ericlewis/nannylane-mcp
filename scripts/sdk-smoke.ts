#!/usr/bin/env bun

import {
  NannyLaneClient,
  createNannyLaneClient,
  directoryUrl,
  listingProfilePath,
  summarizeMessageThread,
  userIdToPeekabooKey,
} from "nannylane-mcp";

const client = createNannyLaneClient({
  cookie: "a=1",
  locale: "en-us",
  timeoutMs: 1000,
  userAgent: "sdk-smoke",
});

if (!(client instanceof NannyLaneClient)) {
  throw new Error("createNannyLaneClient did not return a NannyLaneClient instance.");
}

const url = directoryUrl({
  locale: "en-us",
  stateSlug: "ga",
  citySlug: "atlanta",
  query: {
    fullTime: true,
  },
}).toString();

if (url !== "https://www.nannylane.com/en-us/find/nanny/ga/atlanta?fullTime=true") {
  throw new Error(`Unexpected directory URL: ${url}`);
}

if (listingProfilePath({ slug: "sample" }, "en-us") !== "/en-us/nanny-listing/sample") {
  throw new Error("listingProfilePath did not build the expected listing path.");
}

if (userIdToPeekabooKey("123") !== "VXNlci0xMjM=") {
  throw new Error("userIdToPeekabooKey returned an unexpected key.");
}

const thread = summarizeMessageThread({
  data: {
    listingWithMessages: {
      id: "listing-1",
      messages: {
        edges: [],
      },
    },
  },
});

if (thread.listingId !== "listing-1" || thread.messages.length !== 0) {
  throw new Error("summarizeMessageThread returned an unexpected summary.");
}

console.log("SDK smoke passed.");
