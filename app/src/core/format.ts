// Formats strings that use the same placeholders as the iOS String Catalog:
// %@ / %lld in order, or positional %1$@ / %2$lld.

export function formatString(template: string, args: (string | number)[]): string {
  let next = 0;
  return template.replace(/%(?:(\d+)\$)?(@|lld|d)|%%/g, (match, pos: string | undefined) => {
    if (match === "%%") return "%";
    const index = pos ? Number(pos) - 1 : next++;
    return index < args.length ? String(args[index]) : match;
  });
}

// Date helpers without Intl: Hermes in Expo Go has no Intl.RelativeTimeFormat, and its toLocaleString ignores locales.

export type Ago = { unit: "now" | "minutes" | "hours" | "yesterday" | "days" | "date"; n: number };

/** How long ago `ms` was, in the coarsest useful unit. Older than a week becomes a plain date. */
export function agoParts(ms: number, now: number): Ago {
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 60) return { unit: "now", n: 0 };
  if (s < 3600) return { unit: "minutes", n: Math.floor(s / 60) };
  if (s < 86400) return { unit: "hours", n: Math.floor(s / 3600) };
  const days = Math.floor(s / 86400);
  if (days === 1) return { unit: "yesterday", n: 1 };
  if (days < 7) return { unit: "days", n: days };
  return { unit: "date", n: days };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDate(ms: number, lang: "de" | "en"): string {
  const d = new Date(ms);
  return lang === "de" ? `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}` : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export function formatDateTime(ms: number, lang: "de" | "en"): string {
  const d = new Date(ms);
  return `${formatDate(ms, lang)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
