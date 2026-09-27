export type Job = {
  id: string;
  customer: string;
  description: string;
  amount_cents: number;
  done_at: string;
  /** Saved on this device but not yet confirmed by the server (no signal). */
  pending?: boolean;
};

export type Cost = {
  id: string;
  payee: string;
  category: string;
  amount_cents: number;
  spent_at: string;
};

export type DashboardData = {
  business: { id: string; name: string } | null;
  month_start: string;
  now: string;
  jobs: Job[];
  costs: Cost[];
};

export const BUSINESS_TZ = "Australia/Sydney";

const whole = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

const withCents = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** $12,480 — cents only shown when they matter. */
export function formatMoney(cents: number, { sign = false } = {}) {
  const abs = Math.abs(cents);
  const text = abs % 100 === 0 ? whole.format(abs / 100) : withCents.format(abs / 100);
  if (cents < 0) return `−${text}`;
  return sign ? `+${text}` : text;
}

/** Accepts "450", "$1,250.50", "1250.5" — returns cents or null. */
export function parseDollars(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned || cleaned === ".") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export function monthLabel(iso: string) {
  return new Intl.DateTimeFormat("en-AU", { month: "long", timeZone: BUSINESS_TZ }).format(
    new Date(iso),
  );
}

export function dayOfMonth(iso: string) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: BUSINESS_TZ,
  }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const day = get("day");
  const daysInMonth = new Date(get("year"), get("month"), 0).getDate();
  return { day, daysInMonth };
}

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ });

export function dayKey(iso: string) {
  return dayKeyFormat.format(new Date(iso));
}

export function dayHeading(iso: string, nowIso: string) {
  const key = dayKey(iso);
  const today = dayKey(nowIso);
  const yesterday = dayKey(new Date(new Date(nowIso).getTime() - 86_400_000).toISOString());
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: BUSINESS_TZ,
  }).format(new Date(iso));
}

export function timeOfDay(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BUSINESS_TZ,
  })
    .format(new Date(iso))
    .replace(" ", "")
    .toLowerCase();
}
