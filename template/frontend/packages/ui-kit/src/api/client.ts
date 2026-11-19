export type ApiErrorFields = Record<string, string[]>;

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    fields?: ApiErrorFields;
  };
  request_id?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: ApiErrorFields;
  requestId?: string;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.requestId = requestId;

    if (isRecord(body)) {
      const envelope = body as ErrorEnvelope;
      const err = isRecord(envelope.error) ? envelope.error : undefined;
      if (err) {
        if (typeof err.code === "string") this.code = err.code;
        if (typeof err.message === "string" && err.message) this.message = err.message;
        if (isRecord(err.fields)) {
          const fields: ApiErrorFields = {};
          for (const [key, value] of Object.entries(err.fields)) {
            if (Array.isArray(value)) fields[key] = value.map(String);
            else if (typeof value === "string") fields[key] = [value];
          }
          this.fields = fields;
        }
      }
      if (typeof envelope.request_id === "string") this.requestId = envelope.request_id;
    }
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => string | null;
  /** Sent as `X-Tenant-ID`. Leave unset when the tenant lives in the token (platform-kit `tid`). */
  getTenantId?: () => string | null;
  getRequestId?: () => string;
  /** `"include"` when the API sets cookies (e.g. the httpOnly refresh token on another origin). */
  credentials?: RequestCredentials;
  /**
   * Obtain a fresh access token after a 401 (e.g. POST /auth/refresh with the refresh cookie).
   * Return null when the session cannot be renewed. Concurrent 401s share one refresh call.
   */
  refresh?: () => Promise<string | null>;
  /** Paths that must never trigger `refresh` (login, refresh itself, ...). */
  skipRefresh?: (path: string) => boolean;
  onUnauthorized?: (error: ApiError) => void;
};

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  let inflightRefresh: Promise<string | null> | null = null;

  function refreshOnce(): Promise<string | null> {
    if (!options.refresh) return Promise.resolve(null);
    inflightRefresh ??= options
      .refresh()
      .catch(() => null)
      .finally(() => {
        inflightRefresh = null;
      });
    return inflightRefresh;
  }

  async function send(path: string, init: RequestInit, token: string | null | undefined) {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const tenantId = options.getTenantId?.();
    if (tenantId) headers.set("X-Tenant-ID", tenantId);
    const requestId = options.getRequestId?.() ?? crypto.randomUUID();
    headers.set("X-Request-ID", requestId);
    const res = await fetch(`${baseUrl}${path}`, {
      credentials: options.credentials,
      ...init,
      headers,
    });
    return { res, requestId };
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let { res, requestId } = await send(path, init, options.getToken?.());

    if (res.status === 401 && options.refresh && !options.skipRefresh?.(path)) {
      const renewed = await refreshOnce();
      if (renewed) ({ res, requestId } = await send(path, init, renewed));
    }

    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
      const responseRequestId = res.headers.get("X-Request-ID") ?? requestId;
      const error = new ApiError(
        res.statusText || "Request failed",
        res.status,
        body,
        responseRequestId,
      );
      if (res.status === 401) options.onUnauthorized?.(error);
      throw error;
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  const withBody = (method: string, path: string, body?: unknown) =>
    request(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) => withBody("POST", path, body) as Promise<T>,
    put: <T>(path: string, body?: unknown) => withBody("PUT", path, body) as Promise<T>,
    patch: <T>(path: string, body?: unknown) => withBody("PATCH", path, body) as Promise<T>,
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
