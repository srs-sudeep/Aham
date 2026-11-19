import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Locale } from "@aham/ui-kit";
import { startMocks } from "../lib/mocks";
import { AppProviders } from "./providers";
import { AppRouter } from "./router";
import "../styles.css";

async function bootstrap() {
  await startMocks();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppProviders defaultLocale={"en" as Locale}>
        <AppRouter />
      </AppProviders>
    </StrictMode>,
  );
}

void bootstrap();
