import { createElement, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { AppQueryProvider } from "../api/query";

/** Query client for tests: no retries, no cache garbage collection delays. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Wrapper for tests. Pass as the `wrapper` option of your render function, e.g.
 * `render(ui, { wrapper: ({ children }) => createElement(TestProviders, null, children) })`.
 * Apps can compose additional providers (auth, i18n, tenant) around it.
 */
export function TestProviders({ children, client }: { children: ReactNode; client?: QueryClient }) {
  return createElement(AppQueryProvider, { client: client ?? createTestQueryClient(), children });
}
