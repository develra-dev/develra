import { readFile } from "node:fs/promises";

import { parseJsonUnique, validateRegistryResponse } from "@develra/core";
import { loadBundledProviders } from "@develra/providers";
import { describe, expect, it } from "vitest";

import {
  capabilitiesResponse,
  changesResponse,
  type PublicRegistryChange,
} from "../../registry-server/index.js";

interface RegistryData {
  readonly version: 1;
  readonly changes: readonly PublicRegistryChange[];
}

async function data(): Promise<RegistryData> {
  return parseJsonUnique(
    await readFile("registry-server/data/changes.json", "utf8"),
    "public registry data",
  ) as RegistryData;
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("public registry", () => {
  it("publishes deterministic changes backed by bundled provider IDs and operations", async () => {
    const registry = await data();
    const catalog = await loadBundledProviders();
    const providers = new Map(
      catalog.providers.map((provider) => [provider.id, provider]),
    );

    expect(registry.version).toBe(1);
    expect(registry.changes.length).toBeGreaterThan(0);
    expect(new Set(registry.changes.map((change) => change.id)).size).toBe(
      registry.changes.length,
    );
    expect(registry.changes).toEqual(
      [...registry.changes].sort(
        (left, right) =>
          left.observed_at.localeCompare(right.observed_at) ||
          left.provider_id.localeCompare(right.provider_id) ||
          left.id.localeCompare(right.id),
      ),
    );

    for (const change of registry.changes) {
      const provider = providers.get(change.provider_id);
      expect(provider, change.provider_id).toBeDefined();
      const operationIds = new Set(
        provider?.operations?.map((operation) => operation.id) ?? [],
      );
      for (const operation of change.operations) {
        expect(operationIds.has(operation), `${change.id}: ${operation}`).toBe(
          true,
        );
      }
      expect(change.provenance.source_url).toMatch(/^https:\/\//u);
      expect(change.provenance.source_url).not.toContain("example.");
      expect(JSON.stringify(change)).not.toMatch(
        /\/Users\/|authorization|bearer |token=|api[_-]?key/iu,
      );
    }

    await validateRegistryResponse({
      api_version: "v1",
      data: registry.changes,
      page: { next_cursor: null },
    });
  });

  it("serves versioned capabilities with cache validation", async () => {
    const request = new Request("https://www.develra.dev/api/v1/capabilities");
    const response = capabilitiesResponse(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await json(response)).toEqual({
      api_version: "v1",
      data: {
        mode: "remote",
        remote: true,
        provider_state: false,
        changes: true,
      },
    });

    const etag = response.headers.get("etag");
    expect(etag).toMatch(/^"sha256:[a-f0-9]{64}"$/u);
    const cached = capabilitiesResponse(
      new Request(request, { headers: { "if-none-match": etag ?? "" } }),
    );
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe("");
  });

  it("filters and paginates changes using bounded opaque cursors", async () => {
    const first = changesResponse(
      new Request(
        "https://www.develra.dev/api/v1/changes?provider_id=openai&provider_id=anthropic&limit=1",
      ),
    );
    expect(first.status).toBe(200);
    const firstBody = await json(first);
    await validateRegistryResponse(firstBody);
    expect(firstBody.data).toEqual([
      expect.objectContaining({ provider_id: "openai" }),
    ]);
    const cursor = (firstBody.page as { next_cursor: string }).next_cursor;
    expect(cursor).toEqual(expect.any(String));

    const second = changesResponse(
      new Request(
        `https://www.develra.dev/api/v1/changes?provider_id=openai&provider_id=anthropic&limit=1&cursor=${encodeURIComponent(cursor)}`,
      ),
    );
    const secondBody = await json(second);
    await validateRegistryResponse(secondBody);
    expect(secondBody.data).toEqual([
      expect.objectContaining({ provider_id: "anthropic" }),
    ]);
    expect(secondBody.page).toEqual({ next_cursor: null });

    const after = changesResponse(
      new Request(
        "https://www.develra.dev/api/v1/changes?provider_id=openai&since=2026-02-24T00%3A00%3A00Z",
      ),
    );
    expect((await json(after)).data).toEqual([]);
  });

  it.each([
    "",
    "?provider_id=openai&provider_id=openai",
    "?provider_id=OpenAI",
    "?provider_id=openai&since=yesterday",
    "?provider_id=openai&limit=101",
    "?provider_id=openai&cursor=not-a-cursor",
    "?provider_id=openai&extra=true",
  ])("rejects invalid queries without reflecting input: %s", async (query) => {
    const response = changesResponse(
      new Request(`https://www.develra.dev/api/v1/changes${query}`),
    );
    const body = await json(response);
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.request_id).toMatch(/^req_[a-f0-9]{32}$/u);
    if (query.length > 0) expect(JSON.stringify(body)).not.toContain(query);
  });
});
