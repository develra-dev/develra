import { createHash, randomUUID } from "node:crypto";

import registryDataJson from "./data/changes.json" with { type: "json" };

const API_VERSION = "v1";
const CHANGE_CACHE_CONTROL = "public, max-age=60";
const STABLE_CACHE_CONTROL = "public, max-age=300";
const MAX_PROVIDER_IDS = 50;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_REQUEST_URL_LENGTH = 8_192;
const PROVIDER_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RFC3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const CURSOR = /^[A-Za-z0-9_-]{1,128}$/u;
const ALLOWED_CHANGE_PARAMETERS = new Set([
  "provider_id",
  "since",
  "cursor",
  "limit",
]);

type Confidence = "confirmed" | "probable" | "possible";
type Severity = "breaking" | "warning" | "informational" | "unknown";

interface RegistryEndpoint {
  readonly method: string;
  readonly host?: string;
  readonly path: string;
}

interface RegistryProvenance {
  readonly kind: "remote";
  readonly source_id: string;
  readonly retrieved_at: string;
  readonly source_url?: string;
  readonly content_hash?: string;
}

export interface PublicRegistryChange {
  readonly id: string;
  readonly provider_id: string;
  readonly observed_at: string;
  readonly effective_at?: string;
  readonly severity: Severity;
  readonly operations: readonly string[];
  readonly endpoints: readonly RegistryEndpoint[];
  readonly summary: string;
  readonly confidence: Confidence;
  readonly provenance: RegistryProvenance;
}

interface RegistryData {
  readonly version: 1;
  readonly changes: readonly PublicRegistryChange[];
}

export interface RegistryRequest {
  readonly url: string;
  readonly headers: {
    get(name: string): string | null;
  };
}

const registryData = registryDataJson as RegistryData;
const changes = [...registryData.changes].sort(
  (left, right) =>
    left.observed_at.localeCompare(right.observed_at) ||
    left.provider_id.localeCompare(right.provider_id) ||
    left.id.localeCompare(right.id),
);

function responseHeaders(
  cacheControl: string,
  etag: string,
  includeContentType = true,
): Record<string, string> {
  return {
    "cache-control": cacheControl,
    ...(includeContentType
      ? { "content-type": "application/json; charset=utf-8" }
      : {}),
    etag,
    "x-content-type-options": "nosniff",
  };
}

function cachedJson(
  request: RegistryRequest,
  payload: unknown,
  cacheControl: string,
): Response {
  const body = JSON.stringify(payload);
  const etag = `"sha256:${createHash("sha256").update(body).digest("hex")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: responseHeaders(cacheControl, etag, false),
    });
  }
  return new Response(body, {
    status: 200,
    headers: responseHeaders(cacheControl, etag),
  });
}

function invalidRequest(request: RegistryRequest, detail: string): Response {
  const url = new URL(request.url);
  return Response.json(
    {
      api_version: API_VERSION,
      type: "https://www.develra.dev/problems/invalid-request",
      title: "Invalid request",
      status: 400,
      detail,
      instance: url.pathname,
      code: "invalid_request",
      request_id: `req_${randomUUID().replaceAll("-", "")}`,
    },
    {
      status: 400,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/problem+json; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

function oneParameter(
  url: URL,
  name: "since" | "cursor" | "limit",
): string | undefined | null {
  const values = url.searchParams.getAll(name);
  return values.length > 1 ? null : values[0];
}

function encodeCursor(offset: number): string {
  return Buffer.from(`v1:${offset}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): number | undefined {
  if (!CURSOR.test(cursor)) return undefined;
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    return undefined;
  }
  const match = /^v1:(0|[1-9]\d{0,9})$/u.exec(decoded);
  if (match?.[1] === undefined) return undefined;
  const offset = Number(match[1]);
  return encodeCursor(offset) === cursor ? offset : undefined;
}

export function capabilitiesResponse(request: RegistryRequest): Response {
  return cachedJson(
    request,
    {
      api_version: API_VERSION,
      data: {
        mode: "remote",
        remote: true,
        provider_state: false,
        changes: true,
      },
    },
    STABLE_CACHE_CONTROL,
  );
}

export function changesResponse(request: RegistryRequest): Response {
  if (request.url.length > MAX_REQUEST_URL_LENGTH) {
    return invalidRequest(request, "The request URL is too long.");
  }
  const url = new URL(request.url);
  if (
    [...url.searchParams.keys()].some(
      (parameter) => !ALLOWED_CHANGE_PARAMETERS.has(parameter),
    )
  ) {
    return invalidRequest(request, "The query contains an unknown parameter.");
  }

  const providerIds = url.searchParams.getAll("provider_id");
  const uniqueProviderIds = new Set(providerIds);
  if (
    providerIds.length === 0 ||
    providerIds.length > MAX_PROVIDER_IDS ||
    uniqueProviderIds.size !== providerIds.length ||
    providerIds.some(
      (providerId) => providerId.length > 128 || !PROVIDER_ID.test(providerId),
    )
  ) {
    return invalidRequest(
      request,
      "Provide between 1 and 50 unique, valid provider_id parameters.",
    );
  }

  const since = oneParameter(url, "since");
  if (
    since === null ||
    (since !== undefined &&
      (!RFC3339.test(since) || Number.isNaN(Date.parse(since))))
  ) {
    return invalidRequest(request, "The since parameter must be RFC 3339.");
  }

  const requestedLimit = oneParameter(url, "limit");
  if (
    requestedLimit === null ||
    (requestedLimit !== undefined && !/^[1-9]\d{0,2}$/u.test(requestedLimit))
  ) {
    return invalidRequest(request, "The limit parameter is invalid.");
  }
  const limit =
    requestedLimit === undefined ? DEFAULT_PAGE_SIZE : Number(requestedLimit);
  if (limit > MAX_PAGE_SIZE) {
    return invalidRequest(request, "The limit parameter must not exceed 100.");
  }

  const requestedCursor = oneParameter(url, "cursor");
  if (requestedCursor === null) {
    return invalidRequest(request, "Only one cursor parameter is allowed.");
  }
  const offset =
    requestedCursor === undefined ? 0 : decodeCursor(requestedCursor);
  if (offset === undefined) {
    return invalidRequest(request, "The cursor parameter is invalid.");
  }

  const sinceTimestamp = since === undefined ? undefined : Date.parse(since);
  const filtered = changes.filter(
    (change) =>
      uniqueProviderIds.has(change.provider_id) &&
      (sinceTimestamp === undefined ||
        Date.parse(change.observed_at) > sinceTimestamp),
  );
  if (offset > filtered.length) {
    return invalidRequest(request, "The cursor parameter is out of range.");
  }

  const end = Math.min(offset + limit, filtered.length);
  return cachedJson(
    request,
    {
      api_version: API_VERSION,
      data: filtered.slice(offset, end),
      page: {
        next_cursor: end < filtered.length ? encodeCursor(end) : null,
      },
    },
    CHANGE_CACHE_CONTROL,
  );
}
