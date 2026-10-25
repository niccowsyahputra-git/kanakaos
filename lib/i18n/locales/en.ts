import type { Dictionary } from "./id";
import { common } from "../sections/common";
import { publicText } from "../sections/public";

/** Kamus bahasa Inggris — kunci wajib sama persis dengan `id.ts`. */
export const en: Dictionary = {
  common: common.en,
  public: publicText.en,
};
