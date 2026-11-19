import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
  formatDate,
  usePreferences,
  useTranslation,
} from "@aham/ui-kit";

const TIMEZONES = [
  "UTC",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
] as const;

const CURRENCIES = ["USD", "JPY", "EUR", "GBP"] as const;

const DATE_FORMATS = ["yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy"] as const;

export function RegionalSection() {
  const { t } = useTranslation();
  const { locale, timezone, currency, dateFormat, setTimezone, setCurrency, setDateFormat } =
    usePreferences();

  const tz = timezone ?? "UTC";
  const cur = currency ?? "USD";
  const fmt = dateFormat ?? "yyyy-MM-dd";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.regional")}</CardTitle>
        <CardDescription>{t("settings.regionalDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="settings-timezone">{t("settings.timezone")}</Label>
            <Select value={tz} onValueChange={setTimezone}>
              <SelectTrigger id="settings-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-currency">{t("settings.currency")}</Label>
            <Select value={cur} onValueChange={setCurrency}>
              <SelectTrigger id="settings-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-date-format">{t("settings.dateFormat")}</Label>
            <Select value={fmt} onValueChange={setDateFormat}>
              <SelectTrigger id="settings-date-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((pattern) => (
                  <SelectItem key={pattern} value={pattern}>
                    {pattern}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Text variant="muted">{formatDate(new Date(), locale, tz, { pattern: fmt })}</Text>
      </CardContent>
    </Card>
  );
}
