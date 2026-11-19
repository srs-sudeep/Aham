import {
  COLOR_PRESETS,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DENSITIES,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  THEME_MODES,
  usePreferences,
  useTranslation,
} from "@aham/ui-kit";
import type { ColorPreset, Density, ThemeMode } from "@aham/ui-kit";

export function AppearanceSection() {
  const { t } = useTranslation();
  const { themeMode, setThemeMode, colorPreset, setColorPreset, density, setDensity } =
    usePreferences();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.appearance")}</CardTitle>
        <CardDescription>{t("settings.appearanceDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="settings-theme-mode">{t("settings.themeMode")}</Label>
          <Select value={themeMode} onValueChange={(v) => setThemeMode(v as ThemeMode)}>
            <SelectTrigger id="settings-theme-mode">
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
          <Label htmlFor="settings-color-preset">{t("settings.colorPreset")}</Label>
          <Select value={colorPreset} onValueChange={(v) => setColorPreset(v as ColorPreset)}>
            <SelectTrigger id="settings-color-preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLOR_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {t(`settings.preset.${preset}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-density">{t("settings.density")}</Label>
          <Select value={density} onValueChange={(v) => setDensity(v as Density)}>
            <SelectTrigger id="settings-density">
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
  );
}
