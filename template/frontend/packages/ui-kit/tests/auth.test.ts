import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/api/client";
import { principalFromAccessToken } from "../src/auth/jwt";
import { hasPermission } from "../src/auth/types";

function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode(claims)}.signature`;
}

describe("principalFromAccessToken", () => {
  it("maps platform-kit claims to a principal", () => {
    const token = fakeJwt({ sub: "u1", tid: "t1", roles: ["admin"], permissions: ["items:*"] });
    expect(principalFromAccessToken(token, { email: "a@b.co" })).toEqual({
      id: "u1",
      email: "a@b.co",
      name: undefined,
      tenantId: "t1",
      roles: ["admin"],
      permissions: ["items:*"],
    });
  });

  it("rejects tokens without a subject or with a broken payload", () => {
    expect(principalFromAccessToken(fakeJwt({ tid: "t1" }))).toBeNull();
    expect(principalFromAccessToken("not-a-jwt")).toBeNull();
  });
});

describe("hasPermission", () => {
  it("treats the platform-kit superuser '*' as every permission", () => {
    expect(hasPermission({ id: "u", permissions: ["*" as never] }, "items:delete")).toBe(true);
  });
});

describe("createApiClient refresh", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("refreshes once for concurrent 401s and retries with the new token", async () => {
    let token = "old";
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const auth = new Headers(init.headers).get("Authorization") ?? "";
        seen.push(auth);
        if (auth === "Bearer new")
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        return new Response(JSON.stringify({ error: { code: "unauthorized" } }), { status: 401 });
      }),
    );
    const refresh = vi.fn(async () => {
      token = "new";
      return token;
    });
    const client = createApiClient({ baseUrl: "http://api", getToken: () => token, refresh });

    await Promise.all([client.get("/a"), client.get("/b")]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(seen.filter((h) => h === "Bearer new")).toHaveLength(2);
  });

  it("does not refresh for skipped paths and reports 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "unauthorized" } }), { status: 401 }),
      ),
    );
    const refresh = vi.fn(async () => "new");
    const onUnauthorized = vi.fn();
    const client = createApiClient({
      baseUrl: "http://api",
      refresh,
      skipRefresh: (path) => path.startsWith("/auth/"),
      onUnauthorized,
    });

    await expect(client.post("/auth/login", {})).rejects.toMatchObject({ status: 401 });
    expect(refresh).not.toHaveBeenCalled();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
