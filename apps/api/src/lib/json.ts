import type { Prisma } from "../../generated/prisma/index.js";

/**
 * Our domain types (EnterpriseMetrics, TopologyGraph, etc.) are concrete
 * interfaces without index signatures, so they don't structurally satisfy
 * Prisma's `InputJsonValue` even though every field is plain JSON-safe data.
 * This is the one cast point for writing a typed domain value into a Json column.
 */
export function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
