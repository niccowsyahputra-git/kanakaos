import type { TranslationParams, Translator } from "./translate";

const PREFIX = "i18n:v1:";

/** Persist source templates and parameters, never the sender's language. */
export function notificationMessage(source: string, params: TranslationParams): string {
  return PREFIX + JSON.stringify({ source, params });
}

export function translateNotification(value: string, tr: Translator): string {
  if (value.startsWith(PREFIX)) {
    try {
      const message: unknown = JSON.parse(value.slice(PREFIX.length));
      if (message && typeof message === "object" && "source" in message &&
          typeof message.source === "string" && "params" in message &&
          message.params && typeof message.params === "object" &&
          !Array.isArray(message.params) && Object.values(message.params).every(
            item => item == null || typeof item === "string" || typeof item === "number"
          )) {
        return tr(message.source, message.params as TranslationParams);
      }
    } catch {
      // Keep unrecognized historical records readable.
    }
    return value;
  }
  // Legacy records contain application-owned templates mixed with user data.
  // The translator only matches known, anchored catalog templates.
  if (value.startsWith("⚠️ KRITIS — ")) {
    return tr("⚠️ KRITIS — ") + value.slice("⚠️ KRITIS — ".length);
  }
  return tr(value);
}
