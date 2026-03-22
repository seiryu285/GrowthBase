const USD_ATOMIC_SCALE = 1_000_000n;

export function usdDecimalToAtomic(value: string): bigint {
  const normalized = value.trim();

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid decimal money value: ${value}`);
  }

  const [rawWhole = "0", rawFraction = ""] = normalized.split(".");
  const paddedFraction = `${rawFraction}000000`.slice(0, 6);
  return BigInt(rawWhole) * USD_ATOMIC_SCALE + BigInt(paddedFraction);
}

export function atomicToUsdDecimal(value: bigint | string): string {
  const atomic = typeof value === "string" ? BigInt(value) : value;
  const whole = atomic / USD_ATOMIC_SCALE;
  const fraction = (atomic % USD_ATOMIC_SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

export function sumUsdValues(values: readonly string[]): bigint {
  return values.reduce((total, value) => total + usdDecimalToAtomic(value), 0n);
}

export const usdDecimalToMicros = usdDecimalToAtomic;
export const microsToUsdDecimal = atomicToUsdDecimal;
