import { HttpRegistry } from "@develra/core";
import { describe, expect, it, vi } from "vitest";

const provenance = {
  kind: "remote",
  source_id: "registry:openai",
  retrieved_at: "2026-08-29T12:00:00Z",
  source_url: "https://registry.example.test/sources/openai",
  content_hash:
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
} as const;

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("HTTP contract registry", () => {
  it("converts capabilities, provider state, and paginated changes", async () => {
    const requested: URL[] = [];
    const fetch = vi.fn((input: string | URL | Request) => {
      const url = new URL(
        input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : input,
      );
      requested.push(url);
      if (url.pathname.endsWith("/v1/capabilities")) {
        return Promise.resolve(
          jsonResponse({
            api_version: "v1",
            data: {
              mode: "remote",
              remote: true,
              provider_state: true,
              changes: true,
            },
          }),
        );
      }
      if (url.pathname.endsWith("/v1/providers/openai/state")) {
        return Promise.resolve(
          jsonResponse({
            api_version: "v1",
            data: {
              provider_id: "openai",
              revision: "2026-08-29",
              operations: ["responses.create"],
              endpoints: [],
              confidence: "confirmed",
              provenance,
            },
          }),
        );
      }
      const secondPage = url.searchParams.get("cursor") === "next-page";
      return Promise.resolve(
        jsonResponse({
          api_version: "v1",
          data: secondPage
            ? [
                {
                  id: "openai-change-2",
                  provider_id: "openai",
                  observed_at: "2026-08-29T12:10:00Z",
                  severity: "warning",
                  operations: [],
                  endpoints: [],
                  summary: "A provider-level change.",
                  confidence: "probable",
                  provenance,
                },
              ]
            : [
                {
                  id: "openai-change-1",
                  provider_id: "openai",
                  observed_at: "2026-08-29T12:00:00Z",
                  effective_at: "2026-09-01T00:00:00Z",
                  severity: "breaking",
                  operations: ["responses.create"],
                  endpoints: [],
                  summary: "The response contract changed.",
                  confidence: "confirmed",
                  provenance,
                },
              ],
          page: { next_cursor: secondPage ? null : "next-page" },
        }),
      );
    });
    const registry = new HttpRegistry("https://registry.example.test/base", {
      fetch,
    });

    await expect(registry.getCapabilities()).resolves.toMatchObject({
      mode: "remote",
      changes: true,
    });
    await expect(registry.getProviderState("openai")).resolves.toMatchObject({
      providerId: "openai",
      operations: ["responses.create"],
      provenance: { sourceId: "registry:openai" },
    });
    await expect(
      registry.getChanges({ providerIds: ["openai", "openai"] }),
    ).resolves.toMatchObject([
      { id: "openai-change-1", providerId: "openai" },
      { id: "openai-change-2", providerId: "openai" },
    ]);
    expect(requested.at(-2)?.searchParams.getAll("provider_id")).toEqual([
      "openai",
    ]);
    expect(requested.at(-1)?.searchParams.get("cursor")).toBe("next-page");
  });

  it("rejects unsafe URLs before transport is created", () => {
    const fetch = vi.fn();
    expect(
      () => new HttpRegistry("http://registry.example.test", { fetch }),
    ).toThrowError("Registry URL must use HTTPS");
    expect(
      () => new HttpRegistry("https://token@registry.example.test", { fetch }),
    ).toThrowError("Registry URL must use HTTPS");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("bounds and validates untrusted responses as registry failures", async () => {
    const oversized = new HttpRegistry("https://registry.example.test", {
      maxResponseBytes: 20,
      fetch: () => Promise.resolve(jsonResponse({ data: "too large" })),
    });
    await expect(oversized.getCapabilities()).rejects.toMatchObject({
      exitCode: 4,
    });

    const malformed = new HttpRegistry("https://registry.example.test", {
      fetch: () =>
        Promise.resolve(
          jsonResponse({ api_version: "v1", data: { mode: "remote" } }),
        ),
    });
    await expect(malformed.getCapabilities()).rejects.toMatchObject({
      exitCode: 4,
      diagnosticCode: "DVL_REGISTRY_SCHEMA",
    });

    const unavailable = new HttpRegistry("https://registry.example.test", {
      fetch: () => Promise.resolve(jsonResponse({}, { status: 503 })),
    });
    await expect(unavailable.getCapabilities()).rejects.toMatchObject({
      exitCode: 4,
    });
  });
});
