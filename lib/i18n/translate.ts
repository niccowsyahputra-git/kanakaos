import { messages } from "./sections/messages";
import { interpolate } from "./interpolate";
import type { Locale } from "./config";

export type TranslationParams = Record<string, string | number | null | undefined>;
export type Translator = (source: string, params?: TranslationParams) => string;

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Legacy action errors may already contain interpolated values. Match only
// cataloged templates; arbitrary user content is never sent through this API.
const patterns = Object.keys(messages.id)
  .filter(key => /\{\d+\}/.test(key) && /[A-Za-z]{3}/.test(key.replace(/\{\d+\}/g, "")))
  .map(key => {
    const keys: string[] = [];
    const parts = key.split(/(\{\d+\})/g);
    const pattern = parts.map(part => {
      if (/^\{\d+\}$/.test(part)) {
        keys.push(part.slice(1, -1));
        return "(.+?)";
      }
      return escapeRegex(part);
    }).join("");
    return { key, keys, regex: new RegExp(`^${pattern}$`) };
  })
  .sort((a, b) => b.key.length - a.key.length);

/** Request-local, pure translation. Never stores a mutable global locale. */
export function createTranslator(locale: Locale): Translator {
  const dictionary: Record<string, string> = messages[locale];
  return (source, params) => {
    const key = normalize(source);
    let text = Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : source;
    let values = params;
    if (locale === "en" && !params && !Object.prototype.hasOwnProperty.call(dictionary, key)) {
      for (const pattern of patterns) {
        const match = pattern.regex.exec(key);
        if (!match) continue;
        text = dictionary[pattern.key];
        values = Object.fromEntries(pattern.keys.map((name, i) => [name, match[i + 1]]));
        break;
      }
    }
    if (values) {
      text = interpolate(text, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v == null ? "" : v])));
    }
    if (locale === "id" && !params && text === key) return source;
    if (text !== source) {
      const leading = source.match(/^\s*/)?.[0] ?? "";
      const trailing = source.match(/\s*$/)?.[0] ?? "";
      return leading + text + trailing;
    }
    return text;
  };
}

/** Localize display maps while retaining canonical option values and IDs. */
export function localizeLabels<T>(value: T, tr: Translator): T {
  if (typeof value === "string") return tr(value) as T;
  if (Array.isArray(value)) {
    // String arrays are often also persisted form values; translate on display.
    return value.map(item => typeof item === "object" && item !== null ? localizeLabels(item, tr) : item) as T;
  }
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /^(?:value|id|key|href|src|className|color|variant|icon|allowedRoles|dataKey)$/.test(key)
      ? item : localizeLabels(item, tr),
  ])) as T;
}
