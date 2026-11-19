import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  LOCALES,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  usePreferences,
  useTranslation,
} from "@aham/ui-kit";
import type { Locale } from "@aham/ui-kit";

export function LanguageSection() {
  const { t } = useTranslation();
  const { locale, setLocale } = usePreferences();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.language")}</CardTitle>
        <CardDescription>{t("settings.languageDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="settings-locale">{t("settings.language")}</Label>
          {/* Only updates the preference; LocaleSync (app/providers) switches i18n. */}
          <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
            <SelectTrigger id="settings-locale">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {t(`settings.locale.${loc}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
