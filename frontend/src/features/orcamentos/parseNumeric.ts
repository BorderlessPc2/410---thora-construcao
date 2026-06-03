/**
 * Parser numérico pt-BR para totais monetários (remove milhar, vírgula → decimal).
 * Evita concatenação de strings e valores na casa dos bilhões.
 */
export function parseNumeric(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleanString = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleanString);
  return Number.isNaN(parsed) ? 0 : parsed;
}
