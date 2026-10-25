import { common } from "../sections/common";
import { publicText } from "../sections/public";

/**
 * Kamus bahasa Indonesia — sumber kebenaran struktur.
 * Setiap bagian bahasa Inggris (`locales/en.ts`) wajib mengikuti bentuk ini.
 */
export const id = {
  common: common.id,
  public: publicText.id,
};

export type Dictionary = typeof id;
