import { Page, PageHeader, useTranslation } from "@aham/ui-kit";
import { AppearanceSection } from "../components/AppearanceSection";
import { LanguageSection } from "../components/LanguageSection";
import { RegionalSection } from "../components/RegionalSection";

/**
 * Preferences only update the stored state. The i18n language follows the
 * `locale` preference via `LocaleSync` in app/providers — do not call
 * `i18n.changeLanguage` from here.
 */
export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <Page>
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      <AppearanceSection />
      <LanguageSection />
      <RegionalSection />
    </Page>
  );
}
