import { createApiClient } from "@aham/ui-kit";

const TOKEN_KEY = "aham.auth.token";

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:8001",
  getToken: () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY)),
});
