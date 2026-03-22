import { hexToBytes, keccak256, toHex } from "viem";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, innerValue]) => [key, sortValue(innerValue)])
    );
  }

  return value;
}

export function toCanonicalObject<T>(value: T): T {
  return sortValue(value) as T;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(toCanonicalObject(value));
}

export function hashCanonicalValue(value: unknown): `0x${string}` {
  const encoded = new TextEncoder().encode(stableStringify(value));
  return keccak256(encoded);
}

export function stripKeys<T extends Record<string, unknown>, K extends keyof T>(
  value: T,
  keys: readonly K[]
): Omit<T, K> {
  const clone = { ...value };

  for (const key of keys) {
    delete clone[key];
  }

  return clone;
}

export function shortHashId(prefix: string, hash: `0x${string}`, length = 16): string {
  return `${prefix}_${hash.slice(2, 2 + length)}`;
}

export function hashToDeterministicUuid(hash: `0x${string}`): string {
  const hex = hash.slice(2, 34).padEnd(32, "0").split("");
  hex[12] = "5";
  hex[16] = "8";
  const compact = hex.join("");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20, 32)}`;
}

export function combineHashes(values: Array<`0x${string}` | string>): `0x${string}` {
  const bytes = values.flatMap((value) =>
    value.startsWith("0x") ? [...hexToBytes(value as `0x${string}`)] : [...new TextEncoder().encode(value)]
  );
  return keccak256(toHex(Uint8Array.from(bytes)));
}
