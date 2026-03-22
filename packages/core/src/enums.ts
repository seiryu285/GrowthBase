import { z } from "zod";

export const decisionValues = ["GO", "WAIT", "DENY"] as const;
export const deliveryStatusValues = ["DELIVERED", "FAILED", "EXPIRED"] as const;
export const policyStatusValues = ["ACTIVE", "EXPIRED", "REVOKED"] as const;
export const errorCodeValues = [
  "POLICY_INVALID",
  "POLICY_EXPIRED",
  "SERVICE_NOT_ALLOWED",
  "PRICE_EXCEEDS_POLICY",
  "PAYMENT_REQUIRED",
  "PAYMENT_FAILED",
  "ARTIFACT_GENERATION_FAILED"
] as const;

export const decisionSchema = z.enum(decisionValues);
export const deliveryStatusSchema = z.enum(deliveryStatusValues);
export const policyStatusSchema = z.enum(policyStatusValues);
export const errorCodeSchema = z.enum(errorCodeValues);

export type Decision = z.infer<typeof decisionSchema>;
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;
export type PolicyStatus = z.infer<typeof policyStatusSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;
