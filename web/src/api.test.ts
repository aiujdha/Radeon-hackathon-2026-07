import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError, errorMessage } from "./api";

describe("ApiClient", () => {
  it("sends a bearer token and parses a successful response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ user_id: "u1" }), { status: 200 }));
    const client = new ApiClient({ baseUrl: "https://api.example.test", getToken: () => "token-1", fetchImpl });
    await expect(client.getCurrentUser()).resolves.toEqual({ user_id: "u1" });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.test/auth/me", expect.objectContaining({ headers: expect.any(Headers) }));
    const headers = fetchImpl.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("maps an expired-session response to a user-facing error", async () => {
    const client = new ApiClient({ fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: { error_code: "AUTH_TOKEN_INVALID", message: "invalid token" } }), { status: 401 })) });
    await expect(client.getCurrentUser()).rejects.toMatchObject({ status: 401, code: "AUTH_TOKEN_INVALID", message: "invalid token" } satisfies Partial<ApiError>);
  });

  it("maps network failures without exposing implementation details", () => {
    expect(errorMessage(new TypeError("fetch failed"))).toBe("无法连接后端服务，请检查服务是否已启动。");
  });
});
