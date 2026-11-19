import { StrictMode, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import {
  AuthProvider,
  PreferencesProvider,
  AppQueryProvider,
  createQueryClient,
  Toaster,
  usePreferences,
} from "@aham/ui-kit";
import { I18nextProvider } from "react-i18next";
import { router } from "./router";
import { i18n } from "./lib/i18n";
import "./styles.css";

const queryClient = createQueryClient();

function LocaleSync({ children }: { children: ReactNode }) {
  const { locale } = usePreferences();
  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);
  return children;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreferencesProvider defaultLocale={"en" as "en" | "ja"}>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <AppQueryProvider client={queryClient}>
            <LocaleSync>
              <RouterProvider router={router} />
              <Toaster />
            </LocaleSync>
          </AppQueryProvider>
        </AuthProvider>
      </I18nextProvider>
    </PreferencesProvider>
  </StrictMode>,
);
