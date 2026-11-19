import { createContext, useContext, useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, type ApiClient } from "./client";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        onError: (error) => {
          if (error instanceof ApiError) {
            toast.error(error.message, {
              description: error.requestId ? `Request ID: ${error.requestId}` : undefined,
            });
            return;
          }
          toast.error("Something went wrong");
        },
      },
    },
  });
}

export function AppQueryProvider({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export type ApiContextValue = {
  client: ApiClient;
  tenantId: string | null;
};

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({
  client,
  tenantId = null,
  children,
}: {
  client: ApiClient;
  tenantId?: string | null;
  children: ReactNode;
}) {
  const value = useMemo<ApiContextValue>(() => ({ client, tenantId }), [client, tenantId]);
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi must be used within ApiProvider");
  return ctx;
}
