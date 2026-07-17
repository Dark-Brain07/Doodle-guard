const WEI_PER_GEN = 10n ** 18n;

/**
 * Parse a decimal string GEN amount into wei without floating-point precision loss.
 * Accepts "1", "1.5", "0.001", ".5". Rejects negatives, NaN, exponent form.
 */
export function parseGenAmount(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d*\.?\d+$/.test(trimmed)) {
    throw new Error("Invalid GEN amount");
  }
  const [whole, frac = ""] = trimmed.split(".");
  const wholePart = whole === "" ? 0n : BigInt(whole);
  const paddedFrac = (frac + "0".repeat(18)).slice(0, 18);
  const fracPart = paddedFrac === "" ? 0n : BigInt(paddedFrac);
  return wholePart * WEI_PER_GEN + fracPart;
}

/** Format wei as GEN without converting through an imprecise Number. */
export function formatGenAmount(input: string | bigint, maxDecimals = 4): string {
  const wei = typeof input === "bigint" ? input : BigInt(input);
  const whole = wei / WEI_PER_GEN;
  const fraction = (wei % WEI_PER_GEN).toString().padStart(18, "0");
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}
