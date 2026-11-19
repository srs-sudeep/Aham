import { createApiClient, getStoredTenantId } from "@aham/ui-kit";

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:8001",
  getToken: () => localStorage.getItem("aham.auth.token"),
  getTenantId: () => getStoredTenantId(),
  onUnauthorized: () => {
    localStorage.removeItem("aham.auth.token");
    localStorage.removeItem("aham.auth.principal");
    window.location.assign("/login");
  },
});
