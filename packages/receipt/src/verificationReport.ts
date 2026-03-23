export type VerificationCheck = { id: string; pass: boolean };

export type VerificationReport = {
  passed: boolean;
  checks: VerificationCheck[];
};

/**
 * Structured pass/fail list derived from reconstructTransaction().verification.
 */
export function buildVerificationReport(verification: Record<string, boolean | undefined>): VerificationReport {
  const checks: VerificationCheck[] = [];

  for (const [id, value] of Object.entries(verification)) {
    if (id === "fullyVerified") {
      continue;
    }
    if (typeof value === "boolean") {
      checks.push({ id, pass: value });
    }
  }

  const passed =
    typeof verification.fullyVerified === "boolean"
      ? verification.fullyVerified
      : checks.length > 0 && checks.every((c) => c.pass);

  return { passed, checks };
}
