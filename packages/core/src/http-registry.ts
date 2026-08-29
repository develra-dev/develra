import { TextDecoder } from "node:util";

import { DevelraError } from "./errors.js";
import { asRecord, parseJsonUnique } from "./parsing.js";
import type {
  ChangeQuery,
  ContractChange,
  ContractRegistry,
  ProviderContractState,
  RegistryCapabilities,
  RegistryProvenance,
} from "./registry.js";
import { validateRegistryResponse } from "./schema.js";
import type { Confidence, EndpointRef } from "./types.js";

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_REGISTRY_URL_LENGTH = 2_048;
const MAX_PROVIDER_IDS_PER_REQUEST = 50;
const MAX_CHANGE_PAGES_PER_REQUEST = 10;
const MAX_CHANGES_PER_QUERY = 1_000;

type RegistryFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface HttpRegistryOptions {
  readonly fetch?: RegistryFetch;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
}

interface WireProvenance {
  readonly kind: "remote";
  readonly source_id: string;
  readonly retrieved_at: string;
  readonly source_url?: string;
  readonly content_hash?: string;
}

interface WireEndpoint {
  readonly method: string;
  readonly path: string;
  readonly host?: string;
}

interface WireProviderState {
  readonly provider_id: string;
  readonly revision: string;
  readonly operations: readonly string[];
  readonly endpoints: readonly WireEndpoint[];
  readonly confidence: Confidence;
  readonly provenance: WireProvenance;
}

interface WireChange {
  readonly id: string;
  readonly provider_id: string;
  readonly observed_at: string;
  readonly effective_at?: string;
  readonly severity: ContractChange["severity"];
  readonly operations: readonly string[];
  readonly endpoints: readonly WireEndpoint[];
  readonly summary: string;
  readonly confidence: Confidence;
  readonly provenance: WireProvenance;
}

function registryError(
  message: string,
  diagnosticCode = "DVL_REGISTRY_REMOTE",
  cause?: unknown,
): DevelraError {
  return new DevelraError(message, 4, diagnosticCode, {
    ...(cause === undefined ? {} : { cause }),
  });
}

function parseBaseUrl(value: string): URL {
  if (value.length === 0 || value.length > MAX_REGISTRY_URL_LENGTH) {
    throw registryError("Registry URL is invalid.", "DVL_REGISTRY_URL");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw registryError("Registry URL is invalid.", "DVL_REGISTRY_URL", error);
  }

  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  const allowedProtocol =
    url.protocol === "https:" || (url.protocol === "http:" && loopback);
  if (
    !allowedProtocol ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw registryError(
      "Registry URL must use HTTPS without credentials, query parameters, or fragments (HTTP is allowed only for loopback testing).",
      "DVL_REGISTRY_URL",
    );
  }

  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw registryError(`${label} must be a positive integer.`);
  }
  return value;
}

async function readBoundedBody(
  response: Response,
  maxResponseBytes: number,
): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > maxResponseBytes
  ) {
    throw registryError("Registry response exceeded the size limit.");
  }

  if (response.body === null) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const bytes: unknown = chunk.value;
      if (!(bytes instanceof Uint8Array)) {
        throw registryError("Registry response could not be read.");
      }
      size += bytes.byteLength;
      if (size > maxResponseBytes) {
        await reader.cancel();
        throw registryError("Registry response exceeded the size limit.");
      }
      text += decoder.decode(bytes, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch (error) {
    if (error instanceof DevelraError) throw error;
    throw registryError(
      "Registry response could not be read.",
      undefined,
      error,
    );
  }
}

function provenance(value: WireProvenance): RegistryProvenance {
  return {
    kind: value.kind,
    sourceId: value.source_id,
    retrievedAt: value.retrieved_at,
    ...(value.source_url === undefined ? {} : { sourceUrl: value.source_url }),
    ...(value.content_hash === undefined
      ? {}
      : { contentHash: value.content_hash }),
  };
}

function endpoint(value: WireEndpoint): EndpointRef {
  return {
    method: value.method,
    path: value.path,
    ...(value.host === undefined ? {} : { host: value.host }),
  };
}

function providerState(value: WireProviderState): ProviderContractState {
  return {
    providerId: value.provider_id,
    revision: value.revision,
    operations: [...value.operations],
    endpoints: value.endpoints.map(endpoint),
    confidence: value.confidence,
    provenance: provenance(value.provenance),
  };
}

function contractChange(value: WireChange): ContractChange {
  return {
    id: value.id,
    providerId: value.provider_id,
    observedAt: value.observed_at,
    ...(value.effective_at === undefined
      ? {}
      : { effectiveAt: value.effective_at }),
    severity: value.severity,
    operations: [...value.operations],
    endpoints: value.endpoints.map(endpoint),
    summary: value.summary,
    confidence: value.confidence,
    provenance: provenance(value.provenance),
  };
}

function invalidRouteResponse(): never {
  throw registryError(
    "Registry response did not match the requested operation.",
    "DVL_REGISTRY_SCHEMA",
  );
}

export class HttpRegistry implements ContractRegistry {
  readonly mode = "remote" as const;
  readonly #baseUrl: URL;
  readonly #fetch: RegistryFetch;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;

  constructor(baseUrl: string, options: HttpRegistryOptions = {}) {
    this.#baseUrl = parseBaseUrl(baseUrl);
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#timeoutMs = positiveInteger(
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      "Registry timeout",
    );
    this.#maxResponseBytes = positiveInteger(
      options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
      "Registry response size limit",
    );
  }

  async #request(path: string, allowNotFound = false): Promise<unknown> {
    let response: Response;
    try {
      response = await this.#fetch(new URL(path, this.#baseUrl), {
        method: "GET",
        headers: { accept: "application/json" },
        redirect: "error",
        credentials: "omit",
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (error) {
      throw registryError("Registry request failed.", undefined, error);
    }

    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) {
      throw registryError(
        `Registry request failed with HTTP ${response.status}.`,
      );
    }

    const contentType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (contentType !== "application/json") {
      throw registryError("Registry response must use application/json.");
    }

    const text = await readBoundedBody(response, this.#maxResponseBytes);
    let value: unknown;
    try {
      value = parseJsonUnique(text, "Registry response");
    } catch (error) {
      throw registryError(
        "Registry response was not valid JSON.",
        "DVL_REGISTRY_SCHEMA",
        error,
      );
    }
    await validateRegistryResponse(value);
    return value;
  }

  async getCapabilities(): Promise<RegistryCapabilities> {
    const value = asRecord(await this.#request("v1/capabilities"));
    const data = asRecord(value?.data);
    if (
      data?.mode !== "remote" ||
      data.remote !== true ||
      typeof data.provider_state !== "boolean" ||
      typeof data.changes !== "boolean"
    ) {
      return invalidRouteResponse();
    }
    return {
      mode: "remote",
      remote: true,
      providerState: data.provider_state,
      changes: data.changes,
    };
  }

  async getProviderState(
    providerId: string,
  ): Promise<ProviderContractState | null> {
    const response = await this.#request(
      `v1/providers/${encodeURIComponent(providerId)}/state`,
      true,
    );
    if (response === null) return null;
    const value = asRecord(response);
    const data = asRecord(value?.data);
    if (data?.provider_id !== providerId) return invalidRouteResponse();
    return providerState(data as unknown as WireProviderState);
  }

  async getChanges(query: ChangeQuery): Promise<readonly ContractChange[]> {
    const providerIds = [...new Set(query.providerIds)].sort();
    if (providerIds.length === 0) return [];

    const changes: ContractChange[] = [];
    const changeIds = new Set<string>();
    for (
      let offset = 0;
      offset < providerIds.length;
      offset += MAX_PROVIDER_IDS_PER_REQUEST
    ) {
      const batch = providerIds.slice(
        offset,
        offset + MAX_PROVIDER_IDS_PER_REQUEST,
      );
      const seenCursors = new Set<string>();
      let cursor: string | null = null;

      for (let pageNumber = 0; ; pageNumber += 1) {
        if (pageNumber >= MAX_CHANGE_PAGES_PER_REQUEST) {
          throw registryError("Registry change pagination exceeded the limit.");
        }
        const url = new URL("v1/changes", this.#baseUrl);
        for (const providerId of batch) {
          url.searchParams.append("provider_id", providerId);
        }
        if (query.since !== undefined)
          url.searchParams.set("since", query.since);
        if (cursor !== null) url.searchParams.set("cursor", cursor);

        const value = asRecord(await this.#request(url.href));
        if (!Array.isArray(value?.data)) return invalidRouteResponse();
        const page = asRecord(value.page);
        if (page === undefined || !("next_cursor" in page)) {
          return invalidRouteResponse();
        }

        for (const item of value.data as WireChange[]) {
          if (!batch.includes(item.provider_id) || changeIds.has(item.id)) {
            return invalidRouteResponse();
          }
          changeIds.add(item.id);
          changes.push(contractChange(item));
          if (changes.length > MAX_CHANGES_PER_QUERY) {
            throw registryError("Registry change result exceeded the limit.");
          }
        }

        const nextCursor = page.next_cursor;
        if (nextCursor === null) break;
        if (typeof nextCursor !== "string" || seenCursors.has(nextCursor)) {
          return invalidRouteResponse();
        }
        seenCursors.add(nextCursor);
        cursor = nextCursor;
      }
    }

    return changes;
  }
}
