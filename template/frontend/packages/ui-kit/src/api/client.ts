export class ApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
    if (body && typeof body === "object" && body !== null && "error" in body) {
      const err = (body as { error?: { code?: string; message?: string } }).error;
      this.code = err?.code;
      if (err?.message) this.message = err.message;
    }
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => string | null;
  getRequestId?: () => string;
};

export function createApiClient(options: ApiClientOptions) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const token = options.getToken?.();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const requestId = options.getRequestId?.() ?? crypto.randomUUID();
    headers.set("X-Request-ID", requestId);

    const res = await fetch(`${options.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
    });
    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
      throw new ApiError(res.statusText || "Request failed", res.status, body);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    put: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
    patch: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
