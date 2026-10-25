// English source strings as keys, German from de.json (shared with the iOS String Catalog).
import { getLocales } from "expo-localization";
import { formatString } from "../core/format.ts";
import de from "./de.json";

export const lang: "de" | "en" = getLocales()[0]?.languageCode === "de" ? "de" : "en";

const table = de as Record<string, string>;

export function t(key: string, ...args: (string | number)[]): string {
  return formatString(lang === "de" ? (table[key] ?? key) : key, args);
}
