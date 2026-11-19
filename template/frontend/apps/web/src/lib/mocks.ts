function mocksEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_MOCKS;
  return flag === "1" || flag === "true";
}

/**
 * Start the MSW service worker when `VITE_USE_MOCKS` is `1` / `true`.
 * Handlers and `msw` itself are imported dynamically so they stay out of
 * production bundles when mocks are disabled.
 */
export async function startMocks(): Promise<void> {
  if (!mocksEnabled()) return;
  const [{ setupWorker }, { itemsHandlers }, { categoriesHandlers }] = await Promise.all([
    import("msw/browser"),
    import("../modules/catalog/features/items/api/items.handlers"),
    import("../modules/catalog/features/categories/api/categories.handlers"),
  ]);
  const worker = setupWorker(...itemsHandlers, ...categoriesHandlers);
  await worker.start({ onUnhandledRequest: "bypass" });
}
