import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@aham/ui-kit/components";
import {
  usePreferences,
  useTranslation,
  COLOR_PRESETS,
  THEME_MODES,
  DENSITIES,
  LOCALES,
  type ColorPreset,
  type ThemeMode,
  type Density,
  type Locale,
} from "@aham/ui-kit";
import { useEffect } from "react";
import { i18n } from "@/lib/i18n";

export function SettingsPage() {
  const { t } = useTranslation();
  const {
    themeMode,
    setThemeMode,
    colorPreset,
    setColorPreset,
    locale,
    setLocale,
    density,
    setDensity,
  } = usePreferences();

  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);

  return (
    <div>
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appearance")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("settings.themeMode")}</Label>
            <Select value={themeMode} onValueChange={(v) => setThemeMode(v as ThemeMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {t(`settings.${mode}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("settings.colorPreset")}</Label>
            <Select value={colorPreset} onValueChange={(v) => setColorPreset(v as ColorPreset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {preset}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("settings.language")}</Label>
            <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("settings.density")}</Label>
            <Select value={density} onValueChange={(v) => setDensity(v as Density)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DENSITIES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {t(`settings.${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Separator className="my-6" />
    </div>
  );
}
