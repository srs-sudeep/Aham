/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DEFAULT_LOCALE: string;
  /** Set to "1" or "true" to serve API responses from MSW handlers. */
  readonly VITE_USE_MOCKS?: string;
  /** "saas" (platform-kit identity) or "dev" (mock principal). Defaults to the generated choice. */
  readonly VITE_AUTH_MODE?: "saas" | "dev";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
