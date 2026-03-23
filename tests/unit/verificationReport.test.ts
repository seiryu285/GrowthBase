import { describe, expect, it } from "vitest";

import { buildVerificationReport } from "@growthbase/receipt";

describe("buildVerificationReport", () => {
  it("builds pass/fail checks and overall passed from verification booleans", () => {
    const report = buildVerificationReport({
      policySignatureValid: true,
      policyHashValid: true,
      requestHashValid: false,
      fullyVerified: false
    });

    expect(report.passed).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        { id: "policySignatureValid", pass: true },
        { id: "policyHashValid", pass: true },
        { id: "requestHashValid", pass: false }
      ])
    );
  });

  it("prefers fullyVerified when present", () => {
    const report = buildVerificationReport({
      a: true,
      fullyVerified: true
    });

    expect(report.passed).toBe(true);
  });
});
