import { z } from "zod";
import type { Locale } from "./config";

/** A schema-local fallback for Zod's built-in errors; never changes global state. */
export function validationErrorMap(locale: Locale): z.ZodErrorMap {
  return (issue, context) => {
    if (locale === "en") return { message: context.defaultError };
    switch (issue.code) {
      case z.ZodIssueCode.invalid_type:
        return { message: issue.received === "undefined" ? "Kolom ini wajib diisi" : "Jenis nilai tidak valid" };
      case z.ZodIssueCode.invalid_enum_value:
      case z.ZodIssueCode.invalid_literal:
        return { message: "Pilih nilai yang valid" };
      case z.ZodIssueCode.invalid_date:
        return { message: "Tanggal tidak valid" };
      case z.ZodIssueCode.invalid_string:
        return { message: "Format teks tidak valid" };
      case z.ZodIssueCode.too_small:
        return { message: `Nilai minimal ${issue.minimum}` };
      case z.ZodIssueCode.too_big:
        return { message: `Nilai maksimal ${issue.maximum}` };
      case z.ZodIssueCode.not_finite:
      case z.ZodIssueCode.not_multiple_of:
        return { message: "Angka tidak valid" };
      default:
        return { message: "Nilai tidak valid" };
    }
  };
}
