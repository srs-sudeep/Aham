export type DateInput = Date | string | number;

function toDate(value: DateInput | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatNumber(
  value: number | string | null | undefined,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "";
  return new Intl.NumberFormat(locale, options).format(num);
}

export function formatMoney(
  amount: number | string | null | undefined,
  currency: string,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  return formatNumber(amount, locale, { style: "currency", currency, ...options });
}

export type FormatDateOptions = {
  /**
   * Optional pattern using the tokens yyyy, MM, dd, HH, mm, ss (e.g. "yyyy-MM-dd").
   * When provided it takes precedence over locale-based formatting.
   */
  pattern?: string;
};

const PATTERN_TOKEN = /yyyy|MM|dd|HH|mm|ss/g;

function formatWithPattern(date: Date, pattern: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  const tokens: Record<string, string> = {
    yyyy: get("year"),
    MM: get("month"),
    dd: get("day"),
    HH: hour,
    mm: get("minute"),
    ss: get("second"),
  };
  return pattern.replace(PATTERN_TOKEN, (token) => tokens[token] ?? token);
}

export function formatDate(
  date: DateInput | null | undefined,
  locale: string,
  timeZone?: string,
  options: FormatDateOptions = {},
): string {
  const value = toDate(date);
  if (!value) return "";
  if (options.pattern) return formatWithPattern(value, options.pattern, timeZone);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(value);
}

export function formatDateTime(
  date: DateInput | null | undefined,
  locale: string,
  timeZone?: string,
  options: FormatDateOptions = {},
): string {
  const value = toDate(date);
  if (!value) return "";
  if (options.pattern) return formatWithPattern(value, options.pattern, timeZone);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}
