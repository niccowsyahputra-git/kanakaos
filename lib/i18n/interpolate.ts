/**
 * Ganti placeholder {nama} pada string terjemahan dengan nilai.
 * Contoh: interpolate("Halo, {name}!", { name: "Budi" }) -> "Halo, Budi!"
 * Placeholder yang tidak diberi nilai dibiarkan apa adanya.
 */
export function interpolate(
  template: string,
  params: Record<string, string | number> = {}
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  );
}
